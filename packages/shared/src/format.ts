/**
 * Zod-free formatting helpers. Kept in their own file (and package entry "@seamwell/shared/format") so web components
 * that only need to show a price don't pull zod and every schema into the browser bundle of every page.
 */
export const formatLKR = (cents: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(cents / 100);
