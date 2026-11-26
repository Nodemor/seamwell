"use client";

import type { ProductFacets } from "@seamwell/shared";
import { useId } from "react";
import { PRICE_BUCKETS, type ShopState } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type Patch = ShopState;

/** Pill toggle used for every filter option (aria-pressed, ≥44px on touch). */
function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm transition-[background-color,border-color,color] focus-visible:ring-4 focus-visible:ring-brass/30 disabled:opacity-40 sm:min-h-10",
        on ? "border-midnight bg-midnight text-ivory" : "border-line bg-paper text-ink hover:border-ink/40",
      )}
    >
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="border-b border-line py-5 first:pt-0 last:border-0">
      <p id={id} className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Rent · size · price · fabric filters. Used in the desktop sidebar and the mobile filter sheet. */
export function FilterPanel({ state, facets, onChange }: { state: ShopState; facets?: ProductFacets; onChange: (patch: Patch) => void }) {
  const price = facets?.price;
  const buckets = PRICE_BUCKETS.filter((b) => !price || ((b.min ?? 0) <= price.max && (b.max ?? Infinity) >= price.min));
  const bucketOn = (b: (typeof PRICE_BUCKETS)[number]) => (state.minPrice ?? "") === String(b.min ?? "") && (state.maxPrice ?? "") === String(b.max ?? "");

  return (
    <div>
      <Group title="Buy or rent">
        <Chip on={state.rent === "1"} onClick={() => onChange({ rent: state.rent === "1" ? undefined : "1" })}>
          Available to rent
        </Chip>
      </Group>
      <Group title="Size">
        {facets?.sizes.length ? (
          facets.sizes.map((s) => (
            <Chip key={s} on={state.size === s} onClick={() => onChange({ size: state.size === s ? undefined : s })}>
              {s}
            </Chip>
          ))
        ) : (
          <p className="text-sm text-stone">No sizes in stock for this selection.</p>
        )}
      </Group>
      <Group title="Price">
        {buckets.map((b) => {
          const on = bucketOn(b);
          return (
            <Chip
              key={b.id}
              on={on}
              onClick={() => onChange(on ? { minPrice: undefined, maxPrice: undefined } : { minPrice: b.min?.toString(), maxPrice: b.max?.toString() })}
            >
              {b.label}
            </Chip>
          );
        })}
      </Group>
      {facets?.fabrics.length ? (
        <Group title="Fabric">
          {facets.fabrics.map((f) => (
            <Chip key={f} on={state.fabric === f} onClick={() => onChange({ fabric: state.fabric === f ? undefined : f })}>
              {f}
            </Chip>
          ))}
        </Group>
      ) : null}
    </div>
  );
}
