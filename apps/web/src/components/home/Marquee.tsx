"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "@/lib/gsap";

const ITEMS = ["Made to measure", "Super 120s wool", "Free alterations", "Virtual try-on", "Island-wide delivery", "Cash on delivery", "Pure linen", "Hand-finished buttonholes"];

/** Dark band on the light page: an endless marquee that speeds up and flips direction with your scroll. */
export function Marquee() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        const loop = gsap.to("[data-track]", { xPercent: -50, ease: "none", duration: 28, repeat: -1 });
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const v = gsap.utils.clamp(-4, 4, self.getVelocity() / 250);
            gsap.to(loop, { timeScale: self.direction * Math.max(1, Math.abs(v)), duration: 0.4, overwrite: true });
          },
        });
      });
    },
    { scope: root },
  );

  const row = [...ITEMS, ...ITEMS];
  return (
    <div ref={root} className="overflow-hidden bg-midnight py-5 text-ivory" aria-label="Seamwell highlights">
      <div data-track className="flex w-max items-center gap-10 whitespace-nowrap">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-2xl italic md:text-3xl" aria-hidden={i >= ITEMS.length}>
            {t}
            <span className="text-brass not-italic">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
