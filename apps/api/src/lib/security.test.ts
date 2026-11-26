import { describe, expect, it } from "vitest";
import { checkoutSchema, ORDER_TRANSITIONS, orderStatusUpdateSchema, productQuerySchema } from "@seamwell/shared";
import { decrypt, encrypt, newOrderNumber, sha256 } from "./crypto.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, signMfaToken, verifyAccessToken, verifyMfaToken } from "./jwt.js";
import { generateTotpSecret, verifyTotp } from "./mfa.js";
import { TOTP, Secret } from "otpauth";

describe("passwords", () => {
  it("hashes with argon2id and verifies", async () => {
    const hash = await hashPassword("CorrectHorse42");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "CorrectHorse42")).toBe(true);
    expect(await verifyPassword(hash, "wrong-password1")).toBe(false);
  });
});

describe("tokens", () => {
  it("access token round-trips and MFA tokens cannot be used as access tokens", async () => {
    const at = await signAccessToken({ sub: "11111111-1111-4111-8111-111111111111", role: "admin", mfa: true });
    expect(await verifyAccessToken(at)).toMatchObject({ role: "admin", mfa: true });
    const mfa = await signMfaToken("11111111-1111-4111-8111-111111111111");
    await expect(verifyAccessToken(mfa)).rejects.toThrow();
    await expect(verifyMfaToken(at)).rejects.toThrow();
  });

  it("rejects a tampered token", async () => {
    const at = await signAccessToken({ sub: "11111111-1111-4111-8111-111111111111", role: "customer", mfa: false });
    const [h, p, s] = at.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "x", role: "admin", mfa: true })).toString("base64url");
    await expect(verifyAccessToken(`${h}.${forged}.${s}`)).rejects.toThrow();
    expect(p).toBeTruthy();
  });
});

describe("encryption & ids", () => {
  it("AES-GCM round-trips and detects tampering", () => {
    const enc = encrypt("JBSWY3DPEHPK3PXP");
    expect(decrypt(enc)).toBe("JBSWY3DPEHPK3PXP");
    const parts = enc.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
  it("order numbers have the public format", () => {
    expect(newOrderNumber()).toMatch(/^SW-[A-HJ-NP-Z2-9]{6}$/);
    expect(sha256("a")).toHaveLength(64);
  });
});

describe("TOTP", () => {
  it("accepts the current code", () => {
    const secret = generateTotpSecret();
    const code = new TOTP({ secret: Secret.fromBase32(secret) }).generate();
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, code === "000000" ? "111111" : "000000")).toBe(false);
  });
});

describe("input validation", () => {
  it("checkout ignores client prices and rejects bad quantities", () => {
    const parsed = checkoutSchema.safeParse({
      customer: { name: "Nimal Perera", email: "NIMAL@Example.com", phone: "0771234567" },
      shippingAddress: { line1: "12 Galle Rd", city: "Colombo", district: "Colombo" },
      paymentMethod: "cod",
      items: [{ variantId: "11111111-1111-4111-8111-111111111111", quantity: 2, priceCents: 1 }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.customer.email).toBe("nimal@example.com");
      expect(parsed.data.items[0]).not.toHaveProperty("priceCents");
    }
    expect(checkoutSchema.safeParse({ ...parsed.data, items: [{ variantId: "x", quantity: 99 }] }).success).toBe(false);
  });

  it("product search rejects SQL-looking category slugs", () => {
    expect(productQuerySchema.safeParse({ category: "suits'; DROP TABLE users;--" }).success).toBe(false);
  });

  it("shipping requires courier and tracking number", () => {
    expect(orderStatusUpdateSchema.safeParse({ status: "shipped" }).success).toBe(false);
    expect(orderStatusUpdateSchema.safeParse({ status: "shipped", courierName: "Domex", trackingNumber: "DX12345" }).success).toBe(true);
    // A delivered order can only move on to "returned" (rental orders; enforced by the API)
    expect(ORDER_TRANSITIONS.delivered).toEqual(["returned"]);
    expect(ORDER_TRANSITIONS.returned).toEqual([]);
  });
});

describe("global rate limit: internal server-side rendering", () => {
  it("only skips loopback requests WITHOUT X-Forwarded-For (Nginx always sets it for internet traffic)", async () => {
    const { isInternalRequest } = await import("../middleware/rate-limit.js");
    const req = (remoteAddress: string, xff?: string) => ({ headers: xff ? { "x-forwarded-for": xff } : {}, socket: { remoteAddress } }) as never;
    expect(isInternalRequest(req("127.0.0.1"))).toBe(true);
    expect(isInternalRequest(req("::ffff:127.0.0.1"))).toBe(true);
    expect(isInternalRequest(req("127.0.0.1", "203.0.113.9"))).toBe(false); // via Nginx → limited per visitor
    expect(isInternalRequest(req("203.0.113.9"))).toBe(false);
  });
});
