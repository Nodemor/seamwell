import {
  adminProductSchema,
  adminProductUpdateSchema,
  courierSettingsSchema,
  ORDER_TRANSITIONS,
  orderExportSchema,
  trackingTemplateSchema,
  trackingUrlFor,
} from "@seamwell/shared";
import sharp from "sharp";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { csvCell, toCsv } from "../../lib/csv.js";
import { escapeHtml, orderReceivedEmail, shippedEmail } from "../../lib/emails.js";
import { signAccessToken } from "../../lib/jwt.js";
import { MAX_UPLOAD_BYTES, processImage } from "../../lib/uploads.js";

/** Phase 5 — admin rules that don't need a database (DB flows: scripts/e2e-smoke.mjs). */
const app = createApp();
const ID = "6f0b7f0e-6d4c-4f4e-9d1a-0c6a8a3b2c11";
const cookie = async (role: "admin" | "customer", mfa: boolean) => `sw_at=${await signAccessToken({ sub: ID, role, mfa })}`;
const asFile = (buffer: Buffer, originalname = "photo.jpg", mimetype = "image/jpeg") => ({ buffer, originalname, mimetype }) as Express.Multer.File;

describe("admin access", () => {
  const routes: [string, string][] = [
    ["get", "/api/admin/dashboard"],
    ["get", "/api/admin/orders"],
    ["get", `/api/admin/orders/export.csv?from=2026-01-01&to=2026-01-31`],
    ["get", "/api/admin/products"],
    ["post", "/api/admin/products"],
    ["post", `/api/admin/products/${ID}/images`],
    ["get", "/api/admin/audit"],
    ["put", "/api/admin/settings/couriers"],
    ["patch", "/api/admin/orders/SW-ABC123/status"],
  ];

  it.each(routes)("%s %s → 401 when signed out", async (method, path) => {
    const r = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path).set("X-Seamwell-CSRF", "1");
    expect(r.status).toBe(401);
  });

  it.each(routes)("%s %s → 403 for a customer", async (method, path) => {
    const r = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path).set("X-Seamwell-CSRF", "1").set("Cookie", await cookie("customer", true));
    expect(r.status).toBe(403);
  });

  it.each(routes)("%s %s → 403 for an admin whose session skipped MFA", async (method, path) => {
    const r = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path).set("X-Seamwell-CSRF", "1").set("Cookie", await cookie("admin", false));
    expect(r.status).toBe(403);
    expect(r.body.error.message).toMatch(/two-factor/i);
  });
});

describe("photo uploads", () => {
  const upload = async (buf: Buffer, name: string, type: string) =>
    request(app)
      .post(`/api/admin/products/${ID}/images`)
      .set("X-Seamwell-CSRF", "1")
      .set("Cookie", await cookie("admin", true))
      .attach("file", buf, { filename: name, contentType: type });

  it("rejects a PHP script renamed to .jpg (checked by content, not name or mimetype)", async () => {
    const r = await upload(Buffer.from("<?php system($_GET['c']); ?>"), "shell.jpg", "image/jpeg");
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/JPEG, PNG or WebP/);
  });

  it("rejects SVG and HTML (scriptable formats)", async () => {
    const svg = await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), "logo.png", "image/png");
    const html = await upload(Buffer.from("<html><script>alert(1)</script></html>"), "a.webp", "image/webp");
    expect(svg.status).toBe(400);
    expect(html.status).toBe(400);
  });

  it("rejects files over 5 MB with 413", async () => {
    const r = await upload(Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0xff), "huge.jpg", "image/jpeg");
    expect(r.status).toBe(413);
  });

  it("requires a file", async () => {
    const r = await request(app).post(`/api/admin/products/${ID}/images`).set("X-Seamwell-CSRF", "1").set("Cookie", await cookie("admin", true)).send({});
    expect(r.status).toBe(400);
  });

  it("re-encodes: strips metadata, caps the size, outputs WebP (gallery) / JPEG on white (try-on)", async () => {
    const big = await sharp({ create: { width: 3000, height: 1500, channels: 4, background: { r: 30, g: 40, b: 70, alpha: 0.5 } } })
      .png()
      .withMetadata({ exif: { IFD0: { Copyright: "secret-gps-and-camera" } } })
      .toBuffer();
    const gallery = await processImage(asFile(big, "x.png", "image/png"), "gallery");
    const meta = await sharp(gallery.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(2000);
    expect(meta.exif).toBeUndefined();
    expect(gallery.buffer.includes(Buffer.from("secret-gps"))).toBe(false);

    const tryon = await processImage(asFile(big, "x.png", "image/png"), "tryon");
    const tmeta = await sharp(tryon.buffer).metadata();
    expect(tmeta.format).toBe("jpeg");
    expect(tmeta.hasAlpha).toBe(false);
  });

  it("drops anything hidden after the image data (JPEG + PHP polyglot)", async () => {
    const jpg = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    const polyglot = Buffer.concat([jpg, Buffer.from("<?php echo 'pwned'; ?>")]);
    const out = await processImage(asFile(polyglot), "gallery");
    expect(out.buffer.includes(Buffer.from("<?php"))).toBe(false);
  });
});

