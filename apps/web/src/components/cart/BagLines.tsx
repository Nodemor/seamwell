"use client";

import type { OrderQuote } from "@seamwell/shared";
import { AlertCircle, Minus, Plus, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/Price";
import { cn, formatLKR } from "@/lib/utils";
import { dayLabel, rentalSummary } from "@/lib/rental";
import { lineKey, useCart } from "@/store/cart";

const UNAVAILABLE_TEXT: Record<OrderQuote["unavailable"][number]["reason"], string> = {
  sold_out: "Sold out in this size — please remove it.",
  not_enough_stock: "We don't have this many — try fewer.",
  not_found: "No longer available — please remove it.",
  not_rentable: "This piece can't be rented any more — please remove it.",
  not_available_dates: "Already booked around your event date — remove it and pick another date or size.",
  invalid_date: "That event date can't be booked — remove it and choose a new date.",
};

type Props = {
  className?: string;
  compact?: boolean;
  onNavigate?: () => void;
  /** From useQuote: per-line warnings (price changed / sold out / not enough stock). */
  unavailable?: OrderQuote["unavailable"];
  priceChanges?: Record<string, number>;
};

/** Bag line items with quantity stepper + remove. Shared by the /cart page and the mobile bag sheet. */
export function BagLines({ className, compact = false, onNavigate, unavailable = [], priceChanges = {} }: Props) {
  const { lines, setQty, remove } = useCart();

  return (
    <ul className={cn("divide-y divide-line", className)}>
      {lines.map((l) => (
        <li key={l.key} className="flex gap-4 py-5">
          <div className={cn("relative shrink-0 overflow-hidden rounded-xl bg-linen", compact ? "h-24 w-20" : "h-28 w-24")}>
            <ProductPhoto src={l.imageUrl} alt={l.name} sizes="96px" className="p-2" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
            <div className="flex justify-between gap-4">
              <div className="min-w-0">
                <Link href={`/product/${l.productSlug}`} onClick={onNavigate} className="font-medium hover:underline">{l.name}</Link>
                <p className="text-sm text-stone">Size {l.size}</p>
                {l.mode === "rent" && (
                  <p className="mt-1 text-xs text-brass-ink">
                    <span className="mr-1.5 rounded-full bg-brass/15 px-1.5 py-0.5 font-medium">Rent</span>
                    {rentalSummary(l) || (l.eventDate ? `Event ${dayLabel(l.eventDate)}` : "")}
                    {!!l.depositCents && <span className="block text-stone">+ {formatLKR(l.depositCents * l.quantity)} refundable deposit</span>}
                  </p>
                )}
              </div>
              <Price cents={l.unitPriceCents * l.quantity} className="shrink-0" />
            </div>
            {(() => {
              const u = unavailable.find((x) => lineKey(x) === l.key);
              if (u) {
                return (
                  <p role="status" className="flex items-start gap-1.5 text-xs text-wine">
                    <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden /> {UNAVAILABLE_TEXT[u.reason]}
                  </p>
                );
              }
              const was = priceChanges[l.key];
              if (was !== undefined) {
                return (
                  <p role="status" className="flex items-start gap-1.5 text-xs text-brass-ink">
                    <Tag className="mt-px size-3.5 shrink-0" aria-hidden /> Price updated — was {formatLKR(was)}, now {formatLKR(l.unitPriceCents)} each.
                  </p>
                );
              }
              return null;
            })()}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center rounded-full border border-line bg-paper" role="group" aria-label={`Quantity of ${l.name}`}>
                <Button variant="ghost" size="icon-sm" aria-label="Decrease quantity" disabled={l.quantity <= 1} onClick={() => setQty(l.key, l.quantity - 1)}><Minus className="size-3.5" /></Button>
                <span className="w-6 text-center text-sm" aria-live="polite">{l.quantity}</span>
                <Button variant="ghost" size="icon-sm" aria-label="Increase quantity" disabled={l.quantity >= (l.mode === "rent" ? 3 : 10)} onClick={() => setQty(l.key, l.quantity + 1)}><Plus className="size-3.5" /></Button>
              </div>
              <Button variant="ghost" size={compact ? "icon-sm" : "sm"} onClick={() => remove(l.key)} className="text-stone hover:text-wine" aria-label={`Remove ${l.name} from bag`}>
                <Trash2 aria-hidden /> {!compact && "Remove"}
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
