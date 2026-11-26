"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderDetails, type OrderView } from "@/components/orders/OrderDetails";
import { ReviewableItems } from "@/components/reviews/ReviewableItems";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** One of the signed-in customer's orders: status timeline, courier tracking link, items, history. */
export function MyOrder({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(`/account/orders/${orderNumber}`)}`);
    if (!user) return;
    let alive = true;
    api<{ order: OrderView }>(`/orders/mine/${encodeURIComponent(orderNumber)}`, { cache: "no-store" })
      .then((r) => alive && setOrder(r.order))
      .catch((err) => alive && setError(err instanceof ApiError && err.status !== 400 ? err.message : "Order not found"));
    return () => {
      alive = false;
    };
  }, [user, orderNumber, router]);

  return (
    <div className="container-sw max-w-3xl py-12 md:py-16">
      <Link href="/account?tab=orders" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-stone transition-colors hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All orders
      </Link>
      <h1 className="sr-only">Order {orderNumber}</h1>
      {error ? (
        <p role="alert" className="mt-6 rounded-xl bg-wine/10 p-3 text-sm text-wine">{error}</p>
      ) : order ? (
        <>
          <OrderDetails order={order} className="mt-6" />
          <ReviewableItems items={order.reviewable ?? []} />
        </>
      ) : (
        <div className="mt-6" aria-busy="true">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <span className="sr-only">Loading your order…</span>
        </div>
      )}
    </div>
  );
}
