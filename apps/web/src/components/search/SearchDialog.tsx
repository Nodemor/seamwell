"use client";

import { ArrowRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Price } from "@/components/ui/Price";
import { api } from "@/lib/api";
import type { ProductCard, ProductList } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

/**
 * Command-style product search: type → debounced (250 ms) request → results you can arrow through.
 * Opens from the navbar search icon, "/" or Ctrl/⌘+K. Enter on a result opens it; Enter with nothing
 * highlighted shows all results on /shop?q=…
 */
export function SearchDialog({ open, onOpenChange, returnFocusRef }: { open: boolean; onOpenChange: (open: boolean) => void; returnFocusRef?: React.RefObject<HTMLElement | null> }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductCard[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [active, setActive] = useState(-1);

  const q = term.trim();
  const ready = q.length >= MIN_CHARS;

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const data = await api<ProductList>(`/products?q=${encodeURIComponent(q)}&pageSize=6`, { signal: ctrl.signal });
        setResults(data.items);
        setTotal(data.total);
        setActive(-1);
        setStatus("done");
      } catch {
        if (!ctrl.signal.aborted) setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, ready]);

  const close = () => onOpenChange(false);
  const goTo = (href: string) => {
    close();
    router.push(href);
  };
  const showAll = () => ready && goTo(`/shop?q=${encodeURIComponent(q)}`);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!ready || status !== "done") {
      if (e.key === "Enter") {
        e.preventDefault();
        showAll();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) goTo(`/product/${r.slug}`);
      else showAll();
    }
  }

  const visible = ready ? results : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setTerm("");
          setResults([]);
          setStatus("idle");
          setActive(-1);
        }
      }}
    >
      <DialogContent
        // Return focus to wherever it was before search opened (the dialog is loaded on demand, so Radix can't
        // always tell what had focus).
        onCloseAutoFocus={(e) => {
          const el = returnFocusRef?.current;
          if (!el || !el.isConnected) return;
          e.preventDefault();
          el.focus();
        }}
        className="top-[12dvh] max-w-xl translate-y-0 gap-0 p-0 sm:p-0"
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Search the shop</DialogTitle>
        <DialogDescription className="sr-only">Type at least two letters. Use the arrow keys to move through results and Enter to open one.</DialogDescription>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search className="size-5 shrink-0 text-brass" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value.slice(0, 80))}
            onKeyDown={onKeyDown}
            placeholder="Search suits, linen, navy…"
            aria-label="Search products"
            role="combobox"
            aria-expanded={visible.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            className="h-16 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-stone/70 [&::-webkit-search-cancel-button]:hidden"
            autoComplete="off"
            spellCheck={false}
          />
          {status === "loading" && <Loader2 className="size-4 animate-spin text-stone" aria-hidden />}
          <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[0.65rem] text-stone sm:block">Esc</kbd>
        </div>

        <div className="max-h-[min(60dvh,28rem)] overflow-y-auto p-2" aria-live="polite">
          {!ready && <p className="px-3 py-6 text-center text-sm text-stone">Type at least {MIN_CHARS} letters to search.</p>}
          {ready && status === "error" && <p className="px-3 py-6 text-center text-sm text-wine">Search isn&apos;t available right now.</p>}
          {ready && status === "done" && visible.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone">No pieces match “{q}”.</p>}
          {visible.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Search results">
              {visible.map((p, i) => (
                <li
                  key={p.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => goTo(`/product/${p.slug}`)}
                  className={cn("flex min-h-16 cursor-pointer items-center gap-4 rounded-[var(--radius)] px-3 py-2", i === active && "bg-linen")}
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-linen" aria-hidden>
                    <ProductPhoto src={p.images[0]?.url} alt="" sizes="56px" className="p-1" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{p.name}</span>
                    <span className="block truncate text-xs text-stone">{[p.categoryName, p.fabric, p.color].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Price size="sm" cents={p.priceCents} compareAtCents={p.compareAtCents} stacked className="items-end text-right" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {ready && status === "done" && total > 0 && (
          <button
            type="button"
            onClick={showAll}
            className="flex min-h-12 w-full items-center justify-between border-t border-line px-5 text-sm font-medium text-midnight transition-colors hover:bg-linen"
          >
            See all {total} {total === 1 ? "result" : "results"} for “{q}”
            <ArrowRight className="size-4 text-brass" aria-hidden />
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
