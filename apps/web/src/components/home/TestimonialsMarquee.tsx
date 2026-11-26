"use client";

import { BadgeCheck, Pause, Play, Star } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export type Testimonial = { id: string; authorName: string; rating: number; title: string | null; body: string; productName: string; productSlug: string; createdAt: string };

const clip = (s: string, n = 190) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s);

/**
 * Two rows of review cards drifting in opposite directions (GSAP loop on the TRACK; the cards have only colour
 * transitions). Hover or focus pauses; a pause button covers WCAG 2.2.2. Reduced motion: a static, swipeable row.
 * Review text is rendered as plain text (React escapes it).
 */
export function TestimonialsMarquee({ reviews }: { reviews: Testimonial[] }) {
  const root = useRef<HTMLElement>(null);
  const loops = useRef<gsap.core.Tween[]>([]);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const half = Math.ceil(reviews.length / 2);
  const rows = [reviews.slice(0, half), reviews.slice(half).length ? reviews.slice(half) : reviews.slice(0, half)];

  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        loops.current = gsap.utils.toArray<HTMLElement>("[data-t-track]").map((t, i) =>
          gsap.fromTo(t, { xPercent: i % 2 ? -50 : 0 }, { xPercent: i % 2 ? 0 : -50, ease: "none", duration: 60 + i * 12, repeat: -1 }),
        );
        return () => (loops.current = []);
      });
    },
    { scope: root },
  );

  const hold = (on: boolean) => !paused && loops.current.forEach((l) => l.paused(on));
  const toggle = () => {
    setPaused((p) => {
      loops.current.forEach((l) => l.paused(!p));
      return !p;
    });
  };

  return (
    <section ref={root} className="overflow-hidden bg-linen/60 py-20" aria-labelledby="reviews-title">
      <div className="container-sw flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">From our customers</p>
          <h2 id="reviews-title" className="mt-3 text-[clamp(2.2rem,4.5vw,3.6rem)] leading-tight">Fitted, worn, reviewed</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="flex items-center gap-1.5 text-sm text-stone"><BadgeCheck className="size-4 text-sage" aria-hidden /> Verified purchases only</p>
          {!reduced && (
            <button type="button" onClick={toggle} aria-label={paused ? "Play the reviews" : "Pause the reviews"} className="grid size-11 place-items-center rounded-full border border-line bg-paper text-stone outline-none transition-colors hover:text-ink focus-visible:ring-4 focus-visible:ring-brass/40">
              {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
            </button>
          )}
        </div>
      </div>

      <div className="mt-10 space-y-5" onPointerEnter={() => hold(true)} onPointerLeave={() => hold(false)} onFocus={() => hold(true)} onBlur={() => hold(false)}>
        {rows.map((row, ri) => (
          <div key={ri} className={reduced ? "overflow-x-auto px-[max(1.1rem,calc((100vw-1320px)/2+2.5rem))] pb-2" : undefined}>
            <ul data-t-track className="flex w-max gap-5" aria-label={`Customer reviews, row ${ri + 1}`}>
              {(reduced ? row : [...row, ...row]).map((r, i) => {
                const copy = !reduced && i >= row.length;
                return (
                  <li key={`${r.id}-${i}`} aria-hidden={copy || undefined} className="w-[19rem] shrink-0 sm:w-[23rem]">
                    <figure className="flex h-full flex-col rounded-[var(--radius-xl)] border border-line bg-paper p-6 transition-colors hover:border-brass/60">
                      <p className="flex gap-0.5" role="img" aria-label={`${r.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }, (_, s) => <Star key={s} className={s < r.rating ? "size-4 fill-brass text-brass" : "size-4 text-line"} aria-hidden />)}
                      </p>
                      <blockquote className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-ink/90">
                        {r.title && <p className="font-medium text-ink">{r.title}</p>}
                        <p className={r.title ? "mt-1" : undefined}>&ldquo;{clip(r.body)}&rdquo;</p>
                      </blockquote>
                      <figcaption className="mt-4 text-sm">
                        <span className="font-medium text-ink">{r.authorName}</span>
                        <span className="text-stone"> · </span>
                        <Link href={`/product/${r.productSlug}`} tabIndex={copy ? -1 : undefined} className="text-stone underline-offset-4 hover:text-ink hover:underline">{r.productName}</Link>
                      </figcaption>
                    </figure>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
