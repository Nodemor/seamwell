"use client";

import { BadgeCheck, Ruler, Star } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { REVIEW_FIT_LABEL, type ReviewFit } from "@seamwell/shared";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

export type ReviewItem = { id: string; authorName: string; rating: number; title: string | null; body: string; fit: ReviewFit | null; photoUrl: string | null; createdAt: string; verified: boolean };

/** Star breakdown bars. GSAP: each bar grows from the left when it scrolls into view (none for reduced motion). */
export function RatingBars({ breakdown, total }: { breakdown: Record<string, number>; total: number }) {
  const root = useRef<HTMLUListElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from("[data-bar]", {
          scaleX: 0,
          duration: 1.1,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 85%", once: true },
        });
      });
    },
    { scope: root },
  );
  return (
    <ul ref={root} className="mt-6 space-y-2" aria-label="Ratings breakdown">
      {[5, 4, 3, 2, 1].map((s) => {
        const n = breakdown[String(s)] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span className="flex w-8 items-center gap-1 text-stone">{s}<Star className="size-3 fill-brass text-brass" aria-hidden /></span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-linen" aria-hidden>
              {/* no CSS transition here: GSAP animates the transform */}
              <span data-bar className="absolute inset-y-0 left-0 origin-left rounded-full bg-brass" style={{ width: `${pct}%` }} />
            </span>
            <span className="w-10 text-right text-xs text-stone">{n}</span>
            <span className="sr-only">{n} {s}-star {n === 1 ? "review" : "reviews"} ({pct}%)</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Review cards + "Show more". Text is rendered as text (React escapes it) — never as HTML. */
export function ReviewList({ productId, initial, total }: { productId: string; initial: ReviewItem[]; total: number }) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  async function more() {
    setBusy(true);
    try {
      const next = await api<{ reviews: ReviewItem[] }>(`/reviews/product/${productId}?page=${page + 1}`);
      const firstNew = items.length;
      setItems((cur) => [...cur, ...next.reviews.filter((r) => !cur.some((c) => c.id === r.id))]);
      setPage((p) => p + 1);
      // Move focus to the first newly loaded review so keyboard/screen-reader users continue from there
      requestAnimationFrame(() => list.current?.querySelectorAll<HTMLElement>("article")[firstNew]?.focus());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ul ref={list} className="grid gap-5 md:grid-cols-2">
        {items.map((r) => (
          <li key={r.id}>
            <article tabIndex={-1} className="flex h-full flex-col rounded-2xl border border-line bg-paper p-6 outline-none focus-visible:ring-4 focus-visible:ring-brass/30" aria-label={`Review by ${r.authorName}, ${r.rating} out of 5 stars`}>
              <div className="flex items-center justify-between gap-3">
                <p className="flex gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => <Star key={i} className={i < r.rating ? "size-4 fill-brass text-brass" : "size-4 text-line"} />)}
                </p>
                <time className="text-xs text-stone" dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString("en-LK", { month: "short", year: "numeric" })}</time>
              </div>
              {r.title && <h3 className="mt-3 font-sans font-medium">{r.title}</h3>}
              <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-relaxed text-stone">{r.body}</p>
              {r.photoUrl && (
                <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block w-fit overflow-hidden rounded-xl focus-visible:ring-4 focus-visible:ring-brass/30">
                  <Image src={r.photoUrl} alt={`Photo from ${r.authorName}`} width={160} height={200} sizes="160px" className="h-36 w-28 object-cover" />
                  <span className="sr-only">(opens the full photo in a new tab)</span>
                </a>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone">
                <span className="font-medium text-ink">{r.authorName}</span>
                {r.verified && <span className="inline-flex items-center gap-1 text-sage"><BadgeCheck className="size-3.5" aria-hidden /> Verified purchase</span>}
                {r.fit && <span className="inline-flex items-center gap-1"><Ruler className="size-3.5 text-brass" aria-hidden /> {REVIEW_FIT_LABEL[r.fit]}</span>}
              </div>
            </article>
          </li>
        ))}
      </ul>
      {items.length < total && (
        <div className="mt-8 text-center">
          <Button variant="secondary" loading={busy} onClick={() => void more()}>
            Show more reviews ({total - items.length})
          </Button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{page > 1 ? `Showing ${items.length} of ${total} reviews` : ""}</p>
    </div>
  );
}
