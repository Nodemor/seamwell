import { productQuerySchema, slugSchema, uuidSchema } from "@seamwell/shared";
import { asc } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/client.js";
import { categories } from "../../db/schema.js";
import { notFound } from "../../lib/http-error.js";
import { query } from "../../middleware/validate.js";
import { getProductBySlug, getRelated, listProducts, rentCalendar } from "./products.service.js";

export const productsRouter = Router();

/** Slugs are validated before any query; anything odd is simply "not found". */
const slugParam = (raw: unknown) => {
  const r = slugSchema.safeParse(raw);
  if (!r.success) throw notFound("Product not found");
  return r.data;
};

productsRouter.get("/categories", async (_req, res) => {
  const rows = await db.select().from(categories).orderBy(asc(categories.gender), asc(categories.sortOrder));
  res.set("Cache-Control", "public, max-age=300");
  res.json({ categories: rows });
});

productsRouter.get("/", async (req, res) => {
  const q = query(req, productQuerySchema);
  res.set("Cache-Control", "public, max-age=60");
  res.json(await listProducts(q));
});

productsRouter.get("/:slug/related", async (req, res) => {
  const items = await getRelated(slugParam(req.params.slug));
  if (!items) throw notFound("Product not found");
  res.set("Cache-Control", "public, max-age=300");
  res.json({ items });
});

/** Fully-booked event dates for one size (rental date picker). No counts — only dates. */
productsRouter.get("/:slug/rent-calendar", async (req, res) => {
  const { variantId } = query(req, z.object({ variantId: uuidSchema }));
  const cal = await rentCalendar(slugParam(req.params.slug), variantId);
  if (!cal) throw notFound("Product not found");
  res.set("Cache-Control", "no-store"); // bookings change as people order
  res.json(cal);
});

productsRouter.get("/:slug", async (req, res) => {
  const product = await getProductBySlug(slugParam(req.params.slug));
  if (!product) throw notFound("Product not found");
  res.set("Cache-Control", "public, max-age=60");
  res.json({ product });
});
