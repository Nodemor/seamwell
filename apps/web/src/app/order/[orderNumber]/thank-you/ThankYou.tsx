"use client";

import { CheckCircle2, PackageSearch } from "lucide-react";
import Link from "next/link";
import { BankTransferDetails } from "@/components/checkout/BankTransferDetails";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/Price";
import { useLastOrder } from "@/store/last-order";
import { rentalSummary } from "@/lib/rental";

/**
 * Order confirmation. Details come ONLY from the in-memory result of the checkout request:
 * after a refresh (or if someone opens the URL) it shows just the order number and sends them to
 * tracking, which asks for the email — the URL alone never exposes order data.
 */
export function ThankYou({ orderNumber }: { orderNumber: string }) {
  const order = useLastOrder((s) => s.order);
  const trackHref = `/track-order?order=${orderNumber}`;

  if (!order || order.orderNumber !== orderNumber) {
    return (
      <div className="container-sw max-w-xl py-20 text-center">
        <PackageSearch className="mx-auto size-10 text-brass-ink" aria-hidden />
        <h1 className="mt-4 text-4xl">Order {orderNumber}</h1>
        <p className="mt-3 text-stone">For your privacy we only show order details right after checkout. You can see the status, items and tracking any time with your email.</p>
        <Button asChild className="mt-8"><Link href={trackHref}>Track this order</Link></Button>
      </div>
    );
  }

  return (
    <div className="container-sw max-w-2xl py-14 md:py-16">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-sage" aria-hidden />
        <p className="eyebrow mt-4">Thank you</p>
        <h1 className="mt-2 text-[clamp(2.4rem,6vw,3.6rem)] leading-tight">Order placed</h1>
        <p className="mt-3 text-stone">Your order number is</p>
        <p className="mt-1 font-display text-4xl text-midnight">{order.orderNumber}</p>
        <p className="mt-3 text-sm text-stone">
          We&apos;ve emailed a confirmation to <span className="font-medium text-ink">{order.email}</span>.
        </p>
      </div>

      {order.paymentMethod === "bank_transfer" && order.bankTransferDetails && (
        <div className="mt-10">
          <BankTransferDetails details={order.bankTransferDetails} orderNumber={order.orderNumber} totalCents={order.totalCents} />
        </div>
      )}

      <section aria-labelledby="summary-heading" className="mt-10 rounded-[var(--radius-xl)] border border-line bg-paper p-5 sm:p-6">
        <h2 id="summary-heading" className="font-display text-2xl">Summary</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {it.quantity} × {it.productName} <span className="text-stone">(size {it.size})</span>
                {it.mode === "rent" && <span className="block text-xs text-brass-ink">Rent · {rentalSummary(it)}</span>}
              </span>
              <Price size="sm" cents={it.unitPriceCents * it.quantity} className="shrink-0 [&>span]:font-normal" />
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd><Price size="sm" cents={order.subtotalCents} /></dd></div>
          <div className="flex justify-between"><dt className="text-stone">Delivery</dt><dd>{order.shippingCents === 0 ? <span className="text-sage">Free</span> : <Price size="sm" cents={order.shippingCents} />}</dd></div>
          {!!order.depositCents && <div className="flex justify-between"><dt className="text-stone">Refundable deposit</dt><dd><Price size="sm" cents={order.depositCents} /></dd></div>}
          <div className="flex justify-between text-base"><dt className="font-medium">Total</dt><dd><Price cents={order.totalCents} className="font-semibold" /></dd></div>
          <div className="flex justify-between"><dt className="text-stone">Payment</dt><dd>{order.paymentMethod === "cod" ? "Cash on delivery" : "Bank transfer"}</dd></div>
        </dl>
      </section>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild><Link href={trackHref}>Track this order</Link></Button>
        <Button asChild variant="secondary"><Link href="/shop">Continue shopping</Link></Button>
      </div>
    </div>
  );
}
