"use client";

import { ChevronRight, Package } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@seamwell/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Price } from "@/components/ui/Price";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";

type OrderRow = { orderNumber: string; status: OrderStatus; totalCents: number; createdAt: string };

const badgeFor = (s: OrderStatus) => (s === "cancelled" ? "danger" : s === "delivered" ? "success" : "default");

export function OrdersTab({ emailVerified }: { emailVerified: boolean }) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api<{ orders: OrderRow[] }>("/orders/mine", { cache: "no-store" })
      .then((r) => alive && setOrders(r.orders))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "We couldn't load your orders."));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p role="alert" className="rounded-xl bg-wine/10 p-3 text-sm text-wine">{error}</p>;
  if (!orders) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        <span className="sr-only">Loading your orders…</span>
      </div>
    );
  }
  if (!orders.length) {
    return (
      <EmptyState
        icon={Package}
        title="No orders yet"
        description={
          emailVerified
            ? "When you order while signed in — or as a guest with this email — it shows up here."
            : "Orders you placed as a guest appear here once you confirm your email."
        }
        action={
          <Button asChild>
            <Link href="/shop">Browse the shop</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
      {orders.map((o) => (
        <li key={o.orderNumber}>
          <Link
            href={`/account/orders/${o.orderNumber}`}
            className="group flex items-center gap-4 p-4 transition-colors hover:bg-ivory focus-visible:bg-ivory focus-visible:outline-none sm:p-5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-linen text-brass">
              <Package className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono font-medium">{o.orderNumber}</span>
              <span className="block text-sm text-stone">
                {new Date(o.createdAt).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <Badge variant={badgeFor(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
              <Price size="sm" cents={o.totalCents} />
            </span>
            <ChevronRight className="size-4 shrink-0 text-stone transition-colors group-hover:text-ink" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
