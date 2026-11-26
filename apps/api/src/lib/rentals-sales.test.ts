import { describe, expect, it } from "vitest";
import {
  addDays,
  adminProductSchema,
  adminProductUpdateSchema,
  cartItemSchema,
  colomboToday,
  daysBetween,
  effectivePricing,
  eventDateProblem,
  isIsoDate,
  ORDER_TRANSITIONS,
  rangesOverlap,
  RENTAL,
  rentalWindow,
} from "@seamwell/shared";

const V = "6f0b7f0e-6d4c-4f4e-9d1a-0c6a8a3b2c11";
const C = "7a1b7f0e-6d4c-4f4e-9d1a-0c6a8a3b2c22";

describe("rental dates", () => {
  it("validates real calendar dates", () => {
    expect(isIsoDate("2026-12-31")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("31/12/2026")).toBe(false);
  });
  it("adds days across months and leap years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
  it("delivers 2 days before the event and keeps it rentDays in total", () => {
    expect(rentalWindow("2026-12-12", 5)).toEqual({ deliverOn: "2026-12-10", returnOn: "2026-12-14", busyUntil: "2026-12-16" });
    // never shorter than the minimum (would end before the event)
    expect(rentalWindow("2026-12-12", 1).returnOn).toBe("2026-12-12");
  });
  it("detects overlapping bookings (inclusive)", () => {
    expect(rangesOverlap("2026-12-10", "2026-12-16", "2026-12-16", "2026-12-20")).toBe(true);
    expect(rangesOverlap("2026-12-10", "2026-12-16", "2026-12-17", "2026-12-20")).toBe(false);
    expect(rangesOverlap("2026-12-10", "2026-12-16", "2026-12-01", "2026-12-09")).toBe(false);
  });
  it("needs 3 days' notice and at most a year ahead", () => {
    expect(eventDateProblem("2026-12-03", "2026-12-01")).toMatch(/notice/);
    expect(eventDateProblem("2026-12-04", "2026-12-01")).toBeNull();
    expect(eventDateProblem("2027-12-03", "2026-12-01")).toMatch(/year/);
    expect(eventDateProblem("2026-13-01", "2026-12-01")).toMatch(/valid/);
  });
  it("uses Sri Lanka's date (UTC+5:30)", () => {
    expect(colomboToday(new Date("2026-12-01T19:00:00Z"))).toBe("2026-12-02");
    expect(colomboToday(new Date("2026-12-01T18:00:00Z"))).toBe("2026-12-01");
  });
});

describe("cart lines", () => {
  it("defaults to buying and forbids a date on a purchase", () => {
    expect(cartItemSchema.parse({ variantId: V, quantity: 1 }).mode).toBe("buy");
    expect(cartItemSchema.safeParse({ variantId: V, quantity: 1, eventDate: "2026-12-12" }).success).toBe(false);
  });
  it("requires a valid event date for rentals and caps the quantity", () => {
    expect(cartItemSchema.safeParse({ variantId: V, quantity: 1, mode: "rent", eventDate: "2026-12-12" }).success).toBe(true);
    expect(cartItemSchema.safeParse({ variantId: V, quantity: 1, mode: "rent" }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: V, quantity: 1, mode: "rent", eventDate: "2026-02-30" }).success).toBe(false);
    expect(cartItemSchema.safeParse({ variantId: V, quantity: RENTAL.maxQty + 1, mode: "rent", eventDate: "2026-12-12" }).success).toBe(false);
  });
  it("rejects unknown modes and price fields are stripped", () => {
    expect(cartItemSchema.safeParse({ variantId: V, quantity: 1, mode: "borrow" }).success).toBe(false);
    expect(cartItemSchema.parse({ variantId: V, quantity: 1, unitPriceCents: 1 })).not.toHaveProperty("unitPriceCents");
  });
});

describe("sale prices", () => {
  const base = { priceCents: 50_000_00, compareAtCents: null, salePriceCents: 40_000_00, saleStartsAt: "2026-04-10T00:00:00+05:30", saleEndsAt: "2026-04-20T23:59:00+05:30" };
  it("charges the sale price only while the sale runs", () => {
    expect(effectivePricing(base, new Date("2026-04-15T12:00:00Z"))).toMatchObject({ priceCents: 40_000_00, compareAtCents: 50_000_00, onSale: true });
    expect(effectivePricing(base, new Date("2026-04-09T12:00:00Z"))).toMatchObject({ priceCents: 50_000_00, onSale: false });
    expect(effectivePricing(base, new Date("2026-04-21T12:00:00Z"))).toMatchObject({ priceCents: 50_000_00, onSale: false });
  });
  it("open-ended sales and the manual 'was' price", () => {
    expect(effectivePricing({ ...base, saleStartsAt: null, saleEndsAt: null }).onSale).toBe(true);
    expect(effectivePricing({ ...base, salePriceCents: null, compareAtCents: 60_000_00 })).toMatchObject({ priceCents: 50_000_00, compareAtCents: 60_000_00, onSale: false });
  });
  it("ignores a 'sale' price that isn't lower", () => {
    expect(effectivePricing({ ...base, salePriceCents: 50_000_00, saleStartsAt: null, saleEndsAt: null }).onSale).toBe(false);
  });
});

describe("admin product rules", () => {
  const product = { name: "Royal Red Nilame Kit", categoryId: C, gender: "men", priceCents: 165_000_00, tryonSlot: "kit" };
  it("renting needs a rent price; rental days are bounded", () => {
    expect(adminProductSchema.safeParse({ ...product, rentEnabled: true }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...product, rentEnabled: true, rentPriceCents: 25_000_00, rentDepositCents: 20_000_00 }).success).toBe(true);
    expect(adminProductSchema.parse(product).rentDays).toBe(RENTAL.defaultDays);
    expect(adminProductSchema.safeParse({ ...product, rentDays: 30 }).success).toBe(false);
  });
  it("sale price must be lower and end after it starts", () => {
    expect(adminProductSchema.safeParse({ ...product, salePriceCents: 170_000_00 }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...product, salePriceCents: 150_000_00, saleStartsAt: "2026-04-20T00:00:00+05:30", saleEndsAt: "2026-04-10T00:00:00+05:30" }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...product, salePriceCents: 150_000_00, saleStartsAt: "2026-04-10T00:00:00+05:30", saleEndsAt: "2026-04-20T00:00:00+05:30" }).success).toBe(true);
  });
  it("a PATCH can't switch renting on with an empty rent price", () => {
    expect(adminProductUpdateSchema.safeParse({ rentEnabled: true, rentPriceCents: null }).success).toBe(false);
    expect(adminProductUpdateSchema.safeParse({ rentEnabled: true }).success).toBe(true); // existing price checked on the server
  });
});

describe("order status for rentals", () => {
  it("delivered → returned is the only way to 'returned'", () => {
    expect(ORDER_TRANSITIONS.delivered).toEqual(["returned"]);
    expect(Object.entries(ORDER_TRANSITIONS).filter(([, to]) => to.includes("returned")).map(([from]) => from)).toEqual(["delivered"]);
    expect(ORDER_TRANSITIONS.returned).toEqual([]);
  });
});
