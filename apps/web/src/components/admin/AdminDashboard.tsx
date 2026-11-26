"use client";

import { AlertTriangle, ArrowRight, Banknote, ClipboardCheck, MessageSquareText, PackageOpen, ShoppingBag, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { OrderStatus } from "@seamwell/shared";
import { AdminHeading, useAdminBase } from "@/components/admin/AdminShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Price } from "@/components/ui/Price";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Dashboard = {
  today: { orders: number; revenueCents: number };
  toConfirm: number;
  awaitingPayment: number;
  toShip: number;
  inTransit: number;
  pendingReviews: number;
  lowStock: { productId: string; productName: string; size: string; sku: string; stock: number }[];
  recent: { orderNumber: string; customerName: string; status: OrderStatus; totalCents: number; createdAt: string }[];
};

export function AdminDashboard() {
  const base = useAdminBase();
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api<Dashboard>("/admin/dashboard", { cache: "no-store" })
      .then((r) => alive && setD(r))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Couldn't load the dashboard"));
    return () => {
      alive = false;
    };
  }, []);

  const cards = d
    ? [
        { label: "To confirm", value: d.toConfirm, href: `${base}/orders?status=pending_confirmation`, icon: ClipboardCheck, hint: "New cash-on-delivery orders", urgent: d.toConfirm > 0 },
        { label: "Awaiting payment", value: d.awaitingPayment, href: `${base}/orders?status=awaiting_payment`, icon: Banknote, hint: "Check your bank, then Mark paid", urgent: false },
        { label: "To ship", value: d.toShip, href: `${base}/orders?status=ready_to_ship`, icon: PackageOpen, hint: "Confirmed, being made or ready", urgent: d.toShip > 0 },
        { label: "With the courier", value: d.inTransit, href: `${base}/orders?status=shipped`, icon: Truck, hint: "Mark delivered when they arrive", urgent: false },
        { label: "Reviews to check", value: d.pendingReviews, href: `${base}/reviews`, icon: MessageSquareText, hint: "Approve or reject", urgent: d.pendingReviews > 0 },
      ]
    : [];

  return (
    <div>
      <AdminHeading title="Today at the atelier" description={new Date().toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long" })} />
      {error && <p role="alert" className="mt-6 rounded-xl bg-wine/10 p-3 text-sm text-wine">{error}</p>}

      {!d && !error ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : d ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl bg-midnight p-5 text-ivory">
              <p className="flex items-center gap-2 text-sm text-brass-soft"><ShoppingBag className="size-4" aria-hidden /> Orders today</p>
              <p className="mt-3 font-display text-5xl">{d.today.orders}</p>
              <p className="mt-1 text-sm text-ivory/75"><Price size="sm" cents={d.today.revenueCents} className="[&_span]:text-ivory" /> in sales</p>
            </div>
            {cards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="group rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-ink/30 focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none"
              >
                <p className="flex items-center justify-between gap-2 text-sm text-stone">
                  <span className="flex items-center gap-2"><c.icon className="size-4 text-brass" aria-hidden /> {c.label}</span>
                  <ArrowRight className="size-4 transition-colors group-hover:text-ink" aria-hidden />
                </p>
                <p className={cn("mt-3 font-display text-5xl", c.urgent && "text-midnight")}>{c.value}</p>
                <p className="mt-1 text-xs text-stone">{c.hint}</p>
              </Link>
            ))}
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <section aria-labelledby="recent-h" className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex items-center justify-between">
                <h2 id="recent-h" className="font-sans text-lg font-medium">Latest orders</h2>
                <Link href={`${base}/orders`} className="text-sm text-midnight underline-offset-4 hover:underline">All orders</Link>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {d.recent.map((o) => (
                  <li key={o.orderNumber}>
                    <Link href={`${base}/orders?order=${o.orderNumber}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-ivory focus-visible:bg-ivory focus-visible:outline-none">
                      <span className="font-mono text-sm font-medium">{o.orderNumber}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-stone">{o.customerName}</span>
                      <StatusBadge status={o.status} />
                      <Price size="sm" cents={o.totalCents} />
                      <time className="w-full text-xs text-stone sm:w-auto">{dateTime(o.createdAt)}</time>
                    </Link>
                  </li>
                ))}
                {d.recent.length === 0 && <li className="py-3 text-sm text-stone">No orders yet.</li>}
              </ul>
            </section>

            <section aria-labelledby="stock-h" className="rounded-2xl border border-line bg-paper p-5">
              <h2 id="stock-h" className="flex items-center gap-2 font-sans text-lg font-medium">
                <AlertTriangle className="size-4 text-brass" aria-hidden /> Low stock <span className="text-sm font-normal text-stone">(3 or fewer)</span>
              </h2>
              <ul className="mt-3 divide-y divide-line">
                {d.lowStock.map((s) => (
                  <li key={s.sku}>
                    <Link href={`${base}/products/${s.productId}#sizes`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-ivory">
                      <span className="min-w-0 flex-1 truncate">{s.productName}</span>
                      <span className="text-stone">size {s.size}</span>
                      <span className={cn("w-16 rounded-full px-2 py-0.5 text-center text-xs font-medium", s.stock === 0 ? "bg-wine/10 text-wine" : "bg-brass/15 text-brass-ink")}>
                        {s.stock === 0 ? "sold out" : `${s.stock} left`}
                      </span>
                    </Link>
                  </li>
                ))}
                {d.lowStock.length === 0 && <li className="py-3 text-sm text-stone">Every size has more than 3 in stock.</li>}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
