"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

const INTERACTIVE = "a, button, [role='button'], [role='slider'], [role='radio'], label, input, select, textarea, summary";

/**
 * Desktop-only cursor accent: a small brass dot with a trailing ring that grows over links and buttons.
 * The normal system cursor stays visible (it's an accent, not a replacement). Never shown on touch screens or for
 * reduced-motion visitors — the elements stay hidden unless the media query matches.
 */
export function CursorDot() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.matchMedia().add(`${MOTION_OK} and (pointer: fine) and (hover: hover)`, () => {
      const d = dot.current!;
      const r = ring.current!;
      gsap.set([d, r], { xPercent: -50, yPercent: -50, autoAlpha: 0 });
      const dx = gsap.quickTo(d, "x", { duration: 0.12, ease: "power3.out" });
      const dy = gsap.quickTo(d, "y", { duration: 0.12, ease: "power3.out" });
      const rx = gsap.quickTo(r, "x", { duration: 0.45, ease: "power3.out" });
      const ry = gsap.quickTo(r, "y", { duration: 0.45, ease: "power3.out" });
      let shown = false;
      let over = false;

      const move = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        if (!shown) {
          shown = true;
          gsap.set([d, r], { x: e.clientX, y: e.clientY });
          gsap.to([d, r], { autoAlpha: 1, duration: 0.25 });
        }
        dx(e.clientX);
        dy(e.clientY);
        rx(e.clientX);
        ry(e.clientY);
        const hit = !!(e.target as Element | null)?.closest?.(INTERACTIVE);
        if (hit !== over) {
          over = hit;
          gsap.to(r, { scale: hit ? 1.7 : 1, borderColor: hit ? "rgb(176 141 87 / .9)" : "rgb(176 141 87 / .45)", duration: 0.3, ease: "power3.out" });
          gsap.to(d, { scale: hit ? 0.5 : 1, duration: 0.3 });
        }
      };
      const leave = () => {
        shown = false;
        gsap.to([d, r], { autoAlpha: 0, duration: 0.2 });
      };
      const down = () => gsap.to(r, { scale: over ? 1.4 : 0.8, duration: 0.15, yoyo: true, repeat: 1 });

      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerdown", down, { passive: true });
      document.documentElement.addEventListener("pointerleave", leave);
      return () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerdown", down);
        document.documentElement.removeEventListener("pointerleave", leave);
      };
    });
  });

  return (
    <>
      <div ref={ring} aria-hidden className="pointer-events-none invisible fixed left-0 top-0 z-[90] size-8 rounded-full border border-brass/45" />
      <div ref={dot} aria-hidden className="pointer-events-none invisible fixed left-0 top-0 z-[90] size-2 rounded-full bg-brass" />
    </>
  );
}
