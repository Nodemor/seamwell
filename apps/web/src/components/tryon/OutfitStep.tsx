"use client";

import { Shirt, Sparkles, X } from "lucide-react";
import Link from "next/link";
import type { TryOnSlot } from "@seamwell/shared";
import { GarmentCard, SLOT_LABEL } from "@/components/tryon/GarmentCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductCard } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export type Gender = "men" | "women";
export type Picked = Partial<Record<TryOnSlot, string>>;
export type KeepOwn = { shirt?: boolean; trousers?: boolean };
const TRADITIONAL = ["nilame", "kurtas", "sarees", "salwar"];
/** Try-on filters. Nilame kits, kurtas, sarees and salwar sets are full kits (one pass) shown under "Wedding & festive"; frocks have their own filter. */
export const CATEGORIES = [
  { id: "all", label: "All", match: () => true },
  { id: "jackets", label: "Suits & jackets", match: (p: ProductCard) => (p.tryonSlot === "kit" || p.tryonSlot === "blazer") && !TRADITIONAL.includes(p.categorySlug) && p.categorySlug !== "frocks" },
  { id: "shirts", label: "Shirts", match: (p: ProductCard) => p.tryonSlot === "shirt" },
  { id: "trousers", label: "Trousers", match: (p: ProductCard) => p.tryonSlot === "trousers" },
  { id: "traditional", label: "Wedding & festive", match: (p: ProductCard) => TRADITIONAL.includes(p.categorySlug) },
  { id: "frocks", label: "Frocks", match: (p: ProductCard) => p.categorySlug === "frocks" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];

type Props = {
  products: ProductCard[] | null;
  gender: Gender;
  onGender: (g: Gender) => void;
  category: CategoryId;
  onCategory: (c: CategoryId) => void;
  picked: Picked;
  keepOwn: KeepOwn;
  onToggle: (p: ProductCard) => void;
  onRemove: (slot: TryOnSlot) => void;
  onKeepOwn: (slot: "shirt" | "trousers", keep: boolean) => void;
  onCompleteLook: () => void;
  needsLook: boolean;
  /** Shown when the look needs more AI passes than are likely left in the free daily allowance. */
  budgetNote?: string;
};

function Toggle<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: readonly { id: T; label: string; count?: number }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn("flex gap-1 rounded-full bg-linen p-1", className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm transition-colors outline-none focus-visible:ring-4 focus-visible:ring-brass/35 sm:h-9",
            value === o.id ? "bg-paper text-ink shadow-sm" : "text-stone hover:text-ink",
          )}
        >
          {o.label}
          {o.count != null && <span className="text-xs text-stone">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Step 2: gender + category filters, garment cards and the "your outfit" tray. */
export function OutfitStep({ products, gender, onGender, category, onCategory, picked, keepOwn, onToggle, onRemove, onKeepOwn, onCompleteLook, needsLook, budgetNote }: Props) {
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const cat = CATEGORIES.find((c) => c.id === category)!;
  const shown = (products ?? []).filter(cat.match);
  const slots: TryOnSlot[] = picked.kit ? ["kit"] : ["blazer", "shirt", "trousers"];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_19rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle label="Show outfits for" value={gender} onChange={onGender} options={[{ id: "men", label: "Men" }, { id: "women", label: "Women" }] as const} />
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Toggle
              label="Category"
              value={category}
              onChange={onCategory}
              className="w-max"
              options={CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: products ? products.filter(c.match).length : undefined }))}
            />
          </div>
        </div>

        {!products ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon={Shirt}
            title={`No ${gender === "women" ? "women's" : "men's"} ${category === "all" ? "items" : cat.label.toLowerCase()} to try on yet`}
            description="We're photographing more of the collection for the try-on. Meanwhile you can browse the shop."
            action={<Button asChild variant="secondary" size="sm"><Link href={`/shop?gender=${gender}`}>Browse the shop</Link></Button>}
          />
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => (
              <li key={p.id}>
                <GarmentCard product={p} selected={picked[p.tryonSlot] === p.id} onToggle={() => onToggle(p)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="h-fit rounded-[var(--radius-xl)] border border-line bg-paper p-5 lg:sticky lg:top-24" aria-labelledby="tray-title">
        <h3 id="tray-title" className="text-xl">Your outfit</h3>
        <ul className="mt-3 divide-y divide-line">
          {slots.map((slot) => {
            const p = picked[slot] ? byId.get(picked[slot]!) : undefined;
            const own = (slot === "shirt" || slot === "trousers") && keepOwn[slot];
            return (
              <li key={slot} className="flex min-h-14 items-center gap-3 py-2">
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-ivory">
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny tray thumbnail */}
                  {p?.images[0]?.url ? <img src={p.images[0].url} alt="" className="h-full w-full object-contain p-0.5" /> : <Shirt className="absolute inset-0 m-auto size-4 text-line" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.68rem] uppercase tracking-wider text-stone">{SLOT_LABEL[slot]}</span>
                  <span className={cn("block truncate text-sm", !p && "text-stone")}>{p ? p.name : own ? "Keep what I'm wearing" : "Not picked"}</span>
                </span>
                {p && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.name}`} onClick={() => onRemove(slot)}>
                    <X aria-hidden />
                  </Button>
                )}
                {!p && own && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Undo keeping my own ${slot}`} onClick={() => onKeepOwn(slot as "shirt" | "trousers", false)}>
                    <X aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {picked.kit && <p className="mt-2 text-xs text-stone">A full kit is tried on in one go (one AI pass) — it replaces separate pieces.</p>}
        {budgetNote && <p className="mt-3 rounded-xl bg-brass/10 p-3 text-xs leading-relaxed text-ink" role="status">{budgetNote}</p>}
        {needsLook && (
          <Button variant="secondary" size="sm" block className="mt-3" onClick={onCompleteLook}>
            <Sparkles aria-hidden /> Complete the look
          </Button>
        )}
      </aside>
    </div>
  );
}
