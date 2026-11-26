"use client";

import { ExternalLink, PackageCheck } from "lucide-react";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@seamwell/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/Price";
import type { Reviewable } from "@/components/reviews/ReviewableItems";
import { cn } from "@/lib/utils";
import { DEPOSIT_LABEL, rentalSummary } from "@/lib/rental";

/** What the API returns for a tracked order (guest tracking) or one of "my orders". */
export type OrderView = {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "cod" | "bank_transfer";
  paymentStatus: string;
  totalCents: number;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: { productName: string; size: string; quantity: number; mode?: "buy" | "rent"; eventDate?: string | null; rentStart?: string | null; rentEnd?: string | null }[];
  depositCents?: number;
  depositStatus?: "none" | "held" | "refunded" | "kept";
  hasRental?: boolean;
  history: { status: OrderStatus; note: string | null; at: string }[];
  /** Delivered orders: products not reviewed yet. */
  reviewable?: Reviewable[];
};

const FLOW: OrderStatus[] = ["pending_confirmation", "confirmed", "processing", "ready_to_ship", "shipped", "delivered"];

/** Order card: status, progress bar, courier + tracking link, items, total and status history. */
export function OrderDetails({ order, className }: { order: OrderView; className?: string }) {
  // Rental orders have one more step: the pieces come back
  const flow: OrderStatus[] = order.hasRental ? [...FLOW, "returned"] : FLOW;
  const stepIndex = flow.indexOf(order.status === "awaiting_payment" ? "pending_confirmation" : order.status);
  return (
    <div className={cn("rounded-2xl border border-line bg-paper p-6 md:p-8", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl">{order.orderNumber}</h2>
        <Badge variant={order.status === "cancelled" ? "danger" : "success"} className="text-sm">{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>

      {order.status !== "cancelled" && (
        <ol className={cn("mt-8 grid gap-1", flow.length === 7 ? "grid-cols-7" : "grid-cols-6")} aria-label="Order progress">
          {flow.map((s, i) => (
            <li key={s} className="text-center">
              <span className={cn("block h-1.5 rounded-full", i <= stepIndex ? "bg-brass" : "bg-line")} />
              <span className={cn("mt-2 hidden text-[0.7rem] sm:block", i <= stepIndex ? "text-ink" : "text-stone")}>{ORDER_STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ol>
      )}

      {order.status === "awaiting_payment" && <p className="mt-6 rounded-xl bg-brass/10 p-3 text-sm">We&apos;re waiting for your bank transfer. Use your order number as the reference.</p>}

      {order.trackingNumber && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-ivory p-4">
          <div className="flex items-center gap-3">
            <PackageCheck className="h-6 w-6 text-brass" aria-hidden />
            <div>
              <p className="text-sm text-stone">{order.courierName}</p>
              <p className="font-mono font-medium">{order.trackingNumber}</p>
            </div>
          </div>
          {order.trackingUrl && (
            <Button asChild size="sm">
              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                Track with courier <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
              </a>
            </Button>
          )}
        </div>
      )}

      <ul className="mt-8 space-y-1 text-sm">
        {order.items.map((it, i) => (
          <li key={i}>
            {it.quantity} × {it.productName} <span className="text-stone">(size {it.size})</span>
            {it.mode === "rent" && <span className="block text-xs text-brass-ink">Rent · {rentalSummary(it)}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">Total <Price size="sm" cents={order.totalCents} /> · {order.paymentMethod === "cod" ? "Cash on delivery" : "Bank transfer"}</p>
      {!!order.depositCents && (
        <p className="mt-1 text-sm text-stone">
          Includes a <Price size="sm" cents={order.depositCents} className="inline-flex" /> refundable deposit — {DEPOSIT_LABEL[order.depositStatus ?? "held"].toLowerCase()}.
        </p>
      )}

      <h3 className="mt-8 font-sans text-sm font-semibold uppercase tracking-wider text-stone">History</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {order.history.map((h, i) => (
          <li key={i} className="flex justify-between gap-4 border-b border-line pb-2"><span>{ORDER_STATUS_LABEL[h.status]}{h.note ? ` — ${h.note}` : ""}</span><time className="text-stone">{new Date(h.at).toLocaleString("en-LK")}</time></li>
        ))}
      </ul>
    </div>
  );
}