describe("order status rules", () => {
  it("can't go backwards or skip ahead", () => {
    expect(ORDER_TRANSITIONS.shipped).not.toContain("processing");
    expect(ORDER_TRANSITIONS.pending_confirmation).not.toContain("shipped");
    expect(ORDER_TRANSITIONS.delivered).toEqual(["returned"]); // rentals only (enforced by the API)
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
  });

  it("a shipped status needs courier + tracking number", async () => {
    const r = await request(app)
      .patch("/api/admin/orders/SW-ABC123/status")
      .set("X-Seamwell-CSRF", "1")
      .set("Cookie", await cookie("admin", true))
      .send({ status: "shipped", courierName: "Domex" });
    expect(r.status).toBe(400);
  });

  it("tracking links must be https", async () => {
    const r = await request(app)
      .patch("/api/admin/orders/SW-ABC123/status")
      .set("X-Seamwell-CSRF", "1")
      .set("Cookie", await cookie("admin", true))
      .send({ status: "shipped", courierName: "Domex", trackingNumber: "DX1", trackingUrl: "javascript:alert(1)" });
    expect(r.status).toBe(400);
  });
});

describe("CSV export", () => {
  it.each([
    ["=HYPERLINK(\"http://evil\")", `"'=HYPERLINK(""http://evil"")"`],
    ["+94771234567", `"'+94771234567"`],
    ["-2+3", `"'-2+3"`],
    ["@SUM(A1)", `"'@SUM(A1)"`],
    ["\tcmd", `"'\tcmd"`],
  ])("neutralises formula %j", (input, out) => {
    expect(csvCell(input)).toBe(out);
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('12, "Lotus" Road\nColombo')).toBe('"12, ""Lotus"" Road\nColombo"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(4500)).toBe("4500");
  });

  it("starts with a BOM and uses CRLF", () => {
    const csv = toCsv(["a", "b"], [[1, "x"]]);
    expect(csv.startsWith("﻿a,b\r\n1,x\r\n")).toBe(true);
  });

  it("export range is validated", () => {
    expect(orderExportSchema.safeParse({ from: "2026-02-01", to: "2026-01-01" }).success).toBe(false);
    expect(orderExportSchema.safeParse({ from: "2024-01-01", to: "2026-01-01" }).success).toBe(false);
    expect(orderExportSchema.safeParse({ from: "2026-01-01", to: "2026-01-31" }).success).toBe(true);
  });
});

describe("couriers", () => {
  it.each(["", "https://www.domex.lk/track?no={tracking}", "https://track.example.lk/{tracking}"])("accepts template %j", (t) => {
    expect(trackingTemplateSchema.safeParse(t).success).toBe(true);
  });
  it.each(["http://insecure.lk/{tracking}", "javascript:alert(1)//{tracking}", "https://no-placeholder.lk/track", "https://a b.lk/{tracking}"])("rejects template %j", (t) => {
    expect(trackingTemplateSchema.safeParse(t).success).toBe(false);
  });
  it("fills and URL-encodes the tracking number", () => {
    expect(trackingUrlFor("https://c.lk/t?n={tracking}", "AB 12/3&x")).toBe("https://c.lk/t?n=AB%2012%2F3%26x");
    expect(trackingUrlFor("", "AB1")).toBeUndefined();
  });
  it("settings only accept known couriers", () => {
    expect(courierSettingsSchema.safeParse({ templates: { domex: "" } }).success).toBe(true);
    expect(courierSettingsSchema.safeParse({ templates: { evil: "https://x.lk/{tracking}" } }).success).toBe(false);
  });
});

describe("product editor rules", () => {
  const base = { name: "Navy Suit", categoryId: ID, gender: "men", priceCents: 5000000, tryonSlot: "kit" };
  it("'was' price must be higher than the price", () => {
    expect(adminProductSchema.safeParse({ ...base, compareAtCents: 4000000 }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...base, compareAtCents: 6000000 }).success).toBe(true);
  });
  it("a PATCH never fills in defaults it wasn't sent", () => {
    expect(adminProductUpdateSchema.parse({ priceCents: 100 })).toEqual({ priceCents: 100 });
    expect(adminProductUpdateSchema.safeParse({}).success).toBe(false);
  });
  it("prices are whole cents", () => {
    expect(adminProductSchema.safeParse({ ...base, priceCents: 10.5 }).success).toBe(false);
    expect(adminProductSchema.safeParse({ ...base, priceCents: -1 }).success).toBe(false);
  });
});

describe("customer emails", () => {
  const order = {
    orderNumber: "SW-ABC123",
    customerName: '<img src=x onerror="alert(1)"> Nimal',
    email: "n@example.lk",
    paymentMethod: "bank_transfer" as const,
    subtotalCents: 1000000,
    shippingCents: 0,
    totalCents: 1000000,
    items: [{ productName: "Suit <b>", size: "40", quantity: 1, unitPriceCents: 1000000 }],
  };
  it("escapes customer data in HTML", () => {
    const m = orderReceivedEmail(order, "Bank: <script>x</script>");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain(escapeHtml("Suit <b>"));
    expect(m.text).toContain("SW-ABC123");
  });
  it("shipped email carries courier + tracking link", () => {
    const m = shippedEmail({ ...order, customerName: "Nimal" }, { courierName: "Domex", trackingNumber: "DX-1", trackingUrl: "https://domex.lk/t?n=DX-1" });
    expect(m.text).toContain("DX-1");
    expect(m.html).toContain("https://domex.lk/t?n=DX-1");
  });
});
