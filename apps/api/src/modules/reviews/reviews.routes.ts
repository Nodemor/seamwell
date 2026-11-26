import { REVIEW_FITS, reviewCreateSchema, uuidSchema } from "@seamwell/shared";
import { and, avg, count, desc, eq, gte } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/client.js";
import { orderItems, orders, products, reviews, users } from "../../db/schema.js";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/http-error.js";
import { deleteUpload, processImage, receiveOptionalImageWithJson, saveImage } from "../../lib/uploads.js";
import { requireAdmin } from "../../middleware/auth.js";
import { reviewLimiter } from "../../middleware/rate-limit.js";
import { body, parse, query } from "../../middleware/validate.js";

/**
 * Reviews = verified purchases only:
 *  - guests (or anyone giving order number + email) prove the purchase exactly like order tracking
 *  - signed-in customers otherwise: the product must be in one of THEIR delivered orders
 * New reviews start as "pending" and appear after an admin approves them (stops spam).
 * Text is stored as typed and always rendered as text; photos go through the secure upload pipeline.
 */
export const reviewsRouter = Router();
const PAGE_SIZE = 6;
const ORDER_NO = /^SW-[A-Z0-9]{6,10}$/;

/** Recent approved 4–5 star reviews across the shop (home page testimonials). Real verified reviews only. */
reviewsRouter.get("/recent", async (req, res) => {
  const { limit } = query(req, z.object({ limit: z.coerce.number().int().min(1).max(20).default(12) }));
  const rows = await db
    .select({ id: reviews.id, authorName: reviews.authorName, rating: reviews.rating, title: reviews.title, body: reviews.body, createdAt: reviews.createdAt, productName: products.name, productSlug: products.slug })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(and(eq(reviews.status, "approved"), gte(reviews.rating, 4), eq(products.isActive, true)))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
  res.set("Cache-Control", "public, max-age=300");
  res.json({ reviews: rows.map((r) => ({ ...r, verified: true })) });
});

/** Approved reviews for a product: a page of reviews + star breakdown + fit summary. */
reviewsRouter.get("/product/:productId", async (req, res) => {
  const productId = parse(uuidSchema, req.params.productId);
  const { page } = query(req, z.object({ page: z.coerce.number().int().min(1).max(200).default(1) }));
  const approved = and(eq(reviews.productId, productId), eq(reviews.status, "approved"));
  const [rows, stars, fits] = await Promise.all([
    db
      .select({ id: reviews.id, authorName: reviews.authorName, rating: reviews.rating, title: reviews.title, body: reviews.body, fit: reviews.fit, photoUrl: reviews.photoUrl, createdAt: reviews.createdAt })
      .from(reviews)
      .where(approved)
      .orderBy(desc(reviews.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ rating: reviews.rating, n: count() }).from(reviews).where(approved).groupBy(reviews.rating),
    db.select({ fit: reviews.fit, n: count() }).from(reviews).where(approved).groupBy(reviews.fit),
  ]);
  const breakdown = Object.fromEntries([1, 2, 3, 4, 5].map((s) => [s, stars.find((x) => x.rating === s)?.n ?? 0])) as Record<1 | 2 | 3 | 4 | 5, number>;
  const fit = Object.fromEntries(REVIEW_FITS.map((f) => [f, fits.find((x) => x.fit === f)?.n ?? 0])) as Record<(typeof REVIEW_FITS)[number], number>;
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  res.set("Cache-Control", "public, max-age=60");
  res.json({ reviews: rows.map((r) => ({ ...r, verified: true })), total, page, pageSize: PAGE_SIZE, breakdown, fit });
});

