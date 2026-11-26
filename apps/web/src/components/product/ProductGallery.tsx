"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

type Props = {
  images: { url: string; alt: string }[];
  name: string;
};

/**
 * Product photo gallery.
 * - Thumbnails, prev/next buttons, ← → keys (when the gallery has focus) and touch swipe.
 * - GSAP crossfade between photos; reduced-motion visitors get an instant switch.
 * - Slide visibility is owned by GSAP after mount (React only sets the initial state), so the two never fight.
 */
export function ProductGallery({ images, name }: Props) {
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const count = images.length;

  const go = (i: number) => setIndex(((i % count) + count) % count);

  useGSAP(
    () => {
      const slides = gsap.utils.toArray<HTMLElement>("[data-slide]");
      if (slides.length < 2) return;
      const active = slides[index];
      const others = slides.filter((_, i) => i !== index);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.to(others, { autoAlpha: 0, duration: 0.45, ease: "power2.out", overwrite: true });
        gsap.fromTo(active, { autoAlpha: 0, scale: 1.035 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: "power3.out", overwrite: true });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(others, { autoAlpha: 0 });
        gsap.set(active, { autoAlpha: 1, scale: 1 });
      });
    },
    { scope: root, dependencies: [index] },
  );

  if (count === 0) {
    return (
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-linen">
        <ProductPhoto alt={name} sizes="(min-width: 1024px) 45vw, 100vw" />
      </div>
    );
  }

  return (
    <div ref={root} className="flex flex-col gap-4 lg:flex-row-reverse">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={`${name} photos`}
        tabIndex={count > 1 ? 0 : -1}
        onKeyDown={(e) => {
          if (count < 2) return;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(index + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(index - 1);
          }
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || s.id !== e.pointerId || count < 2) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(e.clientY - s.y)) go(index + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => (swipe.current = null)}
        className="group relative aspect-[4/5] flex-1 touch-pan-y overflow-hidden rounded-[2rem] bg-linen outline-none focus-visible:ring-4 focus-visible:ring-brass/40"
      >
        {images.map((img, i) => (
          <div
            key={img.url}
            data-slide
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            // Initial state only — after mount GSAP owns opacity/visibility.
            style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
            className="absolute inset-0"
          >
            <Image
              src={img.url}
              alt={img.alt || name}
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="select-none object-contain p-6 sm:p-10"
              draggable={false}
            />
          </div>
        ))}

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(index - 1)}
              className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink shadow-sm transition-[opacity,background-color] hover:bg-paper sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(index + 1)}
              className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink shadow-sm transition-[opacity,background-color] hover:bg-paper sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
            {/* Dots for phones */}
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 lg:hidden" aria-hidden>
              {images.map((_, i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition-[width,background-color] duration-300", i === index ? "w-6 bg-midnight" : "w-1.5 bg-midnight/30")} />
              ))}
            </div>
            <p className="sr-only" aria-live="polite">Photo {index + 1} of {count}</p>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="flex gap-3 overflow-x-auto pb-1 lg:w-20 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Choose a photo">
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block aspect-[4/5] w-16 overflow-hidden rounded-xl border-2 bg-linen transition-[border-color,opacity] lg:w-20",
                  i === index ? "border-midnight" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
