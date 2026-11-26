"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, SplitText, useGSAP } from "@/lib/gsap";

const STATS = [
  { value: 27, suffix: "", label: "Years of tailoring" },
  { value: 18, suffix: "k+", label: "Garments made" },
  { value: 4.9, suffix: "", label: "Average rating", decimals: 1 },
];

/** Scroll-scrubbed word reveal + counting stats. */
const QUOTE =
  "Every Seamwell piece is cut by hand in our Colombo atelier, fitted on real people, and finished with the small details you feel before you see — so it fits like it was always yours.";

export function CraftStory() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        // aria "none": the visual copy is aria-hidden and a screen-reader copy sits next to it (aria-label is not allowed on <p>).
        const split = SplitText.create("[data-craft-quote]", { type: "words", aria: "none" });
        gsap.fromTo(
          split.words,
          { opacity: 0.5 }, // ≥3:1 for this large text even before the reveal
          { opacity: 1, stagger: 0.05, ease: "none", scrollTrigger: { trigger: "[data-craft-quote]", start: "top 80%", end: "bottom 45%", scrub: true } },
        );
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const target = Number(el.dataset.count);
          const decimals = Number(el.dataset.decimals ?? 0);
          const obj = { v: 0 };
          gsap.to(obj, {
            v: target,
            duration: 1.8,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
            onUpdate: () => (el.textContent = obj.v.toFixed(decimals)),
          });
        });
        return () => split.revert();
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="container-sw py-28 text-center">
      <p className="eyebrow">The atelier</p>
      <p className="sr-only">{QUOTE}</p>
      <p data-craft-quote aria-hidden="true" className="mx-auto mt-6 max-w-5xl text-balance font-display text-[clamp(1.9rem,4.2vw,3.6rem)] leading-[1.15] text-ink">
        {QUOTE}
      </p>
      <dl className="mx-auto mt-16 grid max-w-5xl gap-10 border-t border-line pt-10 sm:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.label} data-reveal>
            <dt className="text-sm text-stone">{s.label}</dt>
            <dd className="mt-2 font-display text-6xl text-midnight">
              <span data-count={s.value} data-decimals={s.decimals ?? 0}>
                {s.decimals ? s.value.toFixed(s.decimals) : s.value}
              </span>
              {s.suffix}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
