"use client";

import { ArrowRight, ScanFace } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

/** Curated outfits (real catalogue photos). Each links to the product and straight into the try-on. */
const LOOKS = [
  { slug: "men-black-tuxedo-three-piece", img: "black-tuxedo-three-piece", title: "Black tie", note: "Tuxedo three-piece · for galas and evening weddings", tone: "#E9E4DA" },
  { slug: "men-royal-red-nilame-kit", img: "royal-red-nilame-kit", title: "The Kandyan groom", note: "Royal Red Nilame kit · for the Poruwa ceremony", tone: "#F1DCD6" },
  { slug: "men-midnight-navy-two-piece-suit", img: "midnight-navy-two-piece-suit", title: "Boardroom navy", note: "Two-piece suit · Super 120s wool", tone: "#DDE2EC" },
  { slug: "men-navy-embroidered-kurta-set", img: "navy-embroidered-kurta-set", title: "Deepavali night", note: "Navy kurta set · gold paisley embroidery", tone: "#E3E1F0" },
  { slug: "men-ivory-dinner-suit", img: "ivory-dinner-suit", title: "Galle Face evening", note: "Ivory dinner suit · for sunset receptions", tone: "#F2EEE4" },
  { slug: "women-magenta-silk-kurta-set", img: "magenta-silk-kurta-set", title: "Mehendi evening", note: "Magenta silk kurta set", tone: "#F2DCE8" },
  { slug: "men-grey-tweed-blazer", img: "grey-tweed-blazer", title: "Hill-country weekend", note: "Grey tweed blazer · for Nuwara Eliya evenings", tone: "#E6E4DF" },
] as const;

/**
 * Lookbook: on desktop (motion allowed) the section pins and the row of looks scrolls sideways as you scroll down
 * (ScrollTrigger pin + scrub); each photo eases into place using containerAnimation. On touch screens and with reduced
 * motion it's a normal swipeable row with scroll-snap.
 */
export function Lookbook() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add(`${MOTION_OK} and (min-width: 1024px) and (pointer: fine)`, () => {
        const el = track.current!;
        // Pinned mode: the row is moved by GSAP, not scrolled (reverted automatically when this media query stops matching)
        gsap.set(el, { overflow: "visible", scrollSnapType: "none", paddingBottom: 0 });
        const frame = el.parentElement!; // clips the row at the content edges (no padding)
        const distance = () => Math.max(0, el.scrollWidth - frame.clientWidth);
        const slide = gsap.to(el, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: { trigger: root.current, pin: true, scrub: 0.8, start: "top top", end: () => `+=${distance()}`, invalidateOnRefresh: true },
        });
        gsap.utils.toArray<HTMLElement>("[data-look-img]").forEach((img) => {
          gsap.fromTo(img, { scale: 1.14, xPercent: 6 }, { scale: 1, xPercent: 0, ease: "none", scrollTrigger: { trigger: img, containerAnimation: slide, start: "left right", end: "center center", scrub: true } });
        });
        gsap.from("[data-look-progress]", { scaleX: 0, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, scrub: true } });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="overflow-hidden bg-ivory py-20 lg:flex lg:h-svh lg:flex-col lg:justify-center lg:py-10" aria-labelledby="lookbook-title">
      <div className="container-sw flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Lookbook</p>
          <h2 id="lookbook-title" className="mt-3 text-[clamp(2.2rem,4.5vw,3.6rem)] leading-tight">Seven looks, one atelier</h2>
        </div>
        <p className="max-w-sm text-stone">From black tie to the Poruwa — tap a look to see it on yourself in the Virtual Try-On.</p>
      </div>

      {/* Desktop: the row is framed by the content width (same edges as the heading) and shows exactly 3 looks;
          phones/tablets: an edge-to-edge swipe row. @container lets the cards size from the frame's real width. */}
      <div className="mt-10 w-full lg:mx-auto lg:mt-12 lg:max-w-[1320px] lg:px-10">
        <div className="@container lg:overflow-hidden">
        <ul ref={track} className="relative flex snap-x snap-mandatory gap-5 overflow-x-auto px-[max(1.1rem,calc((100vw-1320px)/2+2.5rem))] pb-4 lg:px-0" aria-label="Outfits">
          {LOOKS.map((l, i) => (
            <li key={l.slug} className="relative w-[78vw] max-w-[22rem] shrink-0 snap-start sm:w-[20rem] lg:w-[calc((100cqw_-_2.5rem)_/_3)] lg:max-w-none">
              <article className="group flex h-full flex-col">
                <Link href={`/product/${l.slug}`} className="relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-xl)] outline-none focus-visible:ring-4 focus-visible:ring-brass/40" style={{ background: l.tone }}>
                  <span data-look-img className="absolute inset-0 block">
                    <Image src={`/catalog/${l.img}.webp`} alt="" fill sizes="(min-width: 1024px) 368px, 78vw" className="object-contain p-6 drop-shadow-[0_18px_24px_rgb(31_42_68/0.18)]" />
                  </span>
                  <span className="absolute left-4 top-4 rounded-full bg-paper/85 px-3 py-1 text-xs font-medium text-ink backdrop-blur">{String(i + 1).padStart(2, "0")}</span>
                  <span className="sr-only">{l.title} — view the product</span>
                </Link>
                <h3 className="mt-4 font-sans text-lg font-medium">{l.title}</h3>
                <p className="mt-1 flex-1 text-sm text-stone">{l.note}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <Link href={`/try-on?product=${l.slug}`} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-midnight underline-offset-4 hover:underline sm:min-h-0">
                    <ScanFace className="size-4 text-brass" aria-hidden /> Try it on<span className="sr-only">: {l.title}</span>
                  </Link>
                  <Link href={`/product/${l.slug}`} className="inline-flex min-h-11 items-center gap-1 text-stone underline-offset-4 hover:text-ink hover:underline sm:min-h-0">
                    Shop<span className="sr-only"> {l.title}</span> <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
        </div>
      </div>

      <div className="container-sw mt-8 hidden lg:block" aria-hidden>
        <div className="h-px bg-line">
          <div data-look-progress className="h-px origin-left bg-brass" />
        </div>
      </div>
    </section>
  );
}
