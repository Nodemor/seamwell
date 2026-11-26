import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { env } from "../../config/env.js";

/** Phase 8 — public shop facts for the content pages, and input checks on the home-page testimonials endpoint. */
const app = createApp();

describe("GET /api/shop/info", () => {
  it("returns the delivery fee, free-delivery threshold and payment methods that checkout uses", async () => {
    const r = await request(app).get("/api/shop/info");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ shippingFeeCents: env.SHIPPING_FEE_CENTS, freeShippingThresholdCents: env.FREE_SHIPPING_THRESHOLD_CENTS, paymentMethods: ["cod", "bank_transfer"] });
    expect(r.headers["cache-control"]).toContain("max-age=300");
  });
  it("exposes nothing secret (no bank details)", async () => {
    const r = await request(app).get("/api/shop/info");
    expect(JSON.stringify(r.body)).not.toMatch(/bank_transfer_details|account|iban/i);
  });
});

describe("GET /api/reviews/recent (validation)", () => {
  it.each(["0", "21", "abc", "-1"])("rejects limit=%s", async (limit) => {
    expect((await request(app).get(`/api/reviews/recent?limit=${limit}`)).status).toBe(400);
  });
});
