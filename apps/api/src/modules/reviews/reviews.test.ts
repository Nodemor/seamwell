import { reviewCreateSchema } from "@seamwell/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { MAX_UPLOAD_BYTES } from "../../lib/uploads.js";

/** Phase 6 — review rules that don't need a database (delivered/twice/email-match flows: scripts/e2e-smoke.mjs). */
const app = createApp();
const P = "6f0b7f0e-6d4c-4f4e-9d1a-0c6a8a3b2c11";
const valid = { productId: P, rating: 5, body: "Beautiful cloth and a perfect fit.", fit: "true", orderNumber: "SW-ABC123", email: "a@b.lk" };
// Each call from its own (forwarded) IP so the 5-per-hour review limit doesn't trip mid-test.
let ipN = 0;
const post = () => request(app).post("/api/reviews").set("X-Seamwell-CSRF", "1").set("X-Forwarded-For", `10.6.0.${++ipN}`);

describe("review input", () => {
  it("accepts a full review", () => {
    expect(reviewCreateSchema.safeParse(valid).success).toBe(true);
  });
  it.each([
    [{ rating: 0 }],
    [{ rating: 6 }],
    [{ rating: 4.5 }],
    [{ body: "too short" }],
    [{ body: "x".repeat(1501) }],
    [{ fit: "medium" }],
    [{ title: "t".repeat(81) }],
  ])("rejects %j", (patch) => {
    expect(reviewCreateSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it("fit is optional", () => {
    const { fit: _fit, ...rest } = valid;
    expect(reviewCreateSchema.safeParse(rest).success).toBe(true);
  });
});

describe("POST /api/reviews", () => {
  it("guests must give order number AND email", async () => {
    const { orderNumber: _o, email: _e, ...anon } = valid;
    expect((await post().send(anon)).status).toBe(400);
    expect((await post().send({ ...anon, orderNumber: "SW-ABC123" })).status).toBe(400);
  });

  it("a malformed order number gets the same 403 as a wrong one (no enumeration)", async () => {
    const r = await post().send({ ...valid, orderNumber: "' OR 1=1 --" });
    expect(r.status).toBe(403);
    expect(r.body.error.message).toMatch(/delivered orders/);
  });

  it("rejects a PHP file disguised as a review photo before touching the database", async () => {
    const r = await post().field("data", JSON.stringify(valid)).attach("file", Buffer.from("<?php echo 1; ?>"), { filename: "me.jpg", contentType: "image/jpeg" });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/JPEG, PNG or WebP/);
  });

  it("rejects photos over 5 MB", async () => {
    const r = await post().field("data", JSON.stringify(valid)).attach("file", Buffer.alloc(MAX_UPLOAD_BYTES + 1, 1), { filename: "big.jpg", contentType: "image/jpeg" });
    expect(r.status).toBe(413);
  });

  it("rejects a broken multipart form", async () => {
    const r = await post().field("data", "{not json").attach("file", Buffer.from("x"), "a.jpg");
    expect(r.status).toBe(400);
  });

  it("validates before the database", async () => {
    const r = await post().send({ ...valid, rating: 9 });
    expect(r.status).toBe(400);
  });
});

describe("GET /api/reviews/product/:id", () => {
  it("rejects malformed ids", async () => {
    expect((await request(app).get("/api/reviews/product/not-a-uuid")).status).toBe(400);
    expect((await request(app).get(`/api/reviews/product/${P}?page=0`)).status).toBe(400);
  });
});
