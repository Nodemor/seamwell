"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

const STITCHES = 11;
const X0 = 20;
const GAP = 20;
const seamY = (x: number) => 40 + Math.sin((x - X0) / 38) * 7;

/**
 * "Stitching" loader: a needle travels along a seam and each stitch is sewn in with DrawSVG, then the row fades
 * and starts again. Reduced motion: a finished, still row of stitches.
 */
export function StitchLoader({ className }: { className?: string }) {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        const per = 0.22;
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.15, defaults: { ease: "none" } });
        tl.set("[data-stitch]", { drawSVG: 0, autoAlpha: 1 })
          .fromTo("[data-needle]", { x: 0 }, { x: GAP * (STITCHES - 1), duration: per * STITCHES, ease: "none" }, 0)
          .to("[data-stitch]", { drawSVG: "100%", duration: per * 0.9, stagger: per, ease: "power1.inOut" }, 0)
          .fromTo("[data-thread]", { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: per * STITCHES }, 0)
          .to("[data-stitch], [data-thread]", { autoAlpha: 0, duration: 0.45, ease: "power1.in" }, "+=0.35")
          .set("[data-thread]", { autoAlpha: 1, drawSVG: "0% 0%" });
      });
    },
    { scope: root },
  );

  const xs = Array.from({ length: STITCHES }, (_, i) => X0 + i * GAP);
  const seam = xs.map((x, i) => `${i ? "L" : "M"}${x} ${seamY(x).toFixed(1)}`).join(" ");
  return (
    <svg ref={root} viewBox="0 0 240 80" className={cn("h-16 w-48 fill-none", className)} aria-hidden>
      <path d={seam} className="stroke-line" strokeWidth="1" strokeDasharray="2 4" />
      <path data-thread d={seam} className="stroke-brass/35" strokeWidth="1" />
      {xs.map((x) => {
        const y = seamY(x);
        return <path key={x} data-stitch d={`M${x - 5} ${(y - 5).toFixed(1)} L${x + 5} ${(y + 5).toFixed(1)}`} className="stroke-brass" strokeWidth="2.6" strokeLinecap="round" />;
      })}
      <g data-needle>
        <g transform={`translate(${X0} ${seamY(X0) - 6}) rotate(-35)`}>
          <path d="M0 0 L0 -30" className="stroke-midnight" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="0" cy="-26" rx="1.3" ry="3" className="fill-ivory stroke-midnight" strokeWidth="1" />
        </g>
      </g>
    </svg>
  );
}
