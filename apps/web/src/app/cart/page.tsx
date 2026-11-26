"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BagLines } from "@/components/cart/BagLines";
import { BagTotals } from "@/components/cart/BagTotals";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useQuote } from "@/lib/quote";
import { useCart } from "@/store/cart";

const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const hydrated = useHydrated();
  const { quote, loading, error, unavailable, priceChanges } = useQuote(lines, hydrated);
  if (!hydrated) return <div className="container-sw min-h-[50vh] py-12" />;

  return (
    <div className="container-sw py-12">
      <h1 className="text-[clamp(2.4rem,5vw,4rem)] leading-tight">Your bag</h1>
      {lines.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={ShoppingBag}
          title="Your bag is empty"
          description="Find a suit, blazer, shirt or trousers you love — and try it on yourself first."
          action={<Button asChild><Link href="/shop">Browse the collection</Link></Button>}
        />
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <BagLines className="border-y border-line" unavailable={unavailable} priceChanges={priceChanges} />
          <aside className="h-fit rounded-2xl border border-line bg-paper p-6 lg:sticky lg:top-24" aria-label="Bag summary">
            <BagTotals lines={lines} quote={quote} loading={loading} error={error} />
            {unavailable.length > 0 ? (
              <>
                <Button size="lg" block className="mt-6" disabled>Checkout</Button>
                <p role="alert" className="mt-3 text-center text-xs text-wine">Please update the highlighted items to continue.</p>
              </>
            ) : (
              <Button asChild size="lg" block className="mt-6"><Link href="/checkout">Checkout</Link></Button>
            )}
            <p className="mt-3 text-center text-xs text-stone">No account needed · Cash on delivery or bank transfer</p>
          </aside>
        </div>
      )}
    </div>
  );
}
