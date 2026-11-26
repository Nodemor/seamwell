import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

/** HTTP-level security checks that don't need a database. */
describe("API security middleware", () => {
  const app = createApp();

  it("health check works and hides x-powered-by", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
  });

  it("blocks state-changing requests without the CSRF header", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a@b.com", password: "x" });
    expect(res.status).toBe(403);
  });

  it("blocks requests from foreign origins", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://evil.example")
      .set("X-Seamwell-CSRF", "1")
      .send({ email: "a@b.com", password: "x" });
    expect(res.status).toBe(403);
  });

  it("validates input before touching the database", async () => {
    const res = await request(app)
      .post("/api/orders/track")
      .set("X-Seamwell-CSRF", "1")
      .send({ orderNumber: "' OR 1=1 --", email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/select|sql|stack/i);
  });

  it("admin routes require sign-in", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(401);
  });

  it("rejects oversized JSON bodies", async () => {
    const res = await request(app)
      .post("/api/orders/track")
      .set("X-Seamwell-CSRF", "1")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ pad: "x".repeat(200_000) }));
    expect(res.status).toBe(413);
  });
});
