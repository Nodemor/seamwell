import { addDays, colomboToday, type RENTAL_VIEWS } from "@seamwell/shared";
import { and, asc, count, desc, eq, gte, inArray, lt, lte, ne, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import { orderItems, orders } from "../../db/schema.js";

type View = (typeof RENTAL_VIEWS)[number];
const PAGE_SIZE = 30;
const NOT_YET_DELIVERED = ["pending_confirmation", "awaiting_payment", "confirmed", "processing", "ready_to_ship", "shipped"] as const;

/**
 * Rentals board for the admin:
 *  - deliver: not delivered yet, delivery due within 14 days (or already late)
 *  - out:     delivered and not returned, still within the rental period
 *  - due:     delivered, collection due within the next 3 days
 *  - overdue: delivered, collection date has passed, not marked returned
 *  - all:     every rental (not cancelled), newest event first
 */
export async function listRentals(view: View, page: number) {
  const today = colomboToday();
  const rent = eq(orderItems.mode, "rent");
  const where: Record<View, SQL | undefined> = {
    deliver: and(rent, inArray(orders.status, [...NOT_YET_DELIVERED]), lte(orderItems.rentStart, addDays(today, 14))),
    out: and(rent, eq(orders.status, "delivered"), gte(orderItems.rentEnd, today)),
    due: and(rent, eq(orders.status, "delivered"), gte(orderItems.rentEnd, today), lte(orderItems.rentEnd, addDays(today, 3))),
    overdue: and(rent, eq(orders.status, "delivered"), lt(orderItems.rentEnd, today)),
    all: and(rent, ne(orders.status, "cancelled")),
  };
  const cond = where[view];
  const sort = view === "all" ? [desc(orderItems.eventDate)] : view === "deliver" ? [asc(orderItems.rentStart)] : [asc(orderItems.rentEnd)];
  const [rows, [total]] = await Promise.all([
    db
      .select({
        orderNumber: orders.orderNumber,
        orderStatus: orders.status,
        customerName: orders.customerName,
        phone: orders.phone,
        city: orders.city,
        productName: orderItems.productName,
        size: orderItems.size,
        quantity: orderItems.quantity,
        eventDate: orderItems.eventDate,
        rentStart: orderItems.rentStart,
        rentEnd: orderItems.rentEnd,
        depositCents: orderItems.depositCents,
        depositStatus: orders.depositStatus,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(cond)
      .orderBy(...sort, asc(orders.orderNumber))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(cond),
  ]);
  return { rentals: rows.map((r) => ({ ...r, depositCents: r.depositCents * r.quantity, overdue: r.orderStatus === "delivered" && !!r.rentEnd && r.rentEnd < today })), total: total?.n ?? 0, page, pageSize: PAGE_SIZE, today };
}

/** Counts for the board's tabs (and the dashboard). */
export async function rentalCounts() {
  const today = colomboToday();
  const base = (extra: SQL | undefined) => db.select({ n: count() }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(eq(orderItems.mode, "rent"), extra));
  const [[deliver], [out], [due], [overdue]] = await Promise.all([
    base(and(inArray(orders.status, [...NOT_YET_DELIVERED]), lte(orderItems.rentStart, addDays(today, 14)))),
    base(and(eq(orders.status, "delivered"), gte(orderItems.rentEnd, today))),
    base(and(eq(orders.status, "delivered"), gte(orderItems.rentEnd, today), lte(orderItems.rentEnd, addDays(today, 3)))),
    base(and(eq(orders.status, "delivered"), lt(orderItems.rentEnd, today))),
  ]);
  return { deliver: deliver?.n ?? 0, out: out?.n ?? 0, due: due?.n ?? 0, overdue: overdue?.n ?? 0 };
}
