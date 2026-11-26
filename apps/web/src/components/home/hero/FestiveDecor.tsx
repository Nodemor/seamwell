"use client";

import { useId, useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/**
 * Festive decorations for the kurta look — original vector art: a marigold toran (doorway garland), a rangoli,
 * a row of Deepavali diyas with flickering flames over a kolam line, and mehendi paisley line work.
 * Animations run only while the look is active and never for reduced-motion visitors.
 */

const MARIGOLD = "#F28C1B";
const MARIGOLD_LIGHT = "#FFC233";
const LEAF = "#2F7D4F";
const HENNA = "#E9C28A";
const PINK = "#D9468F";

type Opts = { active: boolean; className?: string };

/** Point on a quadratic Bézier. */
const qp = (t: number, a: number, c: number, b: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;

/** Marigold toran: garland swags with flowers and mango-leaf clusters, hung across the top of the kurta. */
export function Toran({ active, className }: Opts) {
  const root = useRef<SVGSVGElement>(null);
  const SWAGS = 4;
  const SW = 100;
  useGSAP(
    () => {
      if (!active) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.timeline({ delay: 0.3 })
          .from("[data-t-rope]", { drawSVG: 0, duration: 1.1, ease: "power2.inOut" })
          .from("[data-t-flower]", { scale: 0, transformOrigin: "50% 50%", duration: 0.4, stagger: { each: 0.018, from: "start" }, ease: "back.out(2.5)" }, 0.3)
          .from("[data-t-leaves]", { scaleY: 0, transformOrigin: "50% 0%", duration: 0.6, stagger: 0.08, ease: "back.out(1.8)" }, 0.6);
        gsap.to("[data-t-leaves]", { rotation: 6, transformOrigin: "50% 0%", duration: 2.2, ease: "sine.inOut", repeat: -1, yoyo: true, stagger: { each: 0.3, from: "random" }, delay: 1.6 });
      });
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );
  const rope = Array.from({ length: SWAGS }, (_, i) => `Q ${i * SW + SW / 2} 44 ${(i + 1) * SW} 6`).join(" ");
  return (
    <svg ref={root} viewBox={`0 -2 ${SWAGS * SW} 80`} className={cn("overflow-visible", className)} aria-hidden>
      <path data-t-rope d={`M0 6 ${rope}`} fill="none" stroke="#8A5A1E" strokeWidth="1.4" />
      {Array.from({ length: SWAGS }, (_, s) =>
        Array.from({ length: 9 }, (_, k) => {
          const t = (k + 1) / 10;
          const x = qp(t, s * SW, s * SW + SW / 2, (s + 1) * SW);
          const y = qp(t, 6, 44, 6);
          const big = k % 2 === 0;
          return (
            <g key={`${s}-${k}`} data-t-flower transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <circle r={big ? 6.4 : 5.4} fill={big ? MARIGOLD : MARIGOLD_LIGHT} />
              <circle r={big ? 3.8 : 3.2} fill={big ? MARIGOLD_LIGHT : MARIGOLD} />
              <circle r="1.3" fill="#B4530F" />
            </g>
          );
        }),
      )}
      {Array.from({ length: SWAGS + 1 }, (_, j) => (
        <g key={j} data-t-leaves transform={`translate(${j * SW} 6)`}>
          {[-14, 0, 14].map((r) => (
            <path key={r} d="M0 0 C 5 8 5 20 0 28 C -5 20 -5 8 0 0 Z" transform={`rotate(${r})`} fill={LEAF} stroke="#1F5A37" strokeWidth=".6" />
          ))}
          <circle cy="4" r="5" fill={MARIGOLD} />
          <path d="M-3 30 H3 L2 36 H-2 Z" fill="#E3AE48" />
        </g>
      ))}
    </svg>
  );
}

/** Rangoli behind the kurta: rings of saffron, pink and marigold petals; drawn in, then turns slowly. */
export function Rangoli({ active, className }: Opts) {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      if (!active) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.timeline({ delay: 0.2 })
          .from("[data-r-ring]", { drawSVG: 0, duration: 1.3, ease: "power2.inOut" })
          .from("[data-r-dots]", { autoAlpha: 0, duration: 1 }, 0.2)
          .from("[data-r-petal]", { scale: 0, transformOrigin: "50% 100%", duration: 0.5, stagger: { each: 0.02, from: "random" }, ease: "back.out(2)" }, 0.3);
        gsap.to("[data-r-turn]", { rotation: -360, svgOrigin: "0 0", duration: 110, ease: "none", repeat: -1 });
      });
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );
  return (
    <svg ref={root} viewBox="-100 -100 200 200" className={cn("overflow-visible", className)} aria-hidden>
      <circle data-r-dots r="98" fill="none" stroke={MARIGOLD_LIGHT} strokeOpacity=".5" strokeWidth="2.4" strokeDasharray=".1 6" strokeLinecap="round" />
      <circle data-r-ring r="67" fill="none" stroke={HENNA} strokeOpacity=".45" strokeWidth=".8" />
      <g data-r-turn>
        {Array.from({ length: 16 }, (_, i) => (
          <g key={`o${i}`} transform={`rotate(${i * 22.5})`}>
            <path data-r-petal d="M0 -68 C 8 -76 8 -88 0 -95 C -8 -88 -8 -76 0 -68 Z" fill="#FFD27A" fillOpacity=".2" stroke={MARIGOLD_LIGHT} strokeOpacity=".9" strokeWidth=".9" />
          </g>
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <g key={`m${i}`} transform={`rotate(${i * 30 + 15})`}>
            <path data-r-petal d="M0 -30 C 12 -40 12 -56 0 -64 C -12 -56 -12 -40 0 -30 Z" fill={PINK} fillOpacity=".42" stroke="#F7B5D6" strokeOpacity=".75" strokeWidth=".8" />
          </g>
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <g key={`i${i}`} transform={`rotate(${i * 45})`}>
            <path data-r-petal d="M0 -9 C 8 -15 8 -24 0 -30 C -8 -24 -8 -15 0 -9 Z" fill={MARIGOLD_LIGHT} fillOpacity=".8" />
          </g>
        ))}
        <circle r="7" fill={MARIGOLD} fillOpacity=".8" />
      </g>
    </svg>
  );
}

