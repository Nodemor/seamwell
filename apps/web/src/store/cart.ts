"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Shopping bag (works for guests). Saved in localStorage.
 * Prices here are for DISPLAY only — the API recalculates everything at checkout.
 */
export type ItemMode = "buy" | "rent";
/** Max pieces per line: same as the API (rentals: RENTAL.maxQty in @seamwell/shared). */
const MAX_BUY = 10;
const MAX_RENT = 3;

/** A bag line is a variant bought, or rented for one event date (same size, two dates = two lines). */
export const lineKey = (l: { variantId: string; mode?: ItemMode; eventDate?: string }) => `${l.mode ?? "buy"}:${l.variantId}:${l.eventDate ?? ""}`;

export interface CartLine {
  key: string;
  variantId: string;
  mode: ItemMode;
  /** Rentals: event date (YYYY-MM-DD) and, once quoted, the delivery / collection dates and deposit per piece. */
  eventDate?: string;
  deliverOn?: string;
  returnOn?: string;
  depositCents?: number;
  productSlug: string;
  name: string;
  size: string;
  unitPriceCents: number;
  colorHex: string | null;
  slot: "kit" | "blazer" | "shirt" | "trousers";
  quantity: number;
  /** First product photo for the bag thumbnail (older bags get it from the next quote). */
  imageUrl?: string | null;
}

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, "quantity" | "key" | "mode"> & { mode?: ItemMode }, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Adopt server prices, deposits, rental dates + photos from a quote (display only — the API prices the real order again). */
  applyQuote: (lines: { variantId: string; mode: ItemMode; eventDate?: string; unitPriceCents: number; imageUrl: string | null; depositCents: number; deliverOn?: string; returnOn?: string }[]) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line, qty = 1) =>
        set((s) => {
          const mode = line.mode ?? "buy";
          const key = lineKey({ ...line, mode });
          const max = mode === "rent" ? MAX_RENT : MAX_BUY;
          const existing = s.lines.find((l) => l.key === key);
          if (existing) {
            return { lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(max, l.quantity + qty) } : l)) };
          }
          return { lines: [...s.lines, { ...line, mode, key, quantity: Math.min(max, qty) }].slice(0, 30) };
        }),
      setQty: (key, qty) =>
        set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(l.mode === "rent" ? MAX_RENT : MAX_BUY, qty)) } : l)) })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
      applyQuote: (quoted) =>
        set((s) => ({
          lines: s.lines.map((l) => {
            const q = quoted.find((x) => lineKey(x) === l.key);
            if (!q) return l;
            const same = q.unitPriceCents === l.unitPriceCents && q.imageUrl === (l.imageUrl ?? null) && q.depositCents === (l.depositCents ?? 0) && q.deliverOn === l.deliverOn && q.returnOn === l.returnOn;
            if (same) return l;
            return { ...l, unitPriceCents: q.unitPriceCents, imageUrl: q.imageUrl, depositCents: q.depositCents, deliverOn: q.deliverOn, returnOn: q.returnOn };
          }),
        })),
    }),
    {
      name: "sw-bag",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // v1 bags (before rentals): every line was a purchase
      migrate: (persisted, version) => {
        const st = persisted as { lines?: (Omit<CartLine, "key" | "mode"> & Partial<CartLine>)[] };
        if (version < 2) return { lines: (st.lines ?? []).map((l) => ({ ...l, mode: "buy" as const, key: lineKey({ variantId: l.variantId }) })) };
        return persisted as CartState;
      },
    },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
export const cartDeposits = (lines: CartLine[]) => lines.reduce((n, l) => n + (l.depositCents ?? 0) * l.quantity, 0);
