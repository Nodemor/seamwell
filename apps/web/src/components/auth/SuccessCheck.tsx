"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/** Brass circle + tick that draw themselves (DrawSVG). Static for reduced-motion visitors. */
export function SuccessCheck({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap
          .timeline()
          .from("[data-ring]", { drawSVG: "0%", duration: 0.7, ease: "power2.inOut" })
          .from("[data-tick]", { drawSVG: "0%", duration: 0.45, ease: "power2.out" }, "-=0.15")
          .from(svg.current, { scale: 0.85, duration: 0.6, ease: "back.out(2.5)", transformOrigin: "50% 50%" }, 0);
      });
    },
    { scope: svg },
  );

  return (
    <svg ref={svg} viewBox="0 0 52 52" className={cn("size-16", className)} aria-hidden>
      <circle data-ring cx="26" cy="26" r="24" fill="none" stroke="var(--sw-brass)" strokeWidth="2" />
      <path data-tick d="M15.5 27.5 22.5 34.5 37 19" fill="none" stroke="var(--sw-midnight)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
