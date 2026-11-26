"use client";

import type { OrderQuote } from "@seamwell/shared";
import { Loader2, Truck } from "lucide-react";
import { Price } from "@/components/ui/Price";
import { cn, formatLKR } from "@/lib/utils";
import { type CartLine, cartDeposits, cartSubtotal } from "@/store/cart";

/**
 * Subtotal / delivery / total from the server quote (falls back to the bag's own prices while loading
 * or if the quote can't be fetched). The real order is priced again on the server.
 */
export function BagTotals({ lines, quote, loading, error, className }: { lines: CartLine[]; quote: OrderQuote | null; loading: boolean; error: string | null; className?: string }) {
  const subtotal = quote?.subtotalCents ?? cartSubtotal(lines);
  const deposits = quote?.depositCents ?? cartDeposits(lines);
  const toFree = quote && quote.shippingCents > 0 ? quote.freeShippingThresholdCents - quote.subtotalCents : 0;

  return (
    <div className={cn("text-sm", className)} aria-busy={loading}>
      <dl className="space-y-2">
        <div className="flex justify-between">
          <dt className="text-stone">Subtotal</dt>
          <dd><Price cents={subtotal} /></dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-stone">Delivery</dt>
          <dd>{quote ? (quote.shippingCents === 0 ? <span className="font-medium text-sage">Free</span> : <Price cents={quote.shippingCents} />) : <span className="text-stone">At checkout</span>}</dd>
        </div>
        {deposits > 0 && (
          <div className="flex justify-between">
            <dt className="text-stone">
              Refundable deposit
              <span className="block text-xs">Returned when the rental comes back in good condition</span>
            </dt>
            <dd><Price cents={deposits} /></dd>
          </div>
        )}
        {quote && (
          <div className="flex justify-between border-t border-line pt-3 text-base">
            <dt className="font-medium">Total</dt>
            <dd><Price cents={quote.totalCents} className="font-semibold" /></dd>
          </div>
        )}
      </dl>
      {toFree > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-linen px-3 py-2 text-xs">
          <Truck className="size-4 shrink-0 text-brass-ink" aria-hidden /> Add {formatLKR(toFree)} more for free island-wide delivery.
        </p>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-stone" aria-live="polite">
        {loading ? (
          <>
            <Loader2 className="size-3 animate-spin" aria-hidden /> Checking prices and stock…
          </>
        ) : error ? (
          "We couldn't refresh prices just now — they'll be confirmed when you place the order."
        ) : (
          "Prices and stock checked just now."
        )}
      </p>
    </div>
  );
}
