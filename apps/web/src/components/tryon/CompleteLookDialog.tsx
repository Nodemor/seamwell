"use client";

import { Check, UserRound } from "lucide-react";
import { useState } from "react";
import { completeTheLook } from "@seamwell/shared";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ProductCard } from "@/lib/catalog";
import { FREE_PASSES_PER_DAY } from "@/lib/tryon/memory";
import { cn } from "@/lib/utils";

export type LookChoice = { shirt?: string | "own"; trousers?: string | "own" };
type Slot = "shirt" | "trousers";

/**
 * "Complete the look": a blazer was picked without a shirt and/or trousers. Suggests pairings
 * (rules in @seamwell/shared → completeTheLook) with "keep my own" options. Recommended items are pre-selected
 * so it's one tap to continue.
 */
export function CompleteLookDialog({ open, onOpenChange, blazer, products, missing, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; blazer: ProductCard | undefined; products: ProductCard[]; missing: Slot[]; onApply: (c: LookChoice) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Complete the look</DialogTitle>
          <DialogDescription>
            {blazer ? `What would you like under the ${blazer.name}?` : "Choose what goes with your jacket."} We&apos;ve picked what goes well — or keep what you&apos;re wearing in the photo. Each piece is one AI pass and the free allowance is about {FREE_PASSES_PER_DAY} a day, so keeping your own is quicker.
          </DialogDescription>
        </DialogHeader>
        {open && blazer && <Chooser blazer={blazer} products={products} missing={missing} onApply={onApply} />}
      </DialogContent>
    </Dialog>
  );
}

function Chooser({ blazer, products, missing, onApply }: { blazer: ProductCard; products: ProductCard[]; missing: Slot[]; onApply: (c: LookChoice) => void }) {
  const ready = products.filter((p) => p.tryonImageUrl).map((p) => ({ ...p, slot: p.tryonSlot }));
  const look = completeTheLook({ ...blazer, slot: blazer.tryonSlot }, ready);
  const lists: Record<Slot, (ProductCard & { recommended: boolean })[]> = { shirt: look.shirts, trousers: look.trousers };
  const [choice, setChoice] = useState<LookChoice>(() =>
    Object.fromEntries(missing.map((s) => [s, lists[s].find((x) => x.recommended)?.id ?? "own"])) as LookChoice,
  );

  return (
    <div className="mt-2 min-w-0 space-y-6">
      {missing.map((slot) => (
        <fieldset key={slot} className="min-w-0">
          <legend className="text-sm font-medium">{slot === "shirt" ? "Shirt" : "Trousers"}</legend>
          <div className="-mx-1 mt-2 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            <Option name={slot} checked={choice[slot] === "own"} onChange={() => setChoice((c) => ({ ...c, [slot]: "own" }))} label={`Keep my own ${slot === "shirt" ? "shirt" : "trousers"}`}>
              <span className="grid aspect-square place-items-center rounded-xl bg-linen text-stone"><UserRound className="size-7" aria-hidden /></span>
            </Option>
            {lists[slot].map((p) => (
              <Option key={p.id} name={slot} checked={choice[slot] === p.id} onChange={() => setChoice((c) => ({ ...c, [slot]: p.id }))} label={p.name} badge={p.recommended ? "Goes well" : undefined}>
                <span className="relative block aspect-square overflow-hidden rounded-xl bg-ivory">
                  <ProductPhoto src={p.images[0]?.url ?? p.tryonImageUrl} alt="" sizes="128px" className="p-1.5" />
                </span>
              </Option>
            ))}
          </div>
          {lists[slot].length === 0 && <p className="text-xs text-stone">No {slot === "shirt" ? "shirts" : "trousers"} to try on yet — we&apos;ll keep yours.</p>}
        </fieldset>
      ))}
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button onClick={() => onApply(choice)}>Use this look</Button>
      </div>
    </div>
  );
}

function Option({ name, checked, onChange, label, badge, children }: { name: string; checked: boolean; onChange: () => void; label: string; badge?: string; children: React.ReactNode }) {
  return (
    <label className={cn("relative w-32 shrink-0 snap-start cursor-pointer rounded-2xl border bg-paper p-1.5 transition-[border-color,box-shadow] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brass/35", checked ? "border-brass shadow-[0_0_0_2px_var(--sw-brass)]" : "border-line hover:border-ink/30")}>
      <input type="radio" name={`look-${name}`} checked={checked} onChange={onChange} className="sr-only" />
      {children}
      {badge && <span className="absolute left-2.5 top-2.5 rounded-full bg-midnight px-2 py-0.5 text-[0.62rem] font-medium text-ivory">{badge}</span>}
      <span className={cn("absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full border", checked ? "border-brass bg-brass text-ink" : "border-line bg-paper text-transparent")} aria-hidden>
        <Check className="size-3" />
      </span>
      <span className="mt-1.5 line-clamp-2 block px-0.5 text-xs leading-snug">{label}</span>
    </label>
  );
}
