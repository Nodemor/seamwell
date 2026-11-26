"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/**
 * Kandyan decorations for the Nilame look — original vector art inspired by the painted borders
 * ("walakulu bamma") of Kandyan temples: a liyawela creeper scroll with white lotus buds, a dotted rule and a row
 * of gold bo-leaves, framed by double gold lines. Colours: temple red, gold, saffron and ivory.
 * Animations run only while the look is active and never for reduced-motion visitors.
 */

const GOLD = "#E3AE48";
const SAFFRON = "#E07A2E";
const IVORY = "#FBF3E4";
const DEEP = "#9B2230";
const BAND = "#5E121B";

const TILE = 160;
const TILES = 18; // 2880 wide — sized by height, so wide screens never crop the top of the border
const W = TILE * TILES;
const H = 112;

/** Lotus bud (palapethi) hanging down from (0,0); flip with scale(1,-1) to point up. */
function Bud({ x, y, up }: { x: number; y: number; up?: boolean }) {
  return (
    <g data-k-bud transform={`translate(${x} ${y}) scale(1 ${up ? -1 : 1})`}>
      <path d="M-10 0 C -10 12 -4 19 0 23 C 4 19 10 12 10 0 Z" fill={IVORY} />
      <path d="M0 2 V19 M-5 2 C -5 10 -2 15 0 19 M5 2 C 5 10 2 15 0 19" fill="none" stroke={DEEP} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M-11 0 H11" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
}

/** Bo-leaf (pipal) pendant — heart shape with a drip tip, gold with darker veins. */
function BoLeaf({ x, y }: { x: number; y: number }) {
  return (
    <g data-k-leaf transform={`translate(${x} ${y})`}>
      <path d="M0 5 C -3 -1 -15 -1 -15 9 C -15 19 -6 23 -1 30 L 0 37 L 1 30 C 6 23 15 19 15 9 C 15 -1 3 -1 0 5 Z" fill={GOLD} stroke="#B87A1E" strokeWidth="1" />
      <path d="M0 7 V31 M0 13 L-8 9 M0 13 L8 9 M0 20 L-9 16 M0 20 L9 16" fill="none" stroke="#9A5B12" strokeWidth="1" strokeLinecap="round" />
    </g>
  );
}

function Tile({ x }: { x: number }) {
  return (
    <g>
      {/* liyawela: the creeper wave with curling tendrils and leaves */}
      <path data-k-vine d={`M${x} 36 C ${x + 26} 12 ${x + 54} 12 ${x + 80} 36 S ${x + 134} 60 ${x + 160} 36`} fill="none" stroke={SAFFRON} strokeWidth="3.2" strokeLinecap="round" />
      <path data-k-vine d={`M${x + 40} 18 c 10 -2 16 6 12 13 c -3 6 -12 5 -12 -1 c 0 -4 4 -6 7 -4`} fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" />
      <path data-k-vine d={`M${x + 120} 54 c -10 2 -16 -6 -12 -13 c 3 -6 12 -5 12 1 c 0 4 -4 6 -7 4`} fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" />
      {[
        [x + 16, 29, -38],
        [x + 62, 22, 32],
        [x + 98, 44, 142],
        [x + 144, 50, -148],
      ].map(([lx, ly, r]) => (
        <path key={`${lx}-${ly}`} data-k-leaf d="M0 0 C 6 -6 16 -6 21 0 C 16 6 6 6 0 0 Z" transform={`translate(${lx} ${ly}) rotate(${r})`} fill={SAFFRON} stroke={GOLD} strokeWidth="0.8" />
      ))}
      <Bud x={x} y={9} />
      <Bud x={x + 80} y={61} up />
      {/* dotted rule */}
      {[10, 30, 50, 70, 90, 110, 130, 150].map((d) => (
        <circle key={d} cx={x + d} cy={67} r="2" fill={IVORY} />
      ))}
      {[20, 60, 100, 140].map((d) => (
        <BoLeaf key={d} x={x + d} y={72} />
      ))}
    </g>
  );
}

/** The full-width walakulu bamma band along the bottom of the hero. */
export function KandyanBorder({ active, className }: { active: boolean; className?: string }) {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      if (!active) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        const tl = gsap.timeline({ delay: 0.35 });
        tl.from("[data-k-rule]", { drawSVG: "50% 50%", duration: 1.1, ease: "power2.inOut" })
          .from("[data-k-vine]", { drawSVG: 0, duration: 1.3, stagger: { each: 0.02, from: "center" }, ease: "power1.inOut" }, 0.25)
          .from("[data-k-bud]", { scale: 0, transformOrigin: "50% 0%", duration: 0.55, stagger: { each: 0.03, from: "center" }, ease: "back.out(2)" }, 0.7)
          .from("[data-k-leaf]", { autoAlpha: 0, duration: 0.5, stagger: { each: 0.008, from: "center" } }, 0.8);
      });
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );
  return (
    <svg ref={root} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={cn("block w-full", className)} aria-hidden>
      <rect width={W} height={H} fill={BAND} />
      <path data-k-rule d={`M0 3 H${W} M0 7 H${W}`} stroke={GOLD} strokeWidth="1.6" />
      {Array.from({ length: TILES }, (_, i) => (
        <Tile key={i} x={i * TILE} />
      ))}
      <path data-k-rule d={`M0 105 H${W} M0 109 H${W}`} stroke={GOLD} strokeWidth="1.6" />
    </svg>
  );
}

