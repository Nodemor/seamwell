import type { CheckoutInput, OrderQuote, OrderStatus, PaymentStatus, QuoteLine } from "@seamwell/shared";
import { addDays, colomboToday, effectivePricing, eventDateProblem, type ItemMode, ORDER_TRANSITIONS, rangesOverlap, RENTAL, rentalWindow } from "@seamwell/shared";
import { and, count, desc, eq, gte, ilike, inArray, lt, lte, or, sql } from "drizzle-orm";
import { env } from "../../config/env.js";
import { type DB, db, type Tx } from "../../db/client.js";
import { orderItems, orders, orderStatusHistory, productImages, products, productVariants, rentalBookings, reviews, users } from "../../db/schema.js";
import { audit } from "../../lib/audit.js";
import { newOrderNumber } from "../../lib/crypto.js";
import { badRequest, conflict, notFound } from "../../lib/http-error.js";
import { deliveredEmail, type OrderEmailData, orderReceivedEmail, paymentConfirmedEmail, returnedEmail, shippedEmail } from "../../lib/emails.js";
import { sendMailSafe } from "../../lib/mailer.js";
import { courierTemplateFor } from "../admin/settings.service.js";

type Exec = DB | Tx;
type CartItems = CheckoutInput["items"];

/** Delivery fee for a subtotal (free above the threshold; nothing to deliver → no fee). */
export const shippingFor = (subtotalCents: number) =>
  subtotalCents <= 0 ? 0 : subtotalCents >= env.FREE_SHIPPING_THRESHOLD_CENTS ? 0 : env.SHIPPING_FEE_CENTS;

/**
 * Pure totals for priced lines — shared by the bag quote and the real order.
 * Rental deposits are added on top (refundable, so they don't count toward free delivery).
 */
export function totalsFor(lines: { unitPriceCents: number; quantity: number; depositCents?: number }[]) {
  const subtotalCents = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  const depositCents = lines.reduce((n, l) => n + (l.depositCents ?? 0) * l.quantity, 0);
  const shippingCents = shippingFor(subtotalCents);
  return { subtotalCents, shippingCents, depositCents, totalCents: subtotalCents + shippingCents + depositCents };
}

type BagLine = { variantId: string; mode: ItemMode; eventDate?: string; quantity: number };
/** Merge duplicate lines (same variant, same buy/rent, same event date): quantities add up. */
function mergeItems(items: CartItems): BagLine[] {
  const lines = new Map<string, BagLine>();
  for (const it of items) {
    const mode: ItemMode = it.mode ?? "buy";
    const key = `${mode}:${it.variantId}:${it.eventDate ?? ""}`;
    const cur = lines.get(key);
    if (cur) cur.quantity += it.quantity;
    else lines.set(key, { variantId: it.variantId, mode, eventDate: it.eventDate, quantity: it.quantity });
  }
  return [...lines.values()];
}

/** Rented pieces of a size already booked between two dates (bookings include their cleaning days). */
async function bookedQty(exec: Exec, variantId: string, from: string, to: string) {
  const [row] = await exec
    .select({ n: sql<number>`coalesce(sum(${rentalBookings.quantity}), 0)::int` })
    .from(rentalBookings)
    .where(and(eq(rentalBookings.variantId, variantId), eq(rentalBookings.status, "active"), lte(rentalBookings.startDate, to), gte(rentalBookings.endDate, from)));
  return row?.n ?? 0;
}

type PricedLine = QuoteLine & { productId: string; busyUntil?: string };

/**
 * Price a bag from the database. The ONLY place prices, deposits and availability are worked out (quote + order).
 *  - buy:  normal price, or the scheduled sale price while a sale runs (a per-size price override wins)
 *  - rent: the product's rent price + refundable deposit, if a rental piece of that size is free for the dates
 * Unavailable lines are reported without revealing stock or booking counts.
 */
