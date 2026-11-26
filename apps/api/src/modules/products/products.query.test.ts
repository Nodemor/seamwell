import { productQuerySchema } from "@seamwell/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { likeEscape } from "./products.service.js";

/** Catalogue query validation (phase 2). No database needed: invalid input is rejected before any query runs. */
describe("productQuerySchema", () => {
  it("accepts valid filters and coerces numbers", () => {
    const q = productQuerySchema.parse({ gender: "men", category: "suits", size: "40", fabric: "Pure linen", minPrice: "100000", maxPrice: "5000000", sort: "price_asc", page: "2", facets: "1" });
    expect(q).toMatchObject({ gender: "men", category: "suits", size: "40", fabric: "Pure linen", minPrice: 100000, maxPrice: 5000000, sort: "price_asc", page: 2, pageSize: 12, facets: "1" });
  });

  it("applies defaults and strips unknown keys", () => {
    const q = productQuerySchema.parse({ evil: "1; DROP TABLE products" });
    expect(q).toEqual({ sort: "new", page: 1, pageSize: 12 });
    expect(q).not.toHaveProperty("evil");
  });

  it.each([
    [{ size: "XXXL" }, "size"],
    [{ size: "40' OR 1=1" }, "size"],
    [{ minPrice: "-1" }, "minPrice"],
    [{ maxPrice: "100000001" }, "maxPrice"],
    [{ minPrice: "1.5" }, "minPrice"],
    [{ minPrice: "abc" }, "minPrice"],
    [{ minPrice: "500000", maxPrice: "100000" }, "maxPrice"],
    [{ fabric: "wool%' --" }, "fabric"],
    [{ fabric: "<script>" }, "fabric"],
    [{ fabric: "x".repeat(81) }, "fabric"],
    [{ category: "Suits!" }, "category"],
    [{ sort: "price" }, "sort"],
    [{ pageSize: "49" }, "pageSize"],
    [{ page: "0" }, "page"],
    [{ facets: "true" }, "facets"],
    [{ q: "x".repeat(81) }, "q"],
  ])("rejects %o", (input, field) => {
    const r = productQuerySchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === field)).toBe(true);
  });

  it("escapes LIKE wildcards in search text", () => {
    expect(likeEscape("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("products HTTP validation", () => {
  const app = createApp();

  it("rejects bad filters with 400 before touching the database", async () => {
    const res = await request(app).get("/api/products").query({ size: "XXXL", minPrice: "-5" });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/select|sql|stack/i);
  });

  it("returns 404 for malformed slugs on product and related routes", async () => {
    expect((await request(app).get("/api/products/Not%20A%20Slug")).status).toBe(404);
    expect((await request(app).get("/api/products/..%2F..%2Fetc/related")).status).toBe(404);
  });
});
