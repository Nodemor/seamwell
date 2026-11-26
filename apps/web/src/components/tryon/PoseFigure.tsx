"use client";

import { Check, X } from "lucide-react";
import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { BODY } from "@/components/brand/figure";
import { cn } from "@/lib/utils";



function Figure({ pose = "down", x = 0, scale = 1, className }: { pose?: keyof typeof BODY; x?: number; scale?: number; className?: string }) {
  return (
    <g transform={`translate(${x} 0) scale(${scale})`} className={className} strokeLinejoin="round" strokeLinecap="round">
      <circle data-draw cx="50" cy="22" r="14" />
      <path data-draw d={BODY[pose]} />
    </g>
  );
}

/**
 * The animated "ideal pose" guide in the empty photo box: a dashed frame + an outline figure drawn in with DrawSVG.
 * Reduced motion: it's simply shown.
 */
export function PoseGuide({ className }: { className?: string }) {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        const tl = gsap.timeline({ delay: 0.2 });
        tl.from("[data-corner]", { drawSVG: "50% 50%", duration: 0.6, stagger: 0.08, ease: "power2.inOut" })
          .from("[data-draw]", { drawSVG: 0, duration: 1.6, stagger: 0.25, ease: "power2.inOut" }, "-=0.2")
          .from("[data-feet]", { autoAlpha: 0, y: 6, duration: 0.5 }, "-=0.4");
      });
    },
    { scope: root },
  );
  return (
    <svg ref={root} viewBox="-30 -14 160 290" className={cn("fill-none", className)} aria-hidden>
      <g className="stroke-brass" strokeWidth="2.5" strokeLinecap="round">
        <path data-corner d="M-20 10 V-4 H-6" />
        <path data-corner d="M106 -4 H120 V10" />
        <path data-corner d="M120 252 V266 H106" />
        <path data-corner d="M-6 266 H-20 V252" />
      </g>
      <g strokeWidth="2"><Figure className="stroke-midnight/55" /></g>
      <g data-feet className="fill-brass/70 stroke-none">
        <circle cx="50" cy="-4" r="2.5" />
        <circle cx="50" cy="264" r="2.5" />
      </g>
    </svg>
  );
}

const EXAMPLES = [
  { id: "good", ok: true, label: "Head to feet, arms by your sides" },
  { id: "head", ok: false, label: "Head cut off" },
  { id: "pockets", ok: false, label: "Hands in pockets" },
  { id: "two", ok: false, label: "More than one person" },
] as const;

/** Small good / bad example thumbnails (line pictograms) under the photo box. */
export function PhotoExamples({ className }: { className?: string }) {
  return (
    <ul className={cn("grid grid-cols-4 gap-2", className)} aria-label="Photo examples">
      {EXAMPLES.map((e) => (
        <li key={e.id} className="text-center">
          <span className={cn("relative block overflow-hidden rounded-xl border bg-paper p-1.5", e.ok ? "border-sage/40" : "border-line")}>
            <svg viewBox="-10 -6 120 268" className="mx-auto h-20 w-full fill-none stroke-ink/60 [stroke-width:3]" aria-hidden>
              {e.id === "head" ? (
                <>
                  <defs><clipPath id="sw-cut"><rect x="-10" y="30" width="120" height="240" /></clipPath></defs>
                  <g clipPath="url(#sw-cut)"><Figure /></g>
                  <path d="M-10 30 H110" className="stroke-wine/70" strokeDasharray="6 5" />
                </>
              ) : e.id === "two" ? (
                <>
                  <Figure x={-12} scale={0.62} />
                  <Figure x={50} scale={0.62} />
                </>
              ) : (
                <Figure pose={e.id === "pockets" ? "pockets" : "down"} />
              )}
            </svg>
            <span className={cn("absolute right-1 top-1 grid size-5 place-items-center rounded-full text-ivory", e.ok ? "bg-sage" : "bg-wine")}>
              {e.ok ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
            </span>
          </span>
          <span className="mt-1 block text-[0.68rem] leading-tight text-stone">
            <span className="sr-only">{e.ok ? "Good: " : "Avoid: "}</span>
            {e.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
