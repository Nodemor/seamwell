"use client";

import type { OrderQuote } from "@seamwell/shared";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { type CartLine, lineKey, useCart } from "@/store/cart";

type QuoteState = {
  key: string;
  quote: OrderQuote | null;
  loading: boolean;
  /** "rate_limited" | "offline" — the UI falls back to the bag's own prices with a note. */
  error: string | null;
  /** line key → previous unit price, for lines whose price changed since they were added. */
  priceChanges: Record<string, number>;
};

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; quote: OrderQuote }>();

const keyFor = (lines: CartLine[]) => JSON.stringify(lines.map((l) => [l.variantId, l.quantity, l.mode, l.eventDate ?? null]));

/**
 * Server-priced view of the bag (POST /api/orders/quote), debounced 350 ms and cached 30 s
 * (the bag page, mobile bag sheet and checkout share results; the endpoint is rate-limited).
 * When the server price differs from the stored one, the bag adopts it and the change is reported.
 */
export function useQuote(lines: CartLine[], enabled = true) {
  const key = keyFor(lines);
  const [state, setState] = useState<QuoteState>({ key: "", quote: null, loading: false, error: null, priceChanges: {} });

  useEffect(() => {
    const items = (JSON.parse(key) as [string, number, CartLine["mode"], string | null][]).map(([variantId, quantity, mode, eventDate]) => ({
      variantId,
      quantity,
      ...(mode === "rent" && { mode, eventDate: eventDate ?? undefined }),
    }));
    if (!enabled || items.length === 0) return;
    const ctrl = new AbortController();

    const apply = (quote: OrderQuote) => {
      const current = useCart.getState().lines;
      const changes: Record<string, number> = {};
      for (const l of quote.lines) {
        const k = lineKey(l);
        const mine = current.find((c) => c.key === k);
        if (mine && mine.unitPriceCents !== l.unitPriceCents) changes[k] = mine.unitPriceCents;
      }
      useCart.getState().applyQuote(quote.lines);
      setState((s) => ({ key, quote, loading: false, error: null, priceChanges: { ...(s.key === key ? s.priceChanges : {}), ...changes } }));
    };

    const t = setTimeout(async () => {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_MS) return apply(hit.quote);
      setState((s) => ({ ...s, loading: true }));
      try {
        const { quote } = await api<{ quote: OrderQuote }>("/orders/quote", { method: "POST", json: { items }, signal: ctrl.signal });
        cache.set(key, { at: Date.now(), quote });
        apply(quote);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, key, loading: false, error: e instanceof ApiError && e.status === 429 ? "rate_limited" : "offline" }));
      }
    }, 350);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [key, enabled]);

  const fresh = state.key === key;
  return {
    quote: fresh ? state.quote : null,
    loading: !fresh || state.loading,
    error: fresh ? state.error : null,
    priceChanges: fresh ? state.priceChanges : {},
    /** Lines that can't be ordered as they are (sold out / too many / gone). */
    unavailable: fresh && state.quote ? state.quote.unavailable : [],
  };
}

/** Forget cached quotes (e.g. after an order is placed, stock changed). */
export const clearQuoteCache = () => cache.clear();
