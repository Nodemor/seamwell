/** Shared wording for rentals across the bag, checkout, order pages and admin. Dates are YYYY-MM-DD (Sri Lanka). */
export const dayLabel = (iso: string, opts: { year?: boolean } = {}) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(opts.year !== false && { year: "numeric" }), timeZone: "UTC" });

/** "Event 12 Dec 2026 · delivered 10 Dec · collected 14 Dec" */
export function rentalSummary(r: { eventDate?: string | null; rentStart?: string | null; rentEnd?: string | null; deliverOn?: string | null; returnOn?: string | null }) {
  const start = r.rentStart ?? r.deliverOn;
  const end = r.rentEnd ?? r.returnOn;
  if (!r.eventDate || !start || !end) return "";
  return `Event ${dayLabel(r.eventDate)} · delivered ${dayLabel(start, { year: false })} · collected ${dayLabel(end, { year: false })}`;
}

export const DEPOSIT_LABEL = { none: "No deposit", held: "Deposit held", refunded: "Deposit refunded", kept: "Deposit kept" } as const;
