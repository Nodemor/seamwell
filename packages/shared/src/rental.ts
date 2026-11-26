/**
 * Zod-free rental, date and sale-price rules (entry "@seamwell/shared/rental") — safe to import in browser code
 * that loads on every page (the bag) without pulling zod and every schema along.
 */
export const ITEM_MODES = ["buy", "rent"] as const;
export type ItemMode = (typeof ITEM_MODES)[number];
export const DEPOSIT_STATUSES = ["none", "held", "refunded", "kept"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

/**
 * Rental rules. A rental is booked for an EVENT DATE: delivered `leadDays` before it and kept `rentDays` in total
 * (per product, default 5 = 2 days before, the event day, 2 days after). A piece is then busy for `cleaningDays` more.
 */
export const RENTAL = { leadDays: 2, minNoticeDays: 3, maxAheadDays: 365, cleaningDays: 2, defaultDays: 5, minDays: 3, maxDays: 14, maxQty: 3 } as const;

const DAY_MS = 86_400_000;
const dayToUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
};
/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(dayToUtc(v)).toISOString().slice(0, 10) === v;
export const addDays = (iso: string, n: number) => new Date(dayToUtc(iso) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((dayToUtc(to) - dayToUtc(from)) / DAY_MS);
/** Today's date in Sri Lanka (UTC+5:30), as YYYY-MM-DD. */
export const colomboToday = (now = new Date()) => new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/** Delivery and return dates for an event, and the last day the piece is busy (cleaning included). */
export function rentalWindow(eventDate: string, rentDays: number) {
  const deliverOn = addDays(eventDate, -RENTAL.leadDays);
  const returnOn = addDays(deliverOn, Math.max(RENTAL.minDays, rentDays) - 1);
  return { deliverOn, returnOn, busyUntil: addDays(returnOn, RENTAL.cleaningDays) };
}
/** Inclusive date ranges (YYYY-MM-DD strings compare correctly as text). */
export const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd;
/** Why an event date can't be booked (null = fine). `today` = colomboToday(). */
export function eventDateProblem(eventDate: string, today: string): string | null {
  if (!isIsoDate(eventDate)) return "Choose a valid date";
  const ahead = daysBetween(today, eventDate);
  if (ahead < RENTAL.minNoticeDays) return `Rentals need at least ${RENTAL.minNoticeDays} days' notice`;
  if (ahead > RENTAL.maxAheadDays) return "You can book up to a year ahead";
  return null;
}

/** Product price fields that decide what a customer pays (and what to show crossed out). */
export interface PriceFields {
  priceCents: number;
  compareAtCents: number | null;
  salePriceCents: number | null;
  saleStartsAt: Date | string | null;
  saleEndsAt: Date | string | null;
}
/**
 * The price right now: the scheduled sale price while a sale is running (the normal price is then shown crossed
 * out), otherwise the normal price (with the optional manual "was" price). Sales apply to buying, not renting.
 */
export function effectivePricing(p: PriceFields, now = new Date()) {
  const t = now.getTime();
  const on =
    p.salePriceCents != null &&
    p.salePriceCents < p.priceCents &&
    (p.saleStartsAt == null || new Date(p.saleStartsAt).getTime() <= t) &&
    (p.saleEndsAt == null || new Date(p.saleEndsAt).getTime() > t);
  return on
    ? { priceCents: p.salePriceCents!, compareAtCents: p.priceCents, onSale: true, saleEndsAt: p.saleEndsAt ? new Date(p.saleEndsAt).toISOString() : null }
    : { priceCents: p.priceCents, compareAtCents: p.compareAtCents, onSale: false, saleEndsAt: null };
}