reviewsRouter.post("/", reviewLimiter, receiveOptionalImageWithJson, async (req, res) => {
  const input = body(req, reviewCreateSchema);
  // A photo is checked and re-encoded BEFORE anything else (rejects non-images early), saved only once the purchase is verified.
  const image = req.file ? await processImage(req.file, "gallery") : null;

  // Find a delivered order that contains this product and belongs to the reviewer.
  let orderWhere;
  let accountName: string | undefined;
  if (input.orderNumber || input.email) {
    if (!input.orderNumber || !input.email) throw badRequest("Enter your order number and email to review as a guest");
    if (!ORDER_NO.test(input.orderNumber)) throw forbidden("You can review products from your delivered orders");
    orderWhere = and(eq(orders.orderNumber, input.orderNumber), eq(orders.email, input.email));
  } else if (req.user) {
    orderWhere = eq(orders.userId, req.user.sub);
    accountName = (await db.query.users.findFirst({ where: eq(users.id, req.user.sub), columns: { name: true } }))?.name;
  } else {
    throw badRequest("Enter your order number and email to review as a guest");
  }
  const [match] = await db
    .select({ orderId: orders.id, customerName: orders.customerName })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(orderWhere, eq(orders.status, "delivered"), eq(orderItems.productId, input.productId)))
    .limit(1);
  // Same answer for "no such order", "wrong email", "not delivered" and "not in this order" (no enumeration).
  if (!match) throw forbidden("You can review products from your delivered orders");

  // Show first name + last initial only (privacy)
  const [first = "Customer", last] = (accountName || match.customerName).trim().split(/\s+/);
  const display = last ? `${first} ${last[0]!.toUpperCase()}.` : first;

  const photoUrl = image ? await saveImage(image) : null;
  try {
    const [created] = await db
      .insert(reviews)
      .values({ productId: input.productId, orderId: match.orderId, userId: req.user?.sub ?? null, authorName: display, rating: input.rating, title: input.title || null, body: input.body, fit: input.fit ?? null, photoUrl })
      .returning({ id: reviews.id });
    res.status(201).json({ id: created?.id, status: "pending", message: "Thank you! Your review will appear after a quick check." });
  } catch (err) {
    await deleteUpload(photoUrl);
    // Postgres unique violation (Drizzle wraps the driver error in `cause`)
    const e = err as { code?: string; cause?: { code?: string } };
    if (e.code === "23505" || e.cause?.code === "23505") throw conflict("You have already reviewed this product for this order");
    throw err;
  }
});

/* ---------- Admin moderation ---------- */
export const adminReviewsRouter = Router();
adminReviewsRouter.use(requireAdmin);
adminReviewsRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

adminReviewsRouter.get("/", async (req, res) => {
  const q = query(req, z.object({ status: z.enum(["pending", "approved", "rejected"]).default("pending") }));
  const rows = await db
    .select({ id: reviews.id, productName: products.name, productSlug: products.slug, authorName: reviews.authorName, rating: reviews.rating, title: reviews.title, body: reviews.body, fit: reviews.fit, photoUrl: reviews.photoUrl, status: reviews.status, createdAt: reviews.createdAt })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .where(eq(reviews.status, q.status))
    .orderBy(desc(reviews.createdAt))
    .limit(100);
  res.json({ reviews: rows });
});

adminReviewsRouter.patch("/:id", async (req, res) => {
  const id = parse(uuidSchema, req.params.id);
  const { status } = body(req, z.object({ status: z.enum(["approved", "rejected"]) }));
  const current = await db.query.reviews.findFirst({ where: eq(reviews.id, id), columns: { photoUrl: true } });
  if (!current) throw notFound("Review not found");
  // A rejected review's photo is deleted — it will never be shown.
  const [review] = await db
    .update(reviews)
    .set({ status, ...(status === "rejected" && { photoUrl: null }) })
    .where(eq(reviews.id, id))
    .returning({ productId: reviews.productId });
  if (!review) throw notFound("Review not found");
  if (status === "rejected") await deleteUpload(current.photoUrl);

  // Keep the product's denormalised rating in sync
  const [stats] = await db
    .select({ avg: avg(reviews.rating), n: count() })
    .from(reviews)
    .where(and(eq(reviews.productId, review.productId), eq(reviews.status, "approved")));
  await db
    .update(products)
    .set({ ratingAvg: Math.round(Number(stats?.avg ?? 0) * 100), ratingCount: stats?.n ?? 0 })
    .where(eq(products.id, review.productId));

  await audit({ actorId: req.user!.sub, action: `review.${status}`, entity: "review", entityId: id, ip: req.ip });
  res.json({ ok: true });
});
