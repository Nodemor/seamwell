"use client";

import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ORDER_STATUS_LABEL, ORDER_STATUSES, type OrderStatus } from "@seamwell/shared";
import { AdminHeading } from "@/components/admin/AdminShell";
import { OrderDrawer } from "@/components/admin/OrderDrawer";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Price } from "@/components/ui/Price";
import { Skeleton } from "@/components/ui/skeleton";
import { type AdminOrderRow, dateTime, downloadFile } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type ListResponse = { orders: AdminOrderRow[]; total: number; page: number; pageSize: number };
const colomboToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/** Orders board: status filter, search (order number / phone), paging, CSV export, detail drawer (?order=). */
export function OrdersBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = (ORDER_STATUSES as readonly string[]).includes(params.get("status") ?? "") ? (params.get("status") as OrderStatus) : undefined;
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const open = params.get("order");

  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(q);
  const [version, setVersion] = useState(0);

  const setParams = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    let alive = true;
    const sp = new URLSearchParams({ page: String(page) });
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    api<ListResponse>(`/admin/orders?${sp}`, { cache: "no-store" })
      .then((r) => {
        if (!alive) return;
        setData(r);
        setError("");
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Couldn't load orders"));
    return () => {
      alive = false;
    };
  }, [status, q, page, version]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <AdminHeading title="Orders" description={data ? `${data.total} ${data.total === 1 ? "order" : "orders"}${status ? ` · ${ORDER_STATUS_LABEL[status]}` : ""}` : " "} action={<ExportCsv />} />

      <form
        role="search"
        className="mt-6 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ q: search.trim() || undefined, page: undefined });
        }}
      >
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number or phone" aria-label="Search orders by order number or phone" inputMode="search" />
        <Button type="submit" variant="secondary" size="icon" aria-label="Search">
          <Search aria-hidden />
        </Button>
      </form>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label="Filter by status">
        {[undefined, ...ORDER_STATUSES].map((s) => (
          <button
            key={s ?? "all"}
            type="button"
            aria-pressed={status === s}
            onClick={() => setParams({ status: s, page: undefined })}
            className={cn(
              "h-11 shrink-0 rounded-full border px-4 text-sm transition-colors focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none sm:h-9",
              status === s ? "border-midnight bg-midnight text-ivory" : "border-line bg-paper text-stone hover:text-ink",
            )}
          >
            {s ? ORDER_STATUS_LABEL[s] : "All"}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl bg-wine/10 p-3 text-sm text-wine">{error}</p>}

      {!data ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : data.orders.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-line bg-paper p-8 text-center text-stone">No orders match.</p>
      ) : (
        <>
          {/* Table on wide screens, cards on phones */}
          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-line bg-paper md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-linen/60 text-xs uppercase tracking-wider text-stone">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Order</th>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Payment</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.orders.map((o) => (
                  <tr key={o.orderNumber} className="cursor-pointer hover:bg-ivory" onClick={() => setParams({ order: o.orderNumber })}>
                    <td className="px-4 py-3">
                      <button type="button" className="font-mono font-medium text-midnight underline-offset-4 hover:underline focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none" onClick={(e) => (e.stopPropagation(), setParams({ order: o.orderNumber }))}>
                        {o.orderNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{o.customerName}</span>
                      <span className="block text-xs text-stone">{o.phone} · {o.city}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-stone">{o.paymentMethod === "cod" ? "Cash on delivery" : "Bank transfer"}{o.paymentStatus === "paid" && <span className="ml-1 text-sage">· paid</span>}</td>
                    <td className="px-4 py-3 text-right"><Price size="sm" cents={o.totalCents} /></td>
                    <td className="px-4 py-3 text-stone">{dateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-6 space-y-2 md:hidden">
            {data.orders.map((o) => (
              <li key={o.orderNumber}>
                <button type="button" onClick={() => setParams({ order: o.orderNumber })} className="w-full rounded-2xl border border-line bg-paper p-4 text-left focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{o.orderNumber}</span>
                    <StatusBadge status={o.status} />
                  </span>
                  <span className="mt-1 block text-sm">{o.customerName} · {o.city}</span>
                  <span className="mt-1 flex items-center justify-between text-xs text-stone">
                    <span>{dateTime(o.createdAt)} · {o.paymentMethod === "cod" ? "COD" : "Bank"}</span>
                    <Price size="sm" cents={o.totalCents} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
              <Button variant="secondary" size="icon-sm" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })} aria-label="Previous page"><ChevronLeft aria-hidden /></Button>
              <span>Page {page} of {pages}</span>
              <Button variant="secondary" size="icon-sm" disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })} aria-label="Next page"><ChevronRight aria-hidden /></Button>
            </nav>
          )}
        </>
      )}

      <OrderDrawer orderNumber={open} onClose={() => setParams({ order: undefined })} onChanged={() => setVersion((v) => v + 1)} />
    </div>
  );
}

function ExportCsv() {
  const [from, setFrom] = useState(() => colomboToday().slice(0, 8) + "01");
  const [to, setTo] = useState(colomboToday);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await downloadFile(`/admin/orders/export.csv?from=${from}&to=${to}`, `seamwell-orders-${from}-to-${to}.csv`);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Export failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-stone">
        From
        <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-11 w-40" required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-stone">
        To
        <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-11 w-40" required />
      </label>
      <Button type="submit" variant="secondary" loading={busy} className="h-11">
        <Download aria-hidden /> CSV
      </Button>
    </form>
  );
}