async function priceItems(exec: Exec, items: CartItems) {
  const bag = mergeItems(items);
  const rows = await exec
    .select({
      variantId: productVariants.id,
      size: productVariants.size,
      stock: productVariants.stock,
      rentStock: productVariants.rentStock,
      priceOverrideCents: productVariants.priceOverrideCents,
      productId: products.id,
      productSlug: products.slug,
      productName: products.name,
      priceCents: products.priceCents,
      compareAtCents: products.compareAtCents,
      salePriceCents: products.salePriceCents,
      saleStartsAt: products.saleStartsAt,
      saleEndsAt: products.saleEndsAt,
      rentEnabled: products.rentEnabled,
      rentPriceCents: products.rentPriceCents,
      rentDepositCents: products.rentDepositCents,
      rentDays: products.rentDays,
      isActive: products.isActive,
      // First photo for bag thumbnails (correlated subquery on our own columns — no user input).
      imageUrl: sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = ${products.id} order by ${productImages.sortOrder} limit 1)`,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inArray(productVariants.id, [...new Set(bag.map((l) => l.variantId))]));
  const byId = new Map(rows.map((r) => [r.variantId, r]));
  const today = colomboToday();
  const now = new Date();

  const lines: PricedLine[] = [];
  const unavailable: OrderQuote["unavailable"] = [];
  const heldInBag: { variantId: string; from: string; to: string; qty: number }[] = [];
  for (const item of bag) {
    const r = byId.get(item.variantId);
    const ref = { variantId: item.variantId, mode: item.mode, ...(item.eventDate && { eventDate: item.eventDate }) };
    if (!r || !r.isActive) {
      unavailable.push({ ...ref, reason: "not_found" });
      continue;
    }
    const who = { productName: r.productName, size: r.size };
    let unitPriceCents: number;
    let depositCents = 0;
    let window: ReturnType<typeof rentalWindow> | undefined;
    if (item.mode === "buy") {
      if (r.stock < item.quantity) {
        unavailable.push({ ...ref, ...who, reason: r.stock <= 0 ? "sold_out" : "not_enough_stock" });
        continue;
      }
      unitPriceCents = r.priceOverrideCents ?? effectivePricing(r, now).priceCents;
    } else {
      if (!r.rentEnabled || !r.rentPriceCents || r.rentStock <= 0) {
        unavailable.push({ ...ref, ...who, reason: "not_rentable" });
        continue;
      }
      const problem = eventDateProblem(item.eventDate!, today);
      if (problem) {
        unavailable.push({ ...ref, ...who, reason: "invalid_date", message: problem });
        continue;
      }
      window = rentalWindow(item.eventDate!, r.rentDays);
      const w = window;
      const inBag = heldInBag.filter((h) => h.variantId === item.variantId && rangesOverlap(h.from, h.to, w.deliverOn, w.busyUntil)).reduce((n, h) => n + h.qty, 0);
      const booked = await bookedQty(exec, item.variantId, w.deliverOn, w.busyUntil);
      if (booked + inBag + item.quantity > r.rentStock) {
        unavailable.push({ ...ref, ...who, reason: "not_available_dates" });
        continue;
      }
      heldInBag.push({ variantId: item.variantId, from: w.deliverOn, to: w.busyUntil, qty: item.quantity });
      unitPriceCents = r.rentPriceCents;
      depositCents = r.rentDepositCents ?? 0;
    }
    lines.push({
      variantId: item.variantId,
      mode: item.mode,
      ...(window && { eventDate: item.eventDate, deliverOn: window.deliverOn, returnOn: window.returnOn, busyUntil: window.busyUntil }),
      depositCents,
      productId: r.productId,
      productSlug: r.productSlug,
      productName: r.productName,
      size: r.size,
      unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: unitPriceCents * item.quantity,
      imageUrl: r.imageUrl ?? null,
    });
  }
  return { lines, unavailable, ...totalsFor(lines) };
}

/** Server-priced preview of the bag (POST /orders/quote). */
export async function quote(items: CartItems): Promise<OrderQuote> {
  const priced = await priceItems(db, items);
  return {
    lines: priced.lines.map((l) => ({
      variantId: l.variantId,
      mode: l.mode,
      ...(l.mode === "rent" && { eventDate: l.eventDate, deliverOn: l.deliverOn, returnOn: l.returnOn }),
      depositCents: l.depositCents,
      productSlug: l.productSlug,
      productName: l.productName,
      size: l.size,
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      lineTotalCents: l.lineTotalCents,
      imageUrl: l.imageUrl,
    })),
    unavailable: priced.unavailable,
    subtotalCents: priced.subtotalCents,
    shippingCents: priced.shippingCents,
    depositCents: priced.depositCents,
    totalCents: priced.totalCents,
    freeShippingThresholdCents: env.FREE_SHIPPING_THRESHOLD_CENTS,
  };
}

/** Order-line fields every view shows (rentals include their dates and deposit). */
const itemColumns = {
  productName: orderItems.productName,
  size: orderItems.size,
  quantity: orderItems.quantity,
  unitPriceCents: orderItems.unitPriceCents,
  mode: orderItems.mode,
  eventDate: orderItems.eventDate,
  rentStart: orderItems.rentStart,
  rentEnd: orderItems.rentEnd,
  depositCents: orderItems.depositCents,
};

/** What the customer sees right after ordering (also returned again for an idempotent replay). */
async function placedView(order: typeof orders.$inferSelect, replayed: boolean) {
  const items = await db
    .select(itemColumns)
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    depositCents: order.depositCents,
    totalCents: order.totalCents,
    email: order.email,
    items,
    bankTransferDetails: order.paymentMethod === "bank_transfer" ? env.BANK_TRANSFER_DETAILS : undefined,
    replayed,
  };
}

/** Postgres unique-violation on a specific constraint (Drizzle wraps the pg error in `cause`). */
const isUniqueViolation = (e: unknown, constraint: string) => {
  const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const c = err?.cause ?? err;
  return c?.code === "23505" && c?.constraint === constraint;
};

/** Same key again → the original order, but only for the same customer email (otherwise it's a misuse). */
async function replayFor(idempotencyKey: string, email: string) {
  const existing = await db.query.orders.findFirst({ where: eq(orders.idempotencyKey, idempotencyKey) });
  if (!existing) return null;
  if (existing.email !== email) throw conflict("This checkout was already used for another order. Please refresh the page and try again.");
  return placedView(existing, true);
}

/**
 * Place an order (guest or signed-in).
 * - Prices come from the database (priceItems), never from the client.
 * - Stock is decremented inside the same transaction with a conditional UPDATE,
 *   so two customers can't buy the last item at the same time.
 * - Idempotency-Key: a repeated submit returns the first order instead of creating a second one.
 */
export async function placeOrder(input: CheckoutInput, userId: string | null, idempotencyKey?: string) {
  if (idempotencyKey) {
    const replay = await replayFor(idempotencyKey, input.customer.email);
    if (replay) return replay;
  }

  let order: typeof orders.$inferSelect;
  try {
    order = await db.transaction(async (tx) => {
      // Rentals: lock the sizes being rented so two checkouts can't book the last free piece at the same moment.
      const rentIds = [...new Set(input.items.filter((i) => i.mode === "rent").map((i) => i.variantId))];
      if (rentIds.length) await tx.select({ id: productVariants.id }).from(productVariants).where(inArray(productVariants.id, rentIds)).for("update");

      const priced = await priceItems(tx, input.items);
      if (priced.unavailable.some((u) => u.reason === "not_found")) {
        throw badRequest("Some items in your bag are no longer available. Please review your bag.");
      }
      const bad = priced.unavailable[0];
      if (bad) {
        if (bad.reason === "invalid_date") throw badRequest(`${bad.productName}: ${bad.message}`);
        if (bad.reason === "not_rentable") throw conflict(`Sorry, "${bad.productName}" (size ${bad.size}) can't be rented any more.`);
        if (bad.reason === "not_available_dates") throw conflict(`Sorry, "${bad.productName}" (size ${bad.size}) is already booked around ${bad.eventDate}. Please choose another date or size.`);
        throw conflict(`Sorry, "${bad.productName}" (size ${bad.size}) just sold out.`);
      }

      for (const line of priced.lines.filter((l) => l.mode === "buy")) {
        const updated = await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${line.quantity}` })
          .where(and(eq(productVariants.id, line.variantId), sql`${productVariants.stock} >= ${line.quantity}`))
          .returning({ id: productVariants.id });
        if (updated.length !== 1) throw conflict(`Sorry, "${line.productName}" (size ${line.size}) just sold out.`);
      }

      const status: OrderStatus = input.paymentMethod === "bank_transfer" ? "awaiting_payment" : "pending_confirmation";
      const [created] = await tx
        .insert(orders)
        .values({
          orderNumber: newOrderNumber(),
          userId,
          idempotencyKey: idempotencyKey ?? null,
          email: input.customer.email,
          customerName: input.customer.name,
          phone: input.customer.phone,
          addressLine1: input.shippingAddress.line1,
          addressLine2: input.shippingAddress.line2,
          city: input.shippingAddress.city,
          district: input.shippingAddress.district,
          postalCode: input.shippingAddress.postalCode,
          notes: input.notes,
          paymentMethod: input.paymentMethod,
          status,
          subtotalCents: priced.subtotalCents,
          shippingCents: priced.shippingCents,
          depositCents: priced.depositCents,
          depositStatus: priced.depositCents > 0 ? "held" : "none",
          totalCents: priced.totalCents,
        })
        .returning();
      if (!created) throw new Error("Order insert failed");

      for (const l of priced.lines) {
        const [item] = await tx
          .insert(orderItems)
          .values({
            orderId: created.id,
            productId: l.productId,
            variantId: l.variantId,
            productName: l.productName,
            size: l.size,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            mode: l.mode,
            eventDate: l.eventDate ?? null,
            rentStart: l.deliverOn ?? null,
            rentEnd: l.returnOn ?? null,
            depositCents: l.depositCents,
          })
          .returning({ id: orderItems.id });
        // Book the rented piece from delivery until it's back and cleaned
        if (l.mode === "rent") {
          await tx.insert(rentalBookings).values({ orderId: created.id, orderItemId: item!.id, variantId: l.variantId, startDate: l.deliverOn!, endDate: l.busyUntil!, quantity: l.quantity });
        }
      }
      await tx.insert(orderStatusHistory).values({ orderId: created.id, status, note: "Order placed" });
      return created;
    });
  } catch (e) {
    // Two identical submits raced: the second insert hit the unique key and rolled back (stock untouched).
    if (idempotencyKey && isUniqueViolation(e, "orders_idempotency_key_uq")) {
      const replay = await replayFor(idempotencyKey, input.customer.email);
      if (replay) return replay;
    }
    throw e;
  }

  const view = await placedView(order, false);
  sendMailSafe(orderReceivedEmail(emailData(order, view.items), env.BANK_TRANSFER_DETAILS));
  return view;
}

/** Public tracking view: only what the customer needs. */
async function orderView(orderId: string) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) throw notFound("Order not found");
  const [items, history] = await Promise.all([
    db.select({ ...itemColumns, productId: orderItems.productId }).from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select({ status: orderStatusHistory.status, note: orderStatusHistory.note, at: orderStatusHistory.createdAt }).from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId)).orderBy(orderStatusHistory.createdAt),
  ]);
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    depositCents: order.depositCents,
    depositStatus: order.depositStatus,
    totalCents: order.totalCents,
    hasRental: items.some((i) => i.mode === "rent"),
    returnedAt: order.returnedAt,
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    city: order.city,
    createdAt: order.createdAt,
    items,
    history,
    reviewable: order.status === "delivered" ? await reviewableItems(orderId) : [],
  };
}

/** Products in a delivered order that haven't been reviewed for this order yet (and are still in the shop). */
async function reviewableItems(orderId: string) {
  return db
    .selectDistinct({
      productId: products.id,
      productName: products.name,
      slug: products.slug,
      imageUrl: sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = ${products.id} order by ${productImages.sortOrder} limit 1)`,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(
      and(
        eq(orderItems.orderId, orderId),
        eq(products.isActive, true),
        sql`not exists (select 1 from ${reviews} where ${reviews.orderId} = ${orderId} and ${reviews.productId} = ${products.id})`,
      ),
    );
}

/** Guests track with order number + email. Same error for "wrong email" and "no such order" (no enumeration). */
export async function trackOrder(orderNumber: string, email: string) {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.orderNumber, orderNumber), eq(orders.email, email)),
    columns: { id: true },
  });
  if (!order) throw notFound("We couldn't find an order with that number and email");
  return orderView(order.id);
}