// 24 × 120 = 2880 wide: the row is sized by its height, so screens up to 2880 px never crop the flames (wider viewBox = no scale-up).
const DIYAS = 24;
const DW = 120;

/** A row of clay diyas with flickering flames over a dotted kolam line, along the bottom of the hero. */
export function DiyaRow({ active, className }: Opts) {
  const root = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  useGSAP(
    () => {
      if (!active) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.timeline({ delay: 0.35 })
          .from("[data-d-kolam]", { autoAlpha: 0, duration: 0.8 }) // dotted line: fade (DrawSVG would replace its dots)
          .from("[data-d-lamp]", { y: 24, autoAlpha: 0, duration: 0.6, stagger: { each: 0.05, from: "center" }, ease: "power3.out" }, 0.1)
          .from("[data-d-flame]", { scale: 0, transformOrigin: "50% 100%", duration: 0.5, stagger: { each: 0.05, from: "center" }, ease: "back.out(2)" }, 0.5);
        // Flicker: every flame wobbles on its own random rhythm; the glow breathes with it
        gsap.utils.toArray<SVGGElement>("[data-d-flame-inner]").forEach((f) => {
          gsap.to(f, { scaleY: "random(0.86, 1.12)", scaleX: "random(0.9, 1.05)", skewX: "random(-5, 5)", transformOrigin: "50% 100%", duration: "random(0.12, 0.28)", ease: "sine.inOut", repeat: -1, yoyo: true, repeatRefresh: true, delay: 1 });
        });
        gsap.to("[data-d-glow]", { opacity: "random(0.55, 0.95)", duration: "random(0.2, 0.4)", repeat: -1, yoyo: true, repeatRefresh: true, stagger: { each: 0.07, from: "random" }, delay: 1 });
      });
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );
  const W = DIYAS * DW;
  return (
    <svg ref={root} viewBox={`0 0 ${W} 104`} preserveAspectRatio="xMidYMax slice" className={cn("block w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={`${uid}-flame`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6C8" />
          <stop offset=".45" stopColor="#FFC233" />
          <stop offset="1" stopColor="#F0601D" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor="#FFB347" stopOpacity=".55" />
          <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* kolam: a dotted line with small loops */}
      <path data-d-kolam d={`M0 96 H${W}`} stroke={HENNA} strokeOpacity=".55" strokeWidth="2.4" strokeDasharray=".1 9" strokeLinecap="round" />
      {Array.from({ length: DIYAS }, (_, i) => {
        const cx = i * DW + DW / 2;
        return (
          <g key={i} transform={`translate(${cx} 78)`}>
            <circle data-d-glow cy="-28" r="36" fill={`url(#${uid}-glow)`} />
            <g data-d-lamp>
              <path d="M-31 0 C -27 18 27 18 31 0 C 37 -1 40 -5 34 -6 L -34 -6 C -40 -5 -37 -1 -31 0 Z" fill="#B9521F" stroke="#E3AE48" strokeWidth="1.4" />
              <path d="M-22 4 C -10 10 10 10 22 4" fill="none" stroke="#E3AE48" strokeWidth="1.2" strokeDasharray="1 4" strokeLinecap="round" />
              <circle cx="-14" cy="9" r="1.6" fill="#FFC233" />
              <circle cy="11" r="1.6" fill="#FFC233" />
              <circle cx="14" cy="9" r="1.6" fill="#FFC233" />
              <path d="M0 -6 V-10" stroke="#3B2413" strokeWidth="1.6" strokeLinecap="round" />
            </g>
            <g data-d-flame transform="translate(0 -9)">
              <g data-d-flame-inner>
                <path d="M0 -34 C 7 -23 9 -12 0 -1 C -9 -12 -7 -23 0 -34 Z" fill={`url(#${uid}-flame)`} />
                <path d="M0 -20 C 3 -14 4 -8 0 -3 C -4 -8 -3 -14 0 -20 Z" fill="#FFFBE6" fillOpacity=".9" />
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** Mehendi paisley (boteh) line work for the corners. */
export function MehendiPaisley({ active, className }: Opts) {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      if (!active) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.timeline({ delay: 0.5 })
          .from("[data-m-line]", { drawSVG: 0, duration: 1.8, stagger: 0.12, ease: "power1.inOut" })
          .from("[data-m-dot]", { scale: 0, transformOrigin: "50% 50%", duration: 0.3, stagger: 0.02 }, 1);
      });
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );
  return (
    <svg ref={root} viewBox="0 0 220 220" className={cn("overflow-visible", className)} aria-hidden fill="none" stroke={HENNA} strokeLinecap="round" strokeLinejoin="round">
      <path data-m-line strokeWidth="1.8" d="M110 205 C 40 205 18 125 68 84 C 108 52 172 62 182 112 C 190 152 160 178 130 163 C 107 151 112 120 136 117" />
      <path data-m-line strokeWidth="1.2" d="M110 190 C 54 190 36 128 76 95 C 108 70 160 78 168 116 C 174 146 152 164 132 154" />
      <path data-m-line strokeWidth="1.2" d="M86 170 C 64 150 64 118 86 104 C 104 92 128 98 134 118" />
      {/* petals inside the paisley */}
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} data-m-line strokeWidth="1" transform={`rotate(${-60 + i * 30} 100 140)`} d="M100 140 C 106 128 106 116 100 108 C 94 116 94 128 100 140 Z" />
      ))}
      {/* scalloped outer edge */}
      <path data-m-line strokeWidth="1" d="M40 160 q 6 -10 0 -20 q -6 -10 4 -20 q 10 -8 12 -20 q 4 -12 16 -14 q 12 -4 18 -14 q 10 -8 22 -4 q 12 0 20 -8 q 12 -4 20 4 q 10 4 14 16" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 1.6 + Math.PI * 0.55;
        return <circle key={i} data-m-dot cx={110 + Math.cos(a) * 92} cy={128 + Math.sin(a) * 82} r="1.8" fill={HENNA} stroke="none" />;
      })}
    </svg>
  );
}