/** Kandyan lotus medallion behind the Nilame kit (like a painted ceiling "pokuru"): drawn in, then turns slowly. */
export function LotusMedallion({ active, className }: { active: boolean; className?: string }) {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      if (!active) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.timeline({ delay: 0.2 })
          .from("[data-l-ring]", { drawSVG: 0, duration: 1.4, stagger: 0.15, ease: "power2.inOut" })
          .from("[data-l-petal]", { drawSVG: 0, duration: 1.2, stagger: 0.05, ease: "power2.inOut" }, 0.2)
          .from("[data-l-fill], [data-l-dots]", { autoAlpha: 0, duration: 0.8 }, 0.9); // dotted rings fade (DrawSVG would replace their dots)
        gsap.to("[data-l-turn]", { rotation: 360, svgOrigin: "0 0", duration: 90, ease: "none", repeat: -1 });
      });
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );
  return (
    <svg ref={root} viewBox="-100 -100 200 200" className={cn("overflow-visible", className)} aria-hidden>
      <circle data-l-ring r="97" fill="none" stroke={GOLD} strokeOpacity=".55" strokeWidth=".8" />
      <circle data-l-dots r="91" fill="none" stroke={GOLD} strokeOpacity=".35" strokeWidth="2.2" strokeDasharray=".1 5" strokeLinecap="round" />
      <g data-l-turn>
        {Array.from({ length: 8 }, (_, i) => (
          <path key={`o${i}`} data-l-petal transform={`rotate(${i * 45})`} d="M0 -22 C 15 -40 15 -70 0 -88 C -15 -70 -15 -40 0 -22 Z" fill={IVORY} fillOpacity=".07" stroke={IVORY} strokeOpacity=".5" strokeWidth=".9" />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={`i${i}`} data-l-petal transform={`rotate(${i * 45 + 22.5})`} d="M0 -17 C 10 -30 10 -50 0 -63 C -10 -50 -10 -30 0 -17 Z" fill="#C2414E" fillOpacity=".28" stroke={GOLD} strokeOpacity=".6" strokeWidth=".8" />
        ))}
        <g data-l-fill>
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} cx={Math.cos((i * Math.PI) / 6) * 22} cy={Math.sin((i * Math.PI) / 6) * 22} r="1.8" fill={GOLD} fillOpacity=".8" />
          ))}
          <circle r="14" fill={GOLD} fillOpacity=".75" />
          <circle r="7" fill={DEEP} />
        </g>
      </g>
    </svg>
  );
}

/** Small eight-petal flower roundel (a classic Kandyan ceiling flower), used as a corner ornament. */
export function KandyanRoundel({ active, className }: { active: boolean; className?: string }) {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      if (!active) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(root.current, { scale: 0.4, autoAlpha: 0, rotation: -60, transformOrigin: "50% 50%", duration: 1.2, delay: 0.6, ease: "back.out(1.6)" });
      });
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );
  return (
    <svg ref={root} viewBox="-50 -50 100 100" className={className} aria-hidden>
      <circle r="47" fill="#3A0B11" stroke={GOLD} strokeWidth="1.5" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} transform={`rotate(${i * 45})`} d="M0 -6 C 10 -14 12 -30 0 -40 C -12 -30 -10 -14 0 -6 Z" fill={IVORY} stroke={DEEP} strokeWidth=".8" />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <path key={`r${i}`} transform={`rotate(${i * 45 + 22.5})`} d="M0 -8 L0 -24" stroke={DEEP} strokeWidth="1.4" strokeLinecap="round" />
      ))}
      <circle r="7" fill={GOLD} />
      <circle r="3" fill={DEEP} />
    </svg>
  );
}
