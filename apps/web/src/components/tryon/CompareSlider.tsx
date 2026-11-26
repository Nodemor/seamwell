"use client";

import { ChevronsLeftRight } from "lucide-react";
import { useRef, useState } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/**
 * Before / after comparison. The "before" photo sits on top, clipped to the left of the handle.
 * Drag anywhere on the image, or focus the handle and use ←/→ (Shift = bigger steps), Home/End.
 * GSAP reveal: on a new result the divider wipes from the right edge to the middle (reduced motion: starts at 50%).
 */
export function CompareSlider({ before, after, afterAlt, className }: { before: string; after: string; afterAlt: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [ratio, setRatio] = useState(3 / 4);
  const dragging = useRef(false);
  const reveal = useRef<gsap.core.Tween | null>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        const p = { v: 100 };
        setPos(100);
        reveal.current = gsap.to(p, { v: 50, duration: 1.4, delay: 0.25, ease: "power3.inOut", onUpdate: () => setPos(p.v) });
        gsap.fromTo("[data-sheen]", { xPercent: -120, autoAlpha: 1 }, { xPercent: 220, autoAlpha: 0, duration: 1.2, delay: 1.2, ease: "power2.out" });
      });
    },
    { scope: box, dependencies: [after], revertOnUpdate: true },
  );

  const fromPointer = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    const next = { ArrowLeft: pos - step, ArrowDown: pos - step, ArrowRight: pos + step, ArrowUp: pos + step, PageDown: pos - 10, PageUp: pos + 10, Home: 0, End: 100 }[e.key];
    if (next == null) return;
    e.preventDefault();
    reveal.current?.kill();
    setPos(Math.max(0, Math.min(100, next)));
  }

  return (
    <div
      ref={box}
      className={cn("relative w-full touch-pan-y select-none overflow-hidden rounded-[var(--radius-xl)] border border-line bg-paper", className)}
      style={{ aspectRatio: ratio }}
      onPointerDown={(e) => {
        dragging.current = true;
        reveal.current?.kill();
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- generated result (blob URL) */}
      <img src={after} alt={afterAlt} draggable={false} className="absolute inset-0 h-full w-full object-cover" onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 3 / 4)} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- the customer's own photo (blob URL) */}
        <img src={before} alt="" draggable={false} className="h-full w-full object-cover" />
      </div>
      <span data-sheen aria-hidden className="pointer-events-none invisible absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-brass-soft/45 to-transparent" />
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-midnight/75 px-2.5 py-1 text-xs text-ivory" style={{ opacity: pos > 12 ? 1 : 0 }} aria-hidden>Before</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-brass px-2.5 py-1 text-xs font-medium text-ink" style={{ opacity: pos < 88 ? 1 : 0 }} aria-hidden>After</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ivory shadow-[0_0_0_1px_rgb(27_26_24/.15)]" style={{ left: `${pos}%` }} aria-hidden />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Compare before and after"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)}% before photo shown`}
        onKeyDown={onKey}
        className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border border-line bg-paper text-ink shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-brass/45"
        style={{ left: `${pos}%` }}
      >
        <ChevronsLeftRight className="size-5" aria-hidden />
      </div>
    </div>
  );
}