export async function listMyOrders(userId: string) {
  return db
    .select({ orderNumber: orders.orderNumber, status: orders.status, totalCents: orders.totalCents, createdAt: orders.createdAt })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(50);
}

export async function getMyOrder(userId: string, orderNumber: string) {
  const order = await db.query.orders.findFirst({ where: and(eq(orders.orderNumber, orderNumber), eq(orders.userId, userId)), columns: { id: true } });
  if (!order) throw notFound("Order not found");
  return orderView(order.id);
}

/* ---------- Emails ---------- */
type EmailOrder = Pick<typeof orders.$inferSelect, "orderNumber" | "customerName" | "email" | "paymentMethod" | "subtotalCents" | "shippingCents" | "depositCents" | "totalCents">;
const emailData = (o: EmailOrder, items: OrderEmailData["items"]): OrderEmailData => ({
  orderNumber: o.orderNumber,
  customerName: o.customerName,
  email: o.email,
  paymentMethod: o.paymentMethod,
  subtotalCents: o.subtotalCents,
  shippingCents: o.shippingCents,
  depositCents: o.depositCents,
  totalCents: o.totalCents,
  items,
});

/* ---------- Admin ---------- */
const ADMIN_PAGE_SIZE = 30;

/** Orders board: filter by status, search by order number or phone digits. */
export async function adminListOrders(filter: { status?: OrderStatus; q?: string; page: number }) {
  const where = [];
  if (filter.status) where.push(eq(orders.status, filter.status));
  if (filter.q) {
    const raw = filter.q.trim();
    const digits = raw.replace(/\D/g, "");
    const conds = [ilike(orders.orderNumber, `%${raw.toUpperCase().replace(/[\\%_]/g, "")}%`)];
    // Phone: stored as 0771234567 or +94771234567 — match on the last 9 digits typed
    if (digits.length >= 4) conds.push(ilike(orders.phone, `%${digits.slice(-9)}%`));
    where.push(or(...conds)!);
  }
  const cond = where.length ? and(...where) : undefined;
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        phone: orders.phone,
        city: orders.city,
        district: orders.district,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        totalCents: orders.totalCents,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(cond)
      .orderBy(desc(orders.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((filter.page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: count() }).from(orders).where(cond),
  ]);
  return { orders: rows, total: totals?.n ?? 0, page: filter.page, pageSize: ADMIN_PAGE_SIZE };
}

