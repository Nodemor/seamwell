import { changePasswordSchema, emailTokenSchema, resetPasswordSchema, safeNextPath } from "@seamwell/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { randomToken } from "../../lib/crypto.js";

/**
 * Phase 4 — account-recovery rules that don't need a database.
 * Token redemption (single use, expiry) and guest-order linking run against a real DB in scripts/e2e-smoke.mjs.
 */

describe("?next= redirect validation", () => {
  it.each([
    ["/account", "/account"],
    ["/checkout", "/checkout"],
    ["/shop?gender=men&category=suits", "/shop?gender=men&category=suits"],
    ["/product/navy-suit#reviews", "/product/navy-suit#reviews"],
    ["/admin", "/admin"],
  ])("allows same-site path %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/phish",
    "http://localhost:3000/account",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "account",
    "/%0d%0aSet-Cookie:x",
    "/acc\tount",
    "/ evil",
    " /account",
    "",
    "/login",
    "/login?next=/account",
    "/reset-password?token=abc",
    "/" + "a".repeat(600),
  ])("rejects %j", (input) => {
    expect(safeNextPath(input)).toBe("/account");
  });

  it("rejects non-strings and uses the given fallback", () => {
    expect(safeNextPath(undefined)).toBe("/account");
    expect(safeNextPath(["/a", "/b"], "/")).toBe("/");
    expect(safeNextPath(null, "/shop")).toBe("/shop");
  });

  it("never returns something a browser would treat as another origin", () => {
    for (const input of ["/.evil.example", "/@evil.example", "/%2F%2Fevil.example", "/..//evil.example"]) {
      const out = safeNextPath(input);
      expect(new URL(out, "https://shop.lk").origin).toBe("https://shop.lk");
    }
  });
});

describe("emailed tokens", () => {
  it("accepts exactly what the API generates (32 bytes base64url)", () => {
    for (let i = 0; i < 20; i++) expect(emailTokenSchema.safeParse(randomToken(32)).success).toBe(true);
  });

  it.each(["", "short", "x".repeat(42), "x".repeat(44), `${"a".repeat(42)}=`, `${"a".repeat(40)}' --`, `${"a".repeat(42)}/`])("rejects %j", (t) => {
    expect(emailTokenSchema.safeParse(t).success).toBe(false);
  });

  it("reset requires a strong password", () => {
    const token = randomToken(32);
    expect(resetPasswordSchema.safeParse({ token, password: "Tailored2026" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token, password: "short1" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token, password: "onlyletterslong" }).success).toBe(false);
  });

  it("change password: new must differ from current", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "Tailored2026", newPassword: "Tailored2026" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["newPassword"]);
  });
});

describe("recovery endpoints (HTTP)", () => {
  const app = createApp();
  const post = (path: string, body: unknown) => request(app).post(`/api/auth${path}`).set("X-Seamwell-CSRF", "1").send(body as object);

  it("forgot-password answers identically for any email (no user enumeration)", async () => {
    const a = await post("/password/forgot", { email: "owner@seamwell.lk" });
    const b = await post("/password/forgot", { email: "nobody-here@example.com" });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body).toEqual(b.body);
  });

  it("forgot-password still validates the email", async () => {
    const r = await post("/password/forgot", { email: "not-an-email" });
    expect(r.status).toBe(400);
  });

  it("malformed reset / verify tokens are rejected before the database", async () => {
    const r1 = await post("/password/reset", { token: "' OR 1=1 --", password: "Tailored2026" });
    const r2 = await post("/email/verify", { token: "../../etc/passwd" });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
  });

  it.each([
    ["post", "/password/change"],
    ["post", "/email/resend"],
    ["get", "/sessions"],
    ["post", "/sessions/revoke-all"],
  ] as const)("%s %s requires sign-in", async (method, path) => {
    const r = await request(app)[method](`/api/auth${path}`).set("X-Seamwell-CSRF", "1").send({});
    expect(r.status).toBe(401);
  });

  it("recovery endpoints need the CSRF header", async () => {
    const r = await request(app).post("/api/auth/password/forgot").send({ email: "a@b.co" });
    expect(r.status).toBe(403);
  });
});
