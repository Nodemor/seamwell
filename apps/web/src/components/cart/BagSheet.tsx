"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { BagLines } from "@/components/cart/BagLines";
import { BagTotals } from "@/components/cart/BagTotals";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuote } from "@/lib/quote";
import { cartCount, useCart } from "@/store/cart";

/**
 * Slide-in bag for phones/tablets (< lg). Desktop keeps the /cart page.
 * Radix Dialog underneath: focus is trapped, Esc / overlay click closes, focus returns to the bag icon.
 */
export function BagSheet({ open, onOpenChange, returnFocusRef }: { open: boolean; onOpenChange: (open: boolean) => void; returnFocusRef?: React.RefObject<HTMLElement | null> }) {
  const lines = useCart((s) => s.lines);
  const count = cartCount(lines);
  const close = () => onOpenChange(false);
  // Only quote while the sheet is open (the endpoint is rate-limited).
  const { quote, loading, error, unavailable, priceChanges } = useQuote(lines, open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby="bag-sheet-desc"
        // The sheet has no Radix Trigger (the bag icon is a /cart link), so hand focus back to it explicitly.
        onCloseAutoFocus={(e) => {
          if (!returnFocusRef?.current) return;
          e.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>Your bag</SheetTitle>
          <SheetDescription id="bag-sheet-desc">{count ? `${count} item${count > 1 ? "s" : ""}` : "Nothing here yet"}</SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 items-center p-5">
            <EmptyState
              className="w-full border-0 bg-transparent"
              icon={ShoppingBag}
              title="Your bag is empty"
              description="Find something you love — and try it on first."
              action={<Button asChild onClick={close}><Link href="/shop">Browse the collection</Link></Button>}
            />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              <BagLines compact onNavigate={close} unavailable={unavailable} priceChanges={priceChanges} />
            </div>
            <SheetFooter>
              <BagTotals lines={lines} quote={quote} loading={loading} error={error} />
              {unavailable.length > 0 ? (
                <Button size="lg" block className="mt-2" disabled>Update your bag to continue</Button>
              ) : (
                <Button asChild size="lg" block className="mt-2" onClick={close}><Link href="/checkout">Checkout</Link></Button>
              )}
              <Button asChild variant="link" block size="sm" onClick={close}><Link href="/cart">View full bag</Link></Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