/** Full order for the admin drawer: tracking view + customer contact, address, notes, who changed what. */
export async function adminGetOrder(orderNumber: string) {
  const order = await db.query.orders.findFirst({ where: eq(orders.orderNumber, orderNumber) });
  if (!order) throw notFound("Order not found");
  const [view, history] = await Promise.all([
    orderView(order.id),
    db
      .select({ status: orderStatusHistory.status, note: orderStatusHistory.note, at: orderStatusHistory.createdAt, by: users.name })
      .from(orderStatusHistory)
      .leftJoin(users, eq(orderStatusHistory.changedBy, users.id))
      .where(eq(orderStatusHistory.orderId, order.id))
      .orderBy(orderStatusHistory.createdAt),
  ]);
  return {
    ...view,
    history,
    customer: { name: order.customerName, email: order.email, phone: order.phone, hasAccount: order.userId !== null },
    address: { line1: order.addressLine1, line2: order.addressLine2, city: order.city, district: order.district, postalCode: order.postalCode },
    notes: order.notes,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
  };
}

export async function adminUpdateStatus(
  orderNumber: string,
  update: { status: OrderStatus; note?: string; courierName?: string; trackingNumber?: string; trackingUrl?: string; paymentStatus?: PaymentStatus; depositStatus?: "refunded" | "kept" },
  adminId: string,
  ip?: string,
) {
  const order = await db.query.orders.findFirst({ where: eq(orders.orderNumber, orderNumber) });
  if (!order) throw notFound("Order not found");
  if (update.status !== order.status && !ORDER_TRANSITIONS[order.status].includes(update.status)) {
    throw badRequest(`An order that is "${order.status}" can't be changed to "${update.status}"`);
  }
  // "Returned" only exists for orders with rented pieces, and the deposit must be settled at the same time.
  if (update.status === "returned" && order.status !== "returned") {
    const [rented] = await db.select({ n: count() }).from(orderItems).where(and(eq(orderItems.orderId, order.id), eq(orderItems.mode, "rent")));
    if (!rented?.n) throw badRequest("Only orders with rented pieces can be marked as returned");
    if (order.depositCents > 0 && !update.depositStatus) throw badRequest("Choose whether the deposit was refunded or kept");
  }
  // Leaving "awaiting payment" means the transfer arrived (or the order is cancelled).
  if (order.status === "awaiting_payment" && update.status === "confirmed" && (update.paymentStatus ?? order.paymentStatus) !== "paid") {
    throw badRequest("Mark the bank transfer as paid to confirm this order");
  }
  // Tracking link: what the admin typed, else the courier's template from Settings.
  const trackingUrl =
    update.trackingUrl ?? (update.status === "shipped" && update.courierName && update.trackingNumber ? await courierTemplateFor(update.courierName, update.trackingNumber) : undefined);
  const paymentStatus = update.paymentStatus ?? (update.status === "delivered" && order.paymentMethod === "cod" ? "paid" : order.paymentStatus);

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: update.status,
        paymentStatus,
        courierName: update.courierName ?? order.courierName,
        trackingNumber: update.trackingNumber ?? order.trackingNumber,
        trackingUrl: trackingUrl ?? order.trackingUrl,
        shippedAt: update.status === "shipped" && order.status !== "shipped" ? new Date() : order.shippedAt,
        deliveredAt: update.status === "delivered" && order.status !== "delivered" ? new Date() : order.deliveredAt,
        returnedAt: update.status === "returned" && order.status !== "returned" ? new Date() : order.returnedAt,
        depositStatus:
          update.status === "returned" && order.depositCents > 0
            ? update.depositStatus!
            : update.status === "cancelled" && order.depositStatus === "held"
              ? paymentStatus === "paid" || paymentStatus === "refunded" ? "refunded" : "none"
              : order.depositStatus,
      })
      .where(eq(orders.id, order.id));
    if (update.status !== order.status) {
      await tx.insert(orderStatusHistory).values({ orderId: order.id, status: update.status, note: update.note, changedBy: adminId });
    }
    // Returned → the pieces are back: free them after the cleaning days (from today, early or late)
    if (update.status === "returned" && order.status !== "returned") {
      const freeFrom = addDays(colomboToday(), RENTAL.cleaningDays);
      const active = and(eq(rentalBookings.orderId, order.id), eq(rentalBookings.status, "active"));
      // Marked returned before the booking even started (e.g. never used): release it entirely
      await tx.update(rentalBookings).set({ status: "released" }).where(and(active, sql`${rentalBookings.startDate} > ${freeFrom}`));
      await tx.update(rentalBookings).set({ endDate: freeFrom }).where(active);
    }
    // Cancelled → put bought stock back and release rental bookings
    if (update.status === "cancelled" && order.status !== "cancelled") {
      await tx.update(rentalBookings).set({ status: "released" }).where(eq(rentalBookings.orderId, order.id));
      const items = await tx.select().from(orderItems).where(and(eq(orderItems.orderId, order.id), eq(orderItems.mode, "buy")));
      for (const it of items) {
        if (it.variantId) {
          await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${it.quantity}` }).where(eq(productVariants.id, it.variantId));
        }
      }
    }
  });

  await audit({
    actorId: adminId,
    action: "order.status_changed",
    entity: "order",
    entityId: order.id,
    meta: { orderNumber, from: order.status, to: update.status, ...(paymentStatus !== order.paymentStatus && { payment: paymentStatus }), trackingNumber: update.trackingNumber, ...(update.status === "returned" && { deposit: update.depositStatus ?? "none" }) },
    ip,
  });

  // Customer emails (best-effort — never undo the change if mail fails)
  const view = await orderView(order.id);
  const data = emailData(order, view.items);
  if (order.paymentMethod === "bank_transfer" && order.paymentStatus !== "paid" && paymentStatus === "paid") sendMailSafe(paymentConfirmedEmail(data));
  if (update.status === "shipped" && order.status !== "shipped") {
    sendMailSafe(shippedEmail(data, { courierName: update.courierName!, trackingNumber: update.trackingNumber!, trackingUrl: trackingUrl ?? null }));
  }
  if (update.status === "returned" && order.status !== "returned") sendMailSafe(returnedEmail(data, update.depositStatus ?? null));
  if (update.status === "delivered" && order.status !== "delivered") {
    const slugs = await db
      .selectDistinct({ name: products.name, slug: products.slug })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(and(eq(orderItems.orderId, order.id), eq(products.isActive, true)));
    sendMailSafe(deliveredEmail(data, slugs));
  }
  return view;
}

/** Colombo is UTC+5:30 all year (no DST): midnight there, as a UTC Date. */
export function colomboDayStart(isoDate?: string): Date {
  const OFFSET = 330 * 60_000;
  const base = isoDate ? Date.parse(`${isoDate}T00:00:00Z`) : Math.floor((Date.now() + OFFSET) / 86_400_000) * 86_400_000;
  return new Date(base - OFFSET);
}

/** Orders placed between two Colombo dates (inclusive) for the CSV export. */
export async function exportOrders(from: string, to: string) {
  const start = colomboDayStart(from);
  const end = new Date(colomboDayStart(to).getTime() + 86_400_000);
  const rows = await db
    .select()
    .from(orders)
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .orderBy(orders.createdAt)
    .limit(20_000);
  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await db.select({ orderId: orderItems.orderId, productName: orderItems.productName, size: orderItems.size, quantity: orderItems.quantity }).from(orderItems).where(inArray(orderItems.orderId, ids))
    : [];
  return rows.map((o) => ({
    ...o,
    items: items
      .filter((i) => i.orderId === o.id)
      .map((i) => `${i.quantity}x ${i.productName} (${i.size})`)
      .join("; "),
  }));
}

/** Numbers for the admin home screen. */
export async function adminDashboard() {
  const today = colomboDayStart();
  const [[todayStats], byStatus, lowStock, [reviewsPending], recent] = await Promise.all([
    db
      .select({ n: count(), revenue: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} <> 'cancelled'), 0)::int` })
      .from(orders)
      .where(gte(orders.createdAt, today)),
    db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status),
    db
      .select({ productId: products.id, productName: products.name, size: productVariants.size, sku: productVariants.sku, stock: productVariants.stock })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(eq(products.isActive, true), sql`${productVariants.stock} <= 3`))
      .orderBy(productVariants.stock, products.name)
      .limit(25),
    db.execute<{ n: number }>(sql`select count(*)::int as n from reviews where status = 'pending'`).then((r) => r.rows),
    db
      .select({ orderNumber: orders.orderNumber, customerName: orders.customerName, status: orders.status, totalCents: orders.totalCents, createdAt: orders.createdAt })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(8),
  ]);
  const n = (s: OrderStatus) => byStatus.find((b) => b.status === s)?.n ?? 0;
  return {
    today: { orders: todayStats?.n ?? 0, revenueCents: todayStats?.revenue ?? 0 },
    toConfirm: n("pending_confirmation"),
    awaitingPayment: n("awaiting_payment"),
    toShip: n("confirmed") + n("processing") + n("ready_to_ship"),
    inTransit: n("shipped"),
    lowStock,
    pendingReviews: reviewsPending?.n ?? 0,
    recent,
  };
}
