import { adminOrderListSchema, checkoutSchema, idempotencyKeySchema, orderExportSchema, orderStatusUpdateSchema, quoteSchema, trackOrderSchema } from "@seamwell/shared";
import { Router } from "express";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { toCsv } from "../../lib/csv.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { checkoutLimiter, quoteLimiter, trackLimiter } from "../../middleware/rate-limit.js";
import { body, parse, query } from "../../middleware/validate.js";
import * as orders from "./orders.service.js";

const orderNumberParam = z.string().trim().toUpperCase().regex(/^SW-[A-Z0-9]{6,10}$/);

/* ---------- Customer & guest ---------- */
export const ordersRouter = Router();

/** Server-priced bag preview (prices, delivery, total, unavailable items) — nothing is reserved. */
ordersRouter.post("/quote", quoteLimiter, async (req, res) => {
  const { items } = body(req, quoteSchema);
  res.json({ quote: await orders.quote(items) });
});

/**
 * Checkout — works for guests and signed-in customers.
 * Optional Idempotency-Key header (UUID): repeating the same submit returns the original order (200) instead of a new one.
 */
ordersRouter.post("/", checkoutLimiter, async (req, res) => {
  const rawKey = req.get("idempotency-key");
  const idempotencyKey = rawKey === undefined ? undefined : parse(idempotencyKeySchema, rawKey);
  const input = body(req, checkoutSchema);
  const result = await orders.placeOrder(input, req.user?.sub ?? null, idempotencyKey);
  res.status(result.replayed ? 200 : 201).json(result);
});

/** Track an order with order number + email (guest friendly). POST so the email isn't put in URLs/logs. */
ordersRouter.post("/track", trackLimiter, async (req, res) => {
  const { orderNumber, email } = body(req, trackOrderSchema);
  res.json({ order: await orders.trackOrder(orderNumber, email) });
});

ordersRouter.get("/mine", requireAuth, async (req, res) => {
  res.json({ orders: await orders.listMyOrders(req.user!.sub) });
});

ordersRouter.get("/mine/:orderNumber", requireAuth, async (req, res) => {
  res.json({ order: await orders.getMyOrder(req.user!.sub, parse(orderNumberParam, req.params.orderNumber)) });
});

/* ---------- Admin (role admin + MFA session; every change audited) ---------- */
export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAdmin);
adminOrdersRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

adminOrdersRouter.get("/", async (req, res) => {
  res.json(await orders.adminListOrders(query(req, adminOrderListSchema)));
});

/** CSV of orders placed between two dates (Colombo time). Cells are escaped against formula injection. */
adminOrdersRouter.get("/export.csv", async (req, res) => {
  const { from, to } = query(req, orderExportSchema);
  const rows = await orders.exportOrders(from, to);
  await audit({ actorId: req.user!.sub, action: "order.exported", entity: "order", meta: { from, to, rows: rows.length }, ip: req.ip });
  const csv = toCsv(
    ["Order", "Placed", "Status", "Payment", "Payment status", "Customer", "Email", "Phone", "Address", "City", "District", "Postal code", "Items", "Subtotal (LKR)", "Delivery (LKR)", "Total (LKR)", "Courier", "Tracking number", "Notes"],
    rows.map((o) => [
      o.orderNumber,
      o.createdAt,
      o.status,
      o.paymentMethod,
      o.paymentStatus,
      o.customerName,
      o.email,
      o.phone,
      [o.addressLine1, o.addressLine2].filter(Boolean).join(", "),
      o.city,
      o.district,
      o.postalCode,
      o.items,
      o.subtotalCents / 100,
      o.shippingCents / 100,
      o.totalCents / 100,
      o.courierName,
      o.trackingNumber,
      o.notes,
    ]),
  );
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="seamwell-orders-${from}-to-${to}.csv"`);
  res.send(csv);
});

adminOrdersRouter.get("/:orderNumber", async (req, res) => {
  res.json({ order: await orders.adminGetOrder(parse(orderNumberParam, req.params.orderNumber)) });
});

adminOrdersRouter.patch("/:orderNumber/status", async (req, res) => {
  const orderNumber = parse(orderNumberParam, req.params.orderNumber);
  const update = body(req, orderStatusUpdateSchema);
  res.json({ order: await orders.adminUpdateStatus(orderNumber, update, req.user!.sub, req.ip) });
});
