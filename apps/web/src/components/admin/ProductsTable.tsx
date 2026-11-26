"use client";

import { ChevronLeft, ChevronRight, Plus, Search, Shirt, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeading, useAdminBase } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Price } from "@/components/ui/Price";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminProductRow } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type ListResponse = { products: AdminProductRow[]; total: number; page: number; pageSize: number };
const STATUSES = [
  { id: "all", label: "All" },
  { id: "active", label: "In the shop" },
  { id: "archived", label: "Archived" },
] as const;

export function ProductsTable() {
  const base = useAdminBase();
  const [status, setStatus] = useState<(typeof STATUSES)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const sp = new URLSearchParams({ status, page: String(page) });
    if (q) sp.set("q", q);
    api<ListResponse>(`/admin/products?${sp}`, { cache: "no-store" })
      .then((r) => alive && (setData(r), setError("")))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Couldn't load products"));
    return () => {
      alive = false;
    };
  }, [status, q, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <AdminHeading
        title="Products"
        description={data ? `${data.total} products` : " "}
        action={
          <Button asChild>
            <Link href={`${base}/products/new`}><Plus aria-hidden /> New product</Link>
          </Button>
        }
      />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form
          role="search"
          className="flex w-full max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search.trim());
            setPage(1);
          }}
        >
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or category" aria-label="Search products" />
          <Button type="submit" variant="secondary" size="icon" aria-label="Search"><Search aria-hidden /></Button>
        </form>
        <div className="flex gap-1.5" role="group" aria-label="Show">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={status === s.id}
              onClick={() => (setStatus(s.id), setPage(1))}
              className={cn("h-11 rounded-full border px-4 text-sm transition-colors focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none sm:h-9", status === s.id ? "border-midnight bg-midnight text-ivory" : "border-line bg-paper text-stone hover:text-ink")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl bg-wine/10 p-3 text-sm text-wine">{error}</p>}
      {!data ? (
        <div className="mt-6 space-y-2" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : data.products.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-line bg-paper p-8 text-center text-stone">No products match.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {data.products.map((p) => (
            <li key={p.id}>
              <Link href={`${base}/products/${p.id}`} className={cn("flex items-center gap-4 p-3 transition-colors hover:bg-ivory focus-visible:bg-ivory focus-visible:outline-none sm:p-4", !p.isActive && "opacity-70")}>
                <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-linen">
                  {p.imageUrl ? <Image src={p.imageUrl} alt="" fill sizes="64px" className="object-contain p-1" /> : <Shirt className="size-6 text-stone" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-sm text-stone">{p.categoryName} · {p.gender}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {!p.isActive && <Badge variant="muted">Archived</Badge>}
                    {p.sizes === 0 ? <Badge variant="danger">No sizes</Badge> : p.totalStock === 0 ? <Badge variant="danger">Sold out</Badge> : p.lowSizes > 0 ? <Badge variant="accent">{p.lowSizes} size{p.lowSizes > 1 ? "s" : ""} low</Badge> : null}
                    {p.tryonEnabled && (p.hasTryonPhoto ? <Badge variant="outline"><Sparkles aria-hidden /> Try-on ready</Badge> : <Badge variant="muted">No try-on photo</Badge>)}
                  </span>
                </span>
                <span className="hidden text-right sm:block">
                  <Price size="sm" cents={p.priceCents} />
                  <span className="block text-xs text-stone">{p.totalStock} in stock · {p.sizes} sizes</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
          <Button variant="secondary" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft aria-hidden /></Button>
          <span>Page {page} of {pages}</span>
          <Button variant="secondary" size="icon-sm" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight aria-hidden /></Button>
        </nav>
      )}
    </div>
  );
}
