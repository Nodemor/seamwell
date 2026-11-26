"use client";

import { ScanFace } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/**
 * The signature "Try it on virtually" button:
 * rotating brass ring + pulsing live dot + shimmer sweep + magnetic hover (GSAP quickTo).
 * Used on the left of the hero and (compact) in the navbar.
 */
export function TryOnButton({ size = "lg", className, label = "Try it on virtually", href = "/try-on" }: { size?: "lg" | "sm"; className?: string; label?: string; href?: string }) {
  const wrap = useRef<HTMLAnchorElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and (pointer: fine)`, () => {
        const el = wrap.current!;
        const xTo = gsap.quickTo(inner.current, "x", { duration: 0.5, ease: "elastic.out(1, 0.4)" });
        const yTo = gsap.quickTo(inner.current, "y", { duration: 0.5, ease: "elastic.out(1, 0.4)" });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * 0.18);
          yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
        };
        const leave = () => {
          xTo(0);
          yTo(0);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        return () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        };
      });
    },
    { scope: wrap },
  );

  const lg = size === "lg";
  return (
    <Link
      ref={wrap}
      href={href}
      className={cn("group relative inline-flex rounded-full p-[2px] outline-offset-4", className)}
      style={{
        background: "conic-gradient(from var(--sw-angle), var(--sw-brass), #f3e3c3, var(--sw-midnight-2), var(--sw-brass))",
        animation: "sw-spin 4s linear infinite",
      }}
    >
      <span
        ref={inner}
        className={cn(
          "relative inline-flex items-center overflow-hidden rounded-full bg-midnight font-medium text-ivory shadow-[0_10px_30px_-10px_rgb(31_42_68/.65)] transition-colors duration-300 group-hover:bg-midnight-2",
          lg ? "gap-3 py-3.5 pl-4 pr-6 text-[0.95rem]" : "gap-2 py-1.5 pl-2.5 pr-3.5 text-[0.8rem]",
        )}
      >
        {/* shimmer sweep */}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: "sw-shimmer 2.8s ease-in-out infinite" }} />
        <span className={cn("relative grid place-items-center rounded-full bg-brass/20 text-brass-soft", lg ? "h-8 w-8" : "h-5 w-5")}>
          <ScanFace className={lg ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} aria-hidden />
          {/* live dot */}
          <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brass">
            <span className="absolute inset-0 rounded-full bg-brass" style={{ animation: "sw-pulse 1.8s ease-out infinite" }} />
          </span>
        </span>
        <span className="relative whitespace-nowrap">{label}</span>
        {lg && <span className="relative rounded-full bg-brass px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-ink">Free</span>}
      </span>
    </Link>
  );
}
