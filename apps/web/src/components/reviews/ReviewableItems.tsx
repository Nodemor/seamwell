"use client";

import { PenLine, Star } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { type ReviewProduct, ReviewForm, type ReviewProof } from "@/components/reviews/ReviewForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type Reviewable = { productId: string; productName: string; slug: string; imageUrl: string | null };

/** "Review your items" panel under a delivered order (account order page and guest tracking). */
export function ReviewableItems({ items, proof }: { items: Reviewable[]; proof?: ReviewProof }) {
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState<ReviewProduct | null>(null);
  const left = items.filter((i) => !done.includes(i.productId));
  if (!items.length) return null;

  return (
    <section aria-labelledby="review-items-h" className="mt-6 rounded-2xl border border-brass/40 bg-brass/5 p-5 sm:p-6">
      <h2 id="review-items-h" className="flex items-center gap-2 font-sans text-lg font-medium">
        <Star className="size-5 fill-brass text-brass" aria-hidden /> How did we do?
      </h2>
      <p className="mt-1 text-sm text-stone">{left.length ? "Your order was delivered — a short review helps other customers choose their size." : "Thank you for your reviews!"}</p>
      {left.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {left.map((i) => (
            <li key={i.productId} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-linen">
                {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.productName}</span>
              <Button size="sm" variant="secondary" onClick={() => setOpen({ id: i.productId, name: i.productName, imageUrl: i.imageUrl })} aria-label={`Write a review of ${i.productName}`}>
                <PenLine aria-hidden /> Review
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Write a review</DialogTitle>
            <DialogDescription>Verified purchase — shown with your first name and last initial.</DialogDescription>
          </DialogHeader>
          {open && <ReviewForm product={open} proof={proof} onDone={() => setDone((d) => [...d, open.id])} onCancel={() => setOpen(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
