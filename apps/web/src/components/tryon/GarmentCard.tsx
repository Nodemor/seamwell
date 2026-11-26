"use client";

import { Check } from "lucide-react";
import { useRef } from "react";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Price } from "@/components/ui/Price";
import type { ProductCard } from "@/lib/catalog";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

export const SLOT_LABEL = { kit: "Full kit", blazer: "Jacket", shirt: "Shirt", trousers: "Trousers" } as const;

/**
 * A pickable garment. GSAP tilts the INNER card toward the pointer (fine pointers only, no reduced motion);
 * the button itself only has colour/border transitions so CSS never fights the transform.
 */
export function GarmentCard({ product, selected, onToggle, badge }: { product: ProductCard; selected: boolean; onToggle: () => void; badge?: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const ready = !!product.tryonImageUrl;

  useGSAP(
    () => {
      gsap.matchMedia().add(`${MOTION_OK} and (pointer: fine)`, () => {
        const el = btn.current!;
        gsap.set(inner.current, { transformPerspective: 700 });
        const rx = gsap.quickTo(inner.current, "rotationX", { duration: 0.5, ease: "power3.out" });
        const ry = gsap.quickTo(inner.current, "rotationY", { duration: 0.5, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 10);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
        };
        const leave = () => (rx(0), ry(0));
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        return () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        };
      });
    },
    { scope: btn },
  );

  return (
    <button
      ref={btn}
      type="button"
      aria-pressed={selected}
      disabled={!ready}
      onClick={onToggle}
      className="group block w-full rounded-2xl text-left outline-none focus-visible:ring-4 focus-visible:ring-brass/35 disabled:cursor-not-allowed"
    >
      <span
        ref={inner}
        className={cn(
          "relative block h-full rounded-2xl border bg-paper p-2 transition-[border-color,box-shadow]",
          selected ? "border-brass shadow-[0_0_0_2px_var(--sw-brass)]" : "border-line group-hover:border-ink/30",
          !ready && "opacity-60",
        )}
      >
        <span className="relative block aspect-square overflow-hidden rounded-xl bg-ivory">
          <ProductPhoto src={product.images[0]?.url ?? product.tryonImageUrl} alt="" sizes="(min-width: 1280px) 180px, (min-width: 640px) 25vw, 45vw" className="p-2" />
          {badge && <span className="absolute left-1.5 top-1.5 rounded-full bg-midnight px-2 py-0.5 text-[0.65rem] font-medium text-ivory">{badge}</span>}
          <span className={cn("absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full border transition-colors", selected ? "border-brass bg-brass text-ink" : "border-line bg-paper/90 text-transparent")} aria-hidden>
            <Check className="size-3.5" />
          </span>
        </span>
        <span className="mt-2 block px-1 text-[0.68rem] uppercase tracking-wider text-stone">{SLOT_LABEL[product.tryonSlot]}</span>
        <span className="block truncate px-1 text-sm font-medium">{product.name}</span>
        <span className="block px-1 pb-1">
          {ready ? <Price size="sm" cents={product.priceCents} compareAtCents={product.compareAtCents} className="text-xs [&_span]:text-xs [&_span]:font-normal" /> : <span className="text-xs text-stone">Try-on photo coming soon</span>}
        </span>
      </span>
    </button>
  );
}
