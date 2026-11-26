"use client";

import { AlertTriangle, CalendarClock, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { OrderStatus } from "@seamwell/shared";
import { AdminHeading } from "@/components/admin/AdminShell";
import { OrderDrawer } from "@/components/admin/OrderDrawer";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Price } from "@/components/ui/Price";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { DEPOSIT_LABEL, dayLabel } from "@/lib/rental";
import { cn } from "@/lib/utils";

type View = "deliver" | "out" | "due" | "overdue" | "all";
type Rental = {
  orderNumber: string;
  orderStatus: OrderStatus;
  customerName: string;
  phone: string;
  city: string;
  productName: string;
  size: string;
  quantity: number;
  eventDate: string;
  rentStart: string;
  rentEnd: string;
  depositCents: number;
  depositStatus: keyof typeof DEPOSIT_LABEL;
  overdue: boolean;
};
type Page = { rentals: Rental[]; total: number; page: number; pageSize: number; today: string; counts: Record<Exclude<View, "all">, number> };

const TABS: { id: View; label: string; empty: string }[] = [
  { id: "deliver", label: "To deliver", empty: "Nothing to deliver in the next 14 days." },
  { id: "out", label: "Out now", empty: "No rented pieces are out right now." },
  { id: "due", label: "Due back", empty: "Nothing is due back in the next 3 days." },
  { id: "overdue", label: "Overdue", empty: "No overdue rentals — everything is back on time." },
  { id: "all", label: "All", empty: "No rentals yet." },
];

/** Rentals board: what to deliver, what's out, what's due back, what's late. Opens the order drawer for actions. */
export function RentalsBoard() {
  const [view, setView] = useState<View>("deliver");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    api<Page>(`/admin/rentals?view=${view}&page=${page}`, { cache: "no-store" })
      .then((r) => alive && setData(r))
      .catch((e) => alive && (setData({ rentals: [], total: 0, page: 1, pageSize: 30, today: "", counts: { deliver: 0, out: 0, due: 0, overdue: 0 } }), toast.error(e instanceof ApiError ? e.message : "Couldn't load rentals")));
    return () => {
      alive = false;
    };
  }, [view, page, reload]);

  const tab = TABS.find((t) => t.id === view)!;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <AdminHeading title="Rentals" description="Event rentals: deliver 2 days before the event, collect after the rental days, then mark the order returned and settle the deposit." />
      <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Show rentals">
        {TABS.map((t) => {
          const n = t.id === "all" ? undefined : data?.counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={view === t.id}
              onClick={() => (setView(t.id), setPage(1), setData(null))}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none sm:h-9",
                view === t.id ? "border-midnight bg-midnight text-ivory" : "border-line bg-paper text-stone hover:text-ink",
              )}
            >
              {t.label}
              {n != null && n > 0 && <span className={cn("rounded-full px-1.5 text-xs", t.id === "overdue" ? "bg-wine text-ivory" : view === t.id ? "bg-ivory/20" : "bg-linen")}>{n}</span>}
            </button>
          );
        })}
      </div>

      {!data ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : data.rentals.length === 0 ? (
        <EmptyState className="mt-6" icon={CalendarClock} title={tab.empty} />
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {data.rentals.map((r, i) => (
            <li key={`${r.orderNumber}-${i}`} className={cn("rounded-2xl border bg-paper p-5", r.overdue ? "border-wine/40" : "border-line")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setOpen(r.orderNumber)} className="min-h-11 rounded-md font-mono text-sm font-medium text-midnight underline-offset-4 hover:underline focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none sm:min-h-0">
                  {r.orderNumber}
                </button>
                <StatusBadge status={r.orderStatus} />
              </div>
              <p className="mt-2 font-medium">{r.quantity} × {r.productName} <span className="font-normal text-stone">· size {r.size}</span></p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {[
                  ["Deliver", r.rentStart],
                  ["Event", r.eventDate],
                  ["Collect", r.rentEnd],
                ].map(([label, d]) => (
                  <div key={label} className={cn("rounded-lg bg-linen/60 p-2", label === "Collect" && r.overdue && "bg-wine/10 text-wine")}>
                    <dt className="text-stone">{label}</dt>
                    <dd className="mt-0.5 font-medium">{dayLabel(d!, { year: false })}</dd>
                  </div>
                ))}
              </dl>
              {r.overdue && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-wine">
                  <AlertTriangle className="size-4" aria-hidden /> Overdue — was due back {dayLabel(r.rentEnd)}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {r.customerName} · {r.city}
                  <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="ml-2 inline-flex min-h-11 items-center gap-1 text-midnight underline-offset-4 hover:underline sm:min-h-0">
                    <Phone className="size-3.5" aria-hidden /> {r.phone}
                  </a>
                </span>
                {r.depositCents > 0 && (
                  <span className="text-xs text-stone">
                    <Price size="sm" cents={r.depositCents} className="inline-flex text-xs [&_span]:text-xs" /> · {DEPOSIT_LABEL[r.depositStatus].toLowerCase()}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-stone">Page {page} of {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <OrderDrawer orderNumber={open} onClose={() => setOpen(null)} onChanged={() => setReload((n) => n + 1)} />
    </div>
  );
}
