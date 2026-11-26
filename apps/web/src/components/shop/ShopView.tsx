"use client";

import { PackageSearch, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { FilterPanel } from "@/components/shop/FilterPanel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { apiQuery, PRICE_BUCKETS, type ProductCard as Product, type ProductList, SHOP_CATEGORIES, shopHref, type ShopState, SORT_LABEL } from "@/lib/catalog";
import { cn, formatLKR } from "@/lib/utils";

type Props = { state: ShopState; initial: ProductList; live: boolean };

/** Shop listing: gender/category chips, filters (sidebar ≥lg, sheet below), sort, active-filter pills, grid, "Load more". */
export function ShopView({ state, initial, live }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [more, setMore] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const items = [...initial.items, ...more];
  const total = initial.total;
  const go = (patch: ShopState) => startTransition(() => router.push(shopHref(state, patch), { scroll: false }));

  async function loadMore() {
    setLoadingMore(true);
    setMoreError("");
    try {
      const next = await api<ProductList>(`/products?${apiQuery(state, { page: String(page + 1), pageSize: String(initial.pageSize) })}`);
      setMore((m) => [...m, ...next.items]);
      setPage((p) => p + 1);
    } catch {
      setMoreError("Couldn't load more. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  const priceLabel = PRICE_BUCKETS.find((b) => (state.minPrice ?? "") === String(b.min ?? "") && (state.maxPrice ?? "") === String(b.max ?? ""))?.label;
  const pills = [
    state.q && { key: "q", label: `“${state.q}”`, patch: { q: undefined } },
    state.size && { key: "size", label: `Size ${state.size}`, patch: { size: undefined } },
    (state.minPrice || state.maxPrice) && {
      key: "price",
      label: priceLabel ?? `${state.minPrice ? formatLKR(Number(state.minPrice)) : "Any"} – ${state.maxPrice ? formatLKR(Number(state.maxPrice)) : "any"}`,
      patch: { minPrice: undefined, maxPrice: undefined },
    },
    state.fabric && { key: "fabric", label: state.fabric, patch: { fabric: undefined } },
    state.rent === "1" && { key: "rent", label: "Available to rent", patch: { rent: undefined } },
  ].filter(Boolean) as { key: string; label: string; patch: ShopState }[];
  const clearAll = { q: undefined, size: undefined, minPrice: undefined, maxPrice: undefined, fabric: undefined, rent: undefined };

  const sortSelect = (
    <Select value={state.sort ?? "new"} onValueChange={(v) => go({ sort: v })}>
      <SelectTrigger aria-label="Sort products" className="h-11 w-auto min-w-[11.5rem] rounded-full sm:h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {Object.entries(SORT_LABEL).map(([k, label]) => (
          <SelectItem key={k} value={k}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="mt-8">
      {/* Gender + category — plain links so they work before JS and are crawlable */}
      <nav aria-label="Collection" className="-mx-[clamp(1.1rem,4vw,2.5rem)] flex gap-2 overflow-x-auto px-[clamp(1.1rem,4vw,2.5rem)] pb-1 [scrollbar-width:none]">
        {[{ v: undefined, label: "All" }, { v: "men", label: "Men" }, { v: "women", label: "Women" }].map((g) => (
          <Link
            key={g.label}
            href={shopHref(state, { gender: g.v })}
            scroll={false}
            aria-current={state.gender === g.v ? "page" : undefined}
            className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors sm:min-h-10", state.gender === g.v ? "border-midnight bg-midnight text-ivory" : "border-line hover:border-ink/40")}
          >
            {g.label}
          </Link>
        ))}
        <span className="mx-1 my-2 w-px shrink-0 bg-line" aria-hidden />
        {[{ slug: undefined, label: "Everything" }, ...SHOP_CATEGORIES].map((c) => (
          <Link
            key={c.label}
            href={shopHref(state, { category: c.slug })}
            scroll={false}
            aria-current={state.category === c.slug ? "page" : undefined}
            className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors sm:min-h-10", state.category === c.slug ? "border-brass bg-brass-soft/60 text-ink" : "border-line hover:border-ink/40")}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr]">
        {/* Desktop filters */}
        <aside className="hidden lg:block" aria-label="Filters">
          <FilterPanel state={state} facets={initial.facets} onChange={go} />
        </aside>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone" aria-live="polite">
              {pending ? "Updating…" : `${total} ${total === 1 ? "piece" : "pieces"}`}
            </p>
            <div className="flex items-center gap-2">
              {/* Mobile / tablet filters */}
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="secondary" size="sm" className="lg:hidden">
                    <SlidersHorizontal aria-hidden /> Filters{pills.length ? ` (${pills.length})` : ""}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[88dvh]">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>{pending ? "Updating…" : `${total} ${total === 1 ? "piece" : "pieces"} match`}</SheetDescription>
                  </SheetHeader>
                  <div className="overflow-y-auto px-5 py-5">
                    <FilterPanel state={state} facets={initial.facets} onChange={go} />
                  </div>
                  <SheetFooter className="flex-row gap-3">
                    <Button variant="secondary" className="flex-1" disabled={!pills.length} onClick={() => go(clearAll)}>Clear all</Button>
                    <Button className="flex-1" loading={pending} onClick={() => setSheetOpen(false)}>Show {total} {total === 1 ? "result" : "results"}</Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              {sortSelect}
            </div>
          </div>

          {pills.length > 0 && (
            <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
              {pills.map((p) => (
                <li key={p.key}>
                  <button type="button" onClick={() => go(p.patch)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-linen px-3.5 text-sm transition-colors hover:bg-brass-soft sm:min-h-9" aria-label={`Remove filter ${p.label}`}>
                    {p.label} <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => go(clearAll)} className="min-h-11 px-2 text-sm text-midnight underline-offset-4 hover:underline sm:min-h-9">Clear all</button>
              </li>
            </ul>
          )}

          {!live && <p className="mt-6 text-xs text-stone">Showing sample products — the API isn&apos;t running yet.</p>}

          <h2 className="sr-only">Products</h2>
          <div aria-busy={pending} className={cn("transition-opacity duration-300", pending && "pointer-events-none opacity-50")}>
            {items.length === 0 ? (
              <EmptyState
                className="mt-8"
                icon={PackageSearch}
                title="No pieces match"
                description="Try removing a filter or browse the whole collection."
                action={<Button onClick={() => go({ ...clearAll, category: undefined, gender: undefined })}>See everything</Button>}
              />
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 xl:grid-cols-3">
                {items.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 2} />
                ))}
              </div>
            )}
          </div>

          {live && items.length < total && (
            <div className="mt-12 flex flex-col items-center gap-3">
              <p className="text-sm text-stone">Showing {items.length} of {total}</p>
              <Button variant="secondary" size="lg" loading={loadingMore} onClick={() => void loadMore()}>Load more</Button>
              {moreError && <p role="alert" className="text-sm text-wine">{moreError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
