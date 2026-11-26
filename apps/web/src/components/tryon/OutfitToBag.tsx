"use client";

import { Ruler, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { type Measurements, measurementsSchema, SIZES, suggestSize, type SizeSuggestion } from "@seamwell/shared";
import { toast } from "sonner";
import { ProductPhoto } from "@/components/product/ProductPhoto";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/FormField";
import { Price } from "@/components/ui/Price";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { ProductCard, ProductDetail } from "@/lib/catalog";
import { fieldErrors } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { useCart } from "@/store/cart";

/** Measurements are remembered for this tab only (same as the photo). */
let rememberedMeasurements: Measurements | null = null;

/** "Add this outfit to bag": one size picker per item, with an optional measurements → size suggestion. */
export function OutfitToBag({ open, onOpenChange, items }: { open: boolean; onOpenChange: (o: boolean) => void; items: ProductCard[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add this outfit to your bag</DialogTitle>
          <DialogDescription>Choose a size for each piece. Not sure? Enter your measurements and we&apos;ll suggest one. Alterations are free.</DialogDescription>
        </DialogHeader>
        {open && <Picker items={items} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Picker({ items, onDone }: { items: ProductCard[]; onDone: () => void }) {
  const [details, setDetails] = useState<ProductDetail[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [include, setInclude] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((p) => [p.id, true])));
  const [helper, setHelper] = useState(false);
  const [m, setM] = useState({ heightCm: String(rememberedMeasurements?.heightCm ?? ""), chestCm: String(rememberedMeasurements?.chestCm ?? ""), waistCm: String(rememberedMeasurements?.waistCm ?? "") });
  const [mErrors, setMErrors] = useState<Record<string, string>>({});
  const [suggested, setSuggested] = useState<Record<string, SizeSuggestion>>({});
  const add = useCart((s) => s.add);

  useEffect(() => {
    let alive = true;
    // Sizes in chart order (S, M, L, XL — not alphabetical)
    const order = (s: string) => (SIZES as readonly string[]).indexOf(s);
    Promise.all(items.map((p) => api<{ product: ProductDetail }>(`/products/${p.slug}`).then((r) => ({ ...r.product, variants: [...r.product.variants].sort((a, b) => order(a.size) - order(b.size)) }))))
      .then((d) => {
        if (!alive) return;
        setDetails(d);
        if (rememberedMeasurements) applySuggestions(d, rememberedMeasurements);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per opening
  }, []);

  function applySuggestions(list: ProductDetail[], meas: Measurements) {
    const next: Record<string, SizeSuggestion> = {};
    const picks: Record<string, string> = {};
    for (const p of list) {
      const s = suggestSize(p.tryonSlot, meas);
      next[p.id] = s;
      const v = s.size ? p.variants.find((x) => x.size === s.size && x.inStock) : undefined;
      if (v) picks[p.id] = v.id;
    }
    setSuggested(next);
    setSizes((cur) => ({ ...cur, ...picks }));
  }

  function suggest(e: React.FormEvent) {
    e.preventDefault();
    const parsed = measurementsSchema.safeParse({ heightCm: m.heightCm || undefined, chestCm: m.chestCm, waistCm: m.waistCm });
    if (!parsed.success) return setMErrors(fieldErrors(parsed.error));
    setMErrors({});
    rememberedMeasurements = parsed.data;
    if (details) applySuggestions(details, parsed.data);
  }

  const chosen = (details ?? []).filter((p) => include[p.id]);
  const missing = chosen.filter((p) => !sizes[p.id]);

  function addAll() {
    if (!chosen.length || missing.length) return;
    for (const p of chosen) {
      const v = p.variants.find((x) => x.id === sizes[p.id])!;
      add({ variantId: v.id, productSlug: p.slug, name: p.name, size: v.size, unitPriceCents: v.priceOverrideCents ?? p.priceCents, colorHex: p.colorHex, slot: p.tryonSlot, imageUrl: p.images[0]?.url ?? null });
    }
    toast.success(chosen.length === 1 ? "Added to your bag" : `${chosen.length} pieces added to your bag`, {
      description: chosen.map((p) => `${p.name} · ${p.variants.find((x) => x.id === sizes[p.id])!.size}`).join(" · "),
      action: { label: "View bag", onClick: () => window.dispatchEvent(new Event("sw:open-bag")) },
    });
    onDone();
  }

  if (failed) return <p className="rounded-xl bg-wine/10 p-3 text-sm text-wine" role="alert">We couldn&apos;t load the sizes. Please check your connection and try again.</p>;
  if (!details) return <div className="space-y-3" aria-busy="true">{items.map((p) => <Skeleton key={p.id} className="h-28 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-linen/60 p-4">
        <button type="button" aria-expanded={helper} onClick={() => setHelper((h) => !h)} className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-brass/35">
          <Ruler className="size-4 text-brass-ink" aria-hidden /> Help me choose a size <span className="text-stone font-normal">(optional)</span>
        </button>
        {helper && (
          <form onSubmit={suggest} noValidate className="mt-2">
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Height (cm)" inputMode="numeric" value={m.heightCm} onChange={(e) => setM({ ...m, heightCm: e.target.value })} error={mErrors.heightCm} placeholder="175" />
              <FormField label="Chest (cm)" inputMode="numeric" value={m.chestCm} onChange={(e) => setM({ ...m, chestCm: e.target.value })} error={mErrors.chestCm} placeholder="100" />
              <FormField label="Waist (cm)" inputMode="numeric" value={m.waistCm} onChange={(e) => setM({ ...m, waistCm: e.target.value })} error={mErrors.waistCm} placeholder="84" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="submit" size="sm" variant="secondary">Suggest my sizes</Button>
              <p className="text-xs text-stone">A suggestion from our size chart — not a fitting.</p>
            </div>
          </form>
        )}
      </div>

      <ul className="space-y-4">
        {details.map((p) => {
          const s = suggested[p.id];
          const on = include[p.id];
          return (
            <li key={p.id} className={cn("rounded-2xl border border-line bg-paper p-4", !on && "opacity-60")}>
              <div className="flex items-center gap-3">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-ivory">
                  <ProductPhoto src={p.images[0]?.url} alt="" sizes="56px" className="p-1" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <Price size="sm" cents={p.priceCents} compareAtCents={p.compareAtCents} className="text-xs [&_span]:text-xs [&_span]:font-normal" />
                </div>
                {items.length > 1 && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-stone">
                    <input type="checkbox" checked={on} onChange={(e) => setInclude({ ...include, [p.id]: e.target.checked })} className="size-4 accent-[var(--sw-midnight)]" />
                    Include
                  </label>
                )}
              </div>
              {on && (
                <fieldset className="mt-3 min-w-0">
                  <legend className="sr-only">Size for {p.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    {p.variants.map((v) => (
                      <label key={v.id} className={cn("relative grid h-11 min-w-12 cursor-pointer place-items-center rounded-full border px-3 text-sm transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brass/35 sm:h-10", !v.inStock && "cursor-not-allowed text-stone/60 line-through", sizes[p.id] === v.id ? "border-midnight bg-midnight text-ivory" : "border-line bg-paper hover:border-ink/40")}>
                        <input type="radio" name={`size-${p.id}`} value={v.id} checked={sizes[p.id] === v.id} disabled={!v.inStock} onChange={() => setSizes({ ...sizes, [p.id]: v.id })} className="sr-only" />
                        {v.size}
                        {s?.size === v.size && <span className="absolute -top-2 right-[-0.35rem] rounded-full bg-brass px-1.5 text-[0.6rem] font-medium leading-4 text-ink" aria-hidden>Suggested</span>}
                        {!v.inStock && <span className="sr-only">(sold out)</span>}
                        {s?.size === v.size && <span className="sr-only">(suggested for you)</span>}
                      </label>
                    ))}
                  </div>
                  {s && (
                    <p className="mt-2 text-xs text-stone" aria-live="polite">
                      {s.size ? `Suggested: ${s.size}${"between" in s && s.between ? " (you're between sizes — we suggest the larger)" : ""}${s.size && !p.variants.some((v) => v.size === s.size && v.inStock) ? " — sold out right now, message us to have it made" : ""}.` : ""} {s.note}
                    </p>
                  )}
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        {missing.length > 0 && <p className="mr-auto text-xs text-stone">Choose a size for {missing.map((p) => p.name).join(" and ")}</p>}
        <Button onClick={addAll} disabled={!chosen.length || missing.length > 0}>
          <ShoppingBag aria-hidden /> Add {chosen.length > 1 ? `${chosen.length} pieces` : "to bag"}
        </Button>
      </div>
    </div>
  );
}
