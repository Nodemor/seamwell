"use client";

import { CalendarDays, Check, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addDays, colomboToday, eventDateProblem, RENTAL, rentalWindow } from "@seamwell/shared/rental";
import { toast } from "sonner";
import ClickSpark from "@/components/bits/ClickSpark";
import { SizeGuideDialog } from "@/components/product/SizeGuideDialog";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/Price";
import { api } from "@/lib/api";
import type { ProductCard } from "@/lib/catalog";
import { dayLabel } from "@/lib/rental";
import { chartForSlot } from "@/lib/sizes";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn, formatLKR } from "@/lib/utils";
import { useCart } from "@/store/cart";

type Variant = { id: string; size: string; inStock: boolean; lowStock: boolean; priceOverrideCents: number | null; rentable?: boolean };
type Mode = "buy" | "rent";
type Calendar = { variantId: string; first: string; last: string; unavailable: string[] };

/**
 * Size picker + add to bag. Rentable products get a Buy / Rent switch: renting shows the rent price and deposit,
 * only sizes with rental pieces, and an event-date picker checked against the booking calendar (the API checks
 * again at checkout). Prices here are display only — the server prices every order.
 */
export function AddToBag({ product }: { product: ProductCard & { variants: Variant[] } }) {
  const rent = product.rent && product.variants.some((x) => x.rentable) ? product.rent : null;
  const [mode, setMode] = useState<Mode>("buy");
  const [variantId, setVariantId] = useState<string>();
  const [eventDate, setEventDate] = useState("");
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [added, setAdded] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mainCta = useRef<HTMLDivElement>(null);
  const sizeGroup = useRef<HTMLDivElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const add = useCart((s) => s.add);
  const reduced = useReducedMotion();

  const renting = mode === "rent" && !!rent;
  const pickable = (x: Variant) => (renting ? !!x.rentable : x.inStock);
  const options = product.variants.filter(pickable);
  const v = product.variants.find((x) => x.id === variantId && pickable(x));
  const priceCents = renting ? rent!.priceCents : (v?.priceOverrideCents ?? product.priceCents);

  // Rental dates: the browser-side checks mirror the API (it decides again at checkout).
  const today = colomboToday();
  const first = addDays(today, RENTAL.minNoticeDays);
  const last = addDays(today, RENTAL.maxAheadDays);
  const dateProblem = renting && eventDate ? eventDateProblem(eventDate, today) : null;
  const cal = calendar && v && calendar.variantId === v.id ? calendar : null;
  const booked = !!(renting && eventDate && cal?.unavailable.includes(eventDate));
  const period = renting && eventDate && !dateProblem ? rentalWindow(eventDate, rent!.days) : null;
  const nextFree = booked && cal ? nextFreeDate(eventDate, cal) : null;
  const ready = renting ? !!(v && eventDate && !dateProblem && !booked) : !!v;

  useEffect(() => () => clearTimeout(timer.current), []);

  // Booked dates for the chosen rental size (dates only, no counts)
  useEffect(() => {
    if (!renting || !v) return;
    let alive = true;
    api<Omit<Calendar, "variantId">>(`/products/${product.slug}/rent-calendar?variantId=${v.id}`, { cache: "no-store" })
      .then((r) => alive && setCalendar({ variantId: v.id, ...r }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [renting, v, product.slug]);

  // Mobile sticky bar: visible once the main "Add to bag" button has scrolled up out of view.
  // A scroll listener (not IntersectionObserver): IO only fires on visibility *changes*, so a fast fling or a
  // restored scroll position that jumps from "below" to "above" the button would never show the bar.
  useEffect(() => {
    const el = mainCta.current;
    if (!el) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      setShowBar(el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    // keep the size if it's also available in the other mode
    const still = product.variants.find((x) => x.id === variantId);
    if (still && !(next === "rent" ? still.rentable : still.inStock)) setVariantId(undefined);
  }

  function addToBag() {
    if (!ready || !v) return;
    const base = { variantId: v.id, productSlug: product.slug, name: product.name, size: v.size, unitPriceCents: priceCents, colorHex: product.colorHex, slot: product.tryonSlot, imageUrl: product.images[0]?.url ?? null };
    if (renting && period) add({ ...base, mode: "rent", eventDate, deliverOn: period.deliverOn, returnOn: period.returnOn, depositCents: rent!.depositCents });
    else add(base);
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1800);
    toast.success(renting ? "Rental added to your bag" : "Added to your bag", {
      description: renting ? `${product.name} · size ${v.size} · event ${dayLabel(eventDate)}` : `${product.name} · size ${v.size}`,
      action: { label: "View bag", onClick: () => globalThis.dispatchEvent(new Event("sw:open-bag")) },
    });
  }

  /** Sticky bar without a size/date → bring the picker into view and focus it. */
  function chooseSize() {
    const target = v && renting ? dateInput.current : sizeGroup.current;
    target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    if (v && renting) dateInput.current?.focus({ preventScroll: true });
    else sizeGroup.current?.querySelector<HTMLButtonElement>('[role="radio"]:not(:disabled)')?.focus({ preventScroll: true });
  }

  // ARIA radio group: one tab stop, arrow keys move between available sizes.
  function onSizeKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key) || !options.length) return;
    e.preventDefault();
    const cur = options.findIndex((x) => x.id === variantId);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = options[(cur + step + options.length) % options.length]!;
    setVariantId(next.id);
    sizeGroup.current?.querySelector<HTMLButtonElement>(`[data-variant="${next.id}"]`)?.focus();
  }
  // Buy / Rent switch: also an ARIA radio group
  function onModeKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const next = mode === "buy" ? "rent" : "buy";
    switchMode(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
  }
  const tabStop = variantId && options.some((x) => x.id === variantId) ? variantId : options[0]?.id;
  const ctaLabel = !v ? "Choose a size" : renting && !eventDate ? "Choose your event date" : renting ? "Add rental to bag" : "Add to bag";

  return (
    <div className="mt-8">
      {rent && (
        <div role="radiogroup" aria-label="Buy or rent" onKeyDown={onModeKey} className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-linen p-1">
          {(["buy", "rent"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              data-mode={m}
              aria-checked={mode === m}
              tabIndex={mode === m ? 0 : -1}
              onClick={() => switchMode(m)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-xl px-3 py-2 text-center outline-none transition-colors focus-visible:ring-4 focus-visible:ring-brass/35",
                mode === m ? "bg-paper text-ink shadow-sm" : "text-stone hover:text-ink",
              )}
            >
              <span className="text-sm font-medium">{m === "buy" ? "Buy" : "Rent for an event"}</span>
              <span className="text-xs">{m === "buy" ? formatLKR(product.priceCents) : `${formatLKR(rent.priceCents)} + deposit`}</span>
            </button>
          ))}
        </div>
      )}

      {renting && (
        <div className="mb-6 rounded-2xl border border-brass/30 bg-brass/5 p-4 text-sm">
          <p className="font-medium">
            Rent: {formatLKR(rent!.priceCents)} <span className="font-normal text-stone">+ {formatLKR(rent!.depositCents)} refundable deposit</span>
          </p>
          <p className="mt-1 text-stone">
            We deliver {RENTAL.leadDays} days before your event and collect it {Math.max(0, rent!.days - RENTAL.leadDays - 1)} days after — {rent!.days} days in total, fitted to your size. The deposit is refunded when it comes back in good condition.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" id="size-label">Size{v ? `: ${v.size}` : ""}</p>
        <SizeGuideDialog initial={chartForSlot(product.tryonSlot)} />
      </div>
      <div ref={sizeGroup} className="mt-3 flex scroll-mt-28 flex-wrap gap-2" role="radiogroup" aria-labelledby="size-label" onKeyDown={onSizeKey}>
        {product.variants.map((x) => {
          const ok = pickable(x);
          return (
            <button
              key={x.id}
              data-variant={x.id}
              type="button"
              role="radio"
              aria-checked={variantId === x.id && ok}
              tabIndex={x.id === tabStop ? 0 : -1}
              disabled={!ok}
              onClick={() => setVariantId(x.id)}
              className={cn(
                "min-h-11 min-w-14 rounded-full border px-4 py-2.5 text-sm transition-[background-color,border-color,color] focus-visible:ring-4 focus-visible:ring-brass/30",
                variantId === x.id && ok ? "border-midnight bg-midnight text-ivory" : "border-line hover:border-ink/40",
                !ok && "cursor-not-allowed opacity-35 line-through",
              )}
            >
              {x.size}
              {!ok && <span className="sr-only">{renting ? " (not available to rent)" : " (sold out)"}</span>}
            </button>
          );
        })}
      </div>
      {!renting && v?.lowStock && <p className="mt-2 text-xs text-wine">Only a few left in this size</p>}

      {renting && (
        <div className="mt-5">
          <label htmlFor="event-date" className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-brass-ink" aria-hidden /> Event date
          </label>
          <input
            ref={dateInput}
            id="event-date"
            type="date"
            min={first}
            max={last}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            aria-invalid={dateProblem || booked ? true : undefined}
            aria-describedby="event-date-note"
            className="mt-2 h-12 w-full rounded-[var(--radius)] border border-line bg-paper px-4 text-base text-ink outline-none transition-[border-color,box-shadow] focus-visible:border-brass focus-visible:ring-4 focus-visible:ring-brass/25 aria-[invalid=true]:border-wine sm:max-w-xs"
          />
          <div id="event-date-note" aria-live="polite" className="mt-2 text-sm">
            {!eventDate ? (
              <p className="text-stone">Your wedding or function day — at least {RENTAL.minNoticeDays} days from today.</p>
            ) : dateProblem ? (
              <p className="text-wine">{dateProblem}</p>
            ) : !v ? (
              <p className="text-stone">Choose a size to check availability.</p>
            ) : booked ? (
              <p className="text-wine">
                Size {v.size} is already booked around {dayLabel(eventDate)}.{" "}
                {nextFree && (
                  <button type="button" onClick={() => setEventDate(nextFree)} className="min-h-11 font-medium text-midnight underline underline-offset-4 sm:min-h-0">
                    Next free date: {dayLabel(nextFree)}
                  </button>
                )}
              </p>
            ) : period ? (
              <p className="text-sage">
                <Check className="mr-1 inline size-4" aria-hidden />
                Available — delivered {dayLabel(period.deliverOn, { year: false })}, collected {dayLabel(period.returnOn, { year: false })}.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {!renting && product.onSale && product.saleEndsAt && <p className="mt-4 text-xs text-wine">Sale ends {dayLabel(new Date(Date.parse(product.saleEndsAt) + 5.5 * 3_600_000).toISOString().slice(0, 10))}</p>}

      <div ref={mainCta}>
        <ClickSpark className="mt-6 h-auto!" sparkColor={["#B08D57", "#E9DCC4"]} sparkSize={11} sparkRadius={34} sparkCount={10} shape="line" duration={520} disabled={!ready || reduced}>
          <Button size="lg" block disabled={!ready} onClick={addToBag}>
            {added ? <Check aria-hidden /> : <ShoppingBag aria-hidden />} {added ? "Added to bag" : ctaLabel}
          </Button>
        </ClickSpark>
      </div>

      {/* Sticky add-to-bag bar (phones & tablets) */}
      <div
        aria-hidden={!showBar}
        inert={!showBar}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ivory/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_-18px_rgb(31_42_68/0.4)] backdrop-blur-md transition-[translate,opacity] duration-300 lg:hidden",
          showBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-xs text-stone">
              {renting ? <span>Rent {formatLKR(priceCents)}</span> : <Price size="sm" cents={priceCents} compareAtCents={product.compareAtCents} className="[&_span]:text-xs" />}
              {v && <span> · Size {v.size}</span>}
              {renting && eventDate && !dateProblem && <span> · {dayLabel(eventDate, { year: false })}</span>}
            </p>
          </div>
          {ready ? (
            <Button onClick={addToBag} className="shrink-0">
              {added ? <Check aria-hidden /> : <ShoppingBag aria-hidden />} {added ? "Added" : renting ? "Add rental" : "Add to bag"}
            </Button>
          ) : (
            <Button onClick={chooseSize} className="shrink-0">{!v ? "Choose a size" : "Choose a date"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The first event date after `from` (within the bookable range) that isn't fully booked. */
function nextFreeDate(from: string, cal: Calendar) {
  const taken = new Set(cal.unavailable);
  for (let d = addDays(from, 1); d <= cal.last; d = addDays(d, 1)) if (!taken.has(d)) return d;
  return null;
}
