"use client";

import { useState } from "react";
import { trackOrderSchema } from "@seamwell/shared";
import { OrderDetails, type OrderView } from "@/components/orders/OrderDetails";
import { ReviewableItems } from "@/components/reviews/ReviewableItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

export function TrackOrder({ initialOrder }: { initialOrder: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // The order number + email that just matched — reused to prove the purchase when writing a review.
  const [proof, setProof] = useState<{ orderNumber: string; email: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = trackOrderSchema.safeParse({ orderNumber: f.get("orderNumber"), email: f.get("email") });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check your details");
    setBusy(true);
    setError("");
    try {
      setOrder((await api<{ order: OrderView }>("/orders/track", { method: "POST", json: parsed.data })).order);
      setProof(parsed.data);
    } catch (err) {
      setOrder(null);
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
        <Input name="orderNumber" defaultValue={initialOrder} placeholder="SW-XXXXXX" aria-label="Order number" aria-invalid={!!error || undefined} aria-describedby={error ? "track-error" : undefined} className="uppercase" />
        <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-label="Email" aria-invalid={!!error || undefined} aria-describedby={error ? "track-error" : undefined} />
        <Button type="submit" loading={busy} className="sm:h-12">
          Track
        </Button>
      </form>
      {error && <p id="track-error" role="alert" className="mt-4 rounded-xl bg-wine/10 p-3 text-sm text-wine">{error}</p>}

      {order && <OrderDetails order={order} className="mt-10" />}
      {order && proof && <ReviewableItems items={order.reviewable ?? []} proof={proof} />}
    </div>
  );
}
