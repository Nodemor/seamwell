import { checkoutSchema, idempotencyKeySchema, quoteSchema, savedAddressSchema, savedAddressUpdateSchema, SL_DISTRICTS } from "@seamwell/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { shippingFor, totalsFor } from "./orders.service.js";

/** Phase 3 — checkout rules that don't need a database (the DB flows are covered by scripts/e2e-smoke.mjs). */

const V1 = "6f0b7f0e-6d4c-4f4e-9d1a-0c6a8a3b2c11";
const validCheckout = {
  customer: { name: "Nimal Perera", email: "nimal@example.lk", phone: "0771234567" },
  shippingAddress: { line1: "12 Galle Road", city: "Colombo 03", district: "Colombo", postalCode: "00300" },
  paymentMethod: "cod",
  items: [{ variantId: V1, quantity: 1 }],
};

describe("districts", () => {
  it("has exactly the 25 districts of Sri Lanka", () => {
    expect(SL_DISTRICTS).toHaveLength(25);
    expect(new Set(SL_DISTRICTS).size).toBe(25);
  });

  it.each(SL_DISTRICTS)("accepts %s", (district) => {
    expect(checkoutSchema.safeParse({ ...validCheckout, shippingAddress: { ...validCheckout.shippingAddress, district } }).success).toBe(true);
  });

  it.each(["colombo", "Colombo 07", "Western Province", "", "Colombo'; DROP TABLE orders;--"])("rejects %j", (district) => {
    const r = checkoutSchema.safeParse({ ...validCheckout, shippingAddress: { ...validCheckout.shippingAddress, district } });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path.join(".") === "shippingAddress.district")).toBe(true);
  });

  it("validates postal codes as 5 digits", () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, shippingAddress: { ...validCheckout.shippingAddress, postalCode: "1234" } }).success).toBe(false);
  });
});

describe("quote input", () => {
  it("accepts ids + quantities and strips any client-sent prices", () => {
    const q = quoteSchema.parse({ items: [{ variantId: V1, quantity: 2, unitPriceCents: 1, priceCents: 1 }] });
    expect(q.items[0]).toEqual({ variantId: V1, quantity: 2, mode: "buy" });
  });

  it.each([
    [{ items: [] }],
    [{ items: [{ variantId: "not-a-uuid", quantity: 1 }] }],
    [{ items: [{ variantId: V1, quantity: 0 }] }],
    [{ items: [{ variantId: V1, quantity: 11 }] }],
    [{ items: [{ variantId: V1, quantity: 1.5 }] }],
    [{ items: Array.from({ length: 31 }, () => ({ variantId: V1, quantity: 1 })) }],
  ])("rejects %j", (input) => {
    expect(quoteSchema.safeParse(input).success).toBe(false);
  });
});

describe("idempotency key", () => {
  it("must be a UUID", () => {
    expect(idempotencyKeySchema.safeParse(crypto.randomUUID()).success).toBe(true);
    for (const bad of ["", "123", "x".repeat(36), "' OR 1=1 --"]) expect(idempotencyKeySchema.safeParse(bad).success).toBe(false);
  });
});

describe("totals (shared by quote and order)", () => {
  // vitest env: SHIPPING_FEE_CENTS default 45 000 (LKR 450), free from 2 500 000 (LKR 25 000)
  it("adds the delivery fee below the free-shipping threshold", () => {
    expect(totalsFor([{ unitPriceCents: 690000, quantity: 2 }])).toEqual({ subtotalCents: 1380000, shippingCents: 45000, depositCents: 0, totalCents: 1425000 });
  });
  it("is free at or above the threshold", () => {
    expect(totalsFor([{ unitPriceCents: 1250000, quantity: 2 }])).toEqual({ subtotalCents: 2500000, shippingCents: 0, depositCents: 0, totalCents: 2500000 });
  });
  it("charges nothing for an empty bag", () => {
    expect(totalsFor([])).toEqual({ subtotalCents: 0, shippingCents: 0, depositCents: 0, totalCents: 0 });
    expect(shippingFor(0)).toBe(0);
  });
  it("adds rental deposits on top — they don't count toward free delivery", () => {
    // rent LKR 20,000 (below the LKR 25,000 free-delivery threshold) + LKR 20,000 refundable deposit
    expect(totalsFor([{ unitPriceCents: 2000000, quantity: 1, depositCents: 2000000 }])).toEqual({ subtotalCents: 2000000, shippingCents: 45000, depositCents: 2000000, totalCents: 4045000 });
    expect(totalsFor([{ unitPriceCents: 2500000, quantity: 2, depositCents: 1000000 }]).depositCents).toBe(2000000);
  });
});

describe("saved addresses input", () => {
  it("requires a label and a valid district", () => {
    expect(savedAddressSchema.safeParse({ label: "Home", line1: "1 Main St", city: "Kandy", district: "Kandy" }).success).toBe(true);
    expect(savedAddressSchema.safeParse({ line1: "1 Main St", city: "Kandy", district: "Kandy" }).success).toBe(false);
    expect(savedAddressSchema.safeParse({ label: "Home", line1: "1 Main St", city: "Kandy", district: "Kandy City" }).success).toBe(false);
  });
  it("rejects empty updates and strips unknown keys like userId", () => {
    expect(savedAddressUpdateSchema.safeParse({}).success).toBe(false);
    const r = savedAddressUpdateSchema.parse({ label: "Office", userId: V1 });
    expect(r).toEqual({ label: "Office" });
  });
});

describe("checkout & account HTTP guards (no database needed)", () => {
  const app = createApp();
  const post = (path: string) => request(app).post(path).set("X-Seamwell-CSRF", "1");

  it("rejects a malformed Idempotency-Key with 400 before placing anything", async () => {
    const res = await post("/api/orders").set("Idempotency-Key", "not-a-uuid").send(validCheckout);
    expect(res.status).toBe(400);
  });

  it("validates quote input", async () => {
    const res = await post("/api/orders/quote").send({ items: [{ variantId: "x", quantity: 99 }] });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown district at checkout", async () => {
    const res = await post("/api/orders").send({ ...validCheckout, shippingAddress: { ...validCheckout.shippingAddress, district: "Atlantis" } });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("shippingAddress.district");
  });

  it("address endpoints require a signed-in user (and the CSRF header for writes)", async () => {
    expect((await request(app).get("/api/account/addresses")).status).toBe(401);
    expect((await post("/api/account/addresses").send({ label: "Home" })).status).toBe(401);
    expect((await request(app).delete(`/api/account/addresses/${V1}`)).status).toBe(403); // no CSRF header
  });
});
