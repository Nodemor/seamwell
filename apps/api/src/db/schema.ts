/**
 * Database schema (PostgreSQL, Drizzle ORM).
 * - Money is stored as integer cents (LKR) — never floats.
 * - All queries go through Drizzle's query builder or the `sql` tagged template,
 *   which always sends values as bound parameters (no string-built SQL → no SQL injection).
 * After editing this file:  npm run db:generate  then  npm run db:migrate
 */
import { sql } from "drizzle-orm";
import { date,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ---------- Enums ---------- */
export const roleEnum = pgEnum("user_role", ["customer", "admin"]);
export const genderEnum = pgEnum("gender", ["men", "women", "unisex"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending_confirmation",
  "awaiting_payment",
  "confirmed",
  "processing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["cod", "bank_transfer"]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "pending_verification", "paid", "refunded"]);
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected"]);
export const reviewFitEnum = pgEnum("review_fit", ["small", "true", "large"]); // runs small / true to size / runs large
export const tryonSlotEnum = pgEnum("tryon_slot", ["kit", "blazer", "shirt", "trousers"]);
export const itemModeEnum = pgEnum("item_mode", ["buy", "rent"]);
export const depositStatusEnum = pgEnum("deposit_status", ["none", "held", "refunded", "kept"]);
export const bookingStatusEnum = pgEnum("rental_booking_status", ["active", "released"]);
export const tryonPhotoTypeEnum = pgEnum("tryon_photo_type", ["flat-lay", "model"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ---------- Users & auth ---------- */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(), // always stored lower-case
    name: varchar("name", { length: 80 }).notNull(),
    phone: varchar("phone", { length: 16 }),
    passwordHash: text("password_hash").notNull(), // argon2id
    role: roleEnum("role").notNull().default("customer"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaSecretEnc: text("mfa_secret_enc"), // AES-256-GCM encrypted TOTP secret
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(), // sha256 of the opaque token
    familyId: uuid("family_id").notNull(), // rotation family — reuse of an old token revokes the whole family
    mfaVerified: boolean("mfa_verified").notNull().default(false), // session passed MFA → carried into refreshed access tokens
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: varchar("user_agent", { length: 300 }),
    ip: varchar("ip", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("refresh_tokens_hash_uq").on(t.tokenHash), index("refresh_tokens_user_idx").on(t.userId)],
);

export const mfaRecoveryCodes = pgTable(
  "mfa_recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("mfa_recovery_user_idx").on(t.userId)],
);

/**
 * One-time emailed links (password reset, email verification).
 * Only the sha256 of the token is stored; a token works once (used_at) and only until expires_at.
 */
export const authTokenPurposeEnum = pgEnum("auth_token_purpose", ["password_reset", "email_verify"]);
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: authTokenPurposeEnum("purpose").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_uq").on(t.tokenHash), index("auth_tokens_user_purpose_idx").on(t.userId, t.purpose)],
);

/* ---------- Saved delivery addresses (signed-in customers) ---------- */
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 40 }).notNull(), // "Home", "Office"…
    line1: varchar("line1", { length: 120 }).notNull(),
    line2: varchar("line2", { length: 120 }),
    city: varchar("city", { length: 60 }).notNull(),
    district: varchar("district", { length: 60 }).notNull(),
    postalCode: varchar("postal_code", { length: 10 }),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("addresses_user_idx").on(t.userId),
    // At most one default address per customer
    uniqueIndex("addresses_one_default_per_user_uq").on(t.userId).where(sql`${t.isDefault}`),
  ],
);

/* ---------- Catalogue ---------- */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 60 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    gender: genderEnum("gender").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("categories_slug_gender_uq").on(t.slug, t.gender)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    gender: genderEnum("gender").notNull(),
    priceCents: integer("price_cents").notNull(),
    compareAtCents: integer("compare_at_cents"),
    fabric: varchar("fabric", { length: 80 }),
    fit: varchar("fit", { length: 40 }),
    color: varchar("color", { length: 40 }),
    colorHex: varchar("color_hex", { length: 7 }), // used by the placeholder garment art until real photos exist
    isActive: boolean("is_active").notNull().default(true),
    // Virtual try-on metadata
    tryonEnabled: boolean("tryon_enabled").notNull().default(true),
    tryonSlot: tryonSlotEnum("tryon_slot").notNull(),
    tryonPhotoType: tryonPhotoTypeEnum("tryon_photo_type").notNull().default("flat-lay"),
    tryonImageUrl: text("tryon_image_url"), // white-background garment photo sent to the try-on model
    ratingAvg: integer("rating_avg_x100").notNull().default(0), // 4.5 stars = 450 (denormalised, updated when reviews are approved)
    ratingCount: integer("rating_count").notNull().default(0),
    // Renting: an event-date rental with a refundable deposit (see RENTAL in @seamwell/shared)
    rentEnabled: boolean("rent_enabled").notNull().default(false),
    rentPriceCents: integer("rent_price_cents"),
    rentDepositCents: integer("rent_deposit_cents"),
    rentDays: integer("rent_days").notNull().default(5),
    // Scheduled sale price (buying only); null dates = open-ended
    salePriceCents: integer("sale_price_cents"),
    saleStartsAt: timestamp("sale_starts_at", { withTimezone: true }),
    saleEndsAt: timestamp("sale_ends_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    check("products_rent_days_range", sql`${t.rentDays} between 3 and 14`),
    check("products_rent_price_when_enabled", sql`not ${t.rentEnabled} or ${t.rentPriceCents} > 0`),
    check("products_sale_below_price", sql`${t.salePriceCents} is null or (${t.salePriceCents} > 0 and ${t.salePriceCents} < ${t.priceCents})`),
    index("products_category_idx").on(t.categoryId),
    index("products_gender_active_idx").on(t.gender, t.isActive),
    check("products_price_positive", sql`${t.priceCents} > 0`),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: varchar("alt", { length: 160 }).notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 60 }).notNull(),
    size: varchar("size", { length: 10 }).notNull(),
    stock: integer("stock").notNull().default(0),
    priceOverrideCents: integer("price_override_cents"),
    /** Pieces of this size kept for RENTING (separate from stock for sale). */
    rentStock: integer("rent_stock").notNull().default(0),
  },
  (t) => [
    uniqueIndex("product_variants_sku_uq").on(t.sku),
    index("product_variants_product_idx").on(t.productId),
    check("product_variants_stock_nonneg", sql`${t.stock} >= 0`),
    check("product_variants_rent_stock_nonneg", sql`${t.rentStock} >= 0`),
  ],
);

/* ---------- Orders ---------- */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: varchar("order_number", { length: 16 }).notNull(), // e.g. SW-7K3F9Q
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // null = guest checkout
    email: varchar("email", { length: 254 }).notNull(),
    customerName: varchar("customer_name", { length: 80 }).notNull(),
    phone: varchar("phone", { length: 16 }).notNull(),
    addressLine1: varchar("address_line1", { length: 120 }).notNull(),
    addressLine2: varchar("address_line2", { length: 120 }),
    city: varchar("city", { length: 60 }).notNull(),
    district: varchar("district", { length: 60 }).notNull(),
    postalCode: varchar("postal_code", { length: 10 }),
    notes: varchar("notes", { length: 500 }),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
    status: orderStatusEnum("status").notNull().default("pending_confirmation"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    /** Refundable rental deposits (included in totalCents). */
    depositCents: integer("deposit_cents").notNull().default(0),
    depositStatus: depositStatusEnum("deposit_status").notNull().default("none"),
    totalCents: integer("total_cents").notNull(),
    courierName: varchar("courier_name", { length: 60 }),
    trackingNumber: varchar("tracking_number", { length: 60 }),
    trackingUrl: text("tracking_url"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    // Client-generated UUID per checkout attempt: a double-click/refresh returns the same order instead of a new one.
    idempotencyKey: uuid("idempotency_key"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.orderNumber),
    uniqueIndex("orders_idempotency_key_uq").on(t.idempotencyKey), // NULLs allowed (older / API clients)
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_email_idx").on(t.email),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    // Snapshots so the order stays correct even if the product changes later
    productName: varchar("product_name", { length: 120 }).notNull(),
    size: varchar("size", { length: 10 }).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    // Rentals: event date, delivery and collection dates, deposit per piece
    mode: itemModeEnum("mode").notNull().default("buy"),
    eventDate: date("event_date"),
    rentStart: date("rent_start"),
    rentEnd: date("rent_end"),
    depositCents: integer("deposit_cents").notNull().default(0),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check("order_items_qty_positive", sql`${t.quantity} > 0`),
    check("order_items_rent_dates", sql`${t.mode} = 'buy' or (${t.eventDate} is not null and ${t.rentStart} is not null and ${t.rentEnd} is not null)`),
  ],
);

/**
 * A rented piece is booked from delivery until it's back and cleaned (end_date includes the cleaning days).
 * Availability for a size = rent_stock − active bookings overlapping the requested dates.
 */
export const rentalBookings = pgTable(
  "rental_bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    quantity: integer("quantity").notNull(),
    status: bookingStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rental_bookings_variant_dates_idx").on(t.variantId, t.startDate, t.endDate),
    index("rental_bookings_order_idx").on(t.orderId),
    check("rental_bookings_dates", sql`${t.endDate} >= ${t.startDate}`),
    check("rental_bookings_qty_positive", sql`${t.quantity} > 0`),
  ],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull(),
    note: varchar("note", { length: 300 }),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId)],
);

/* ---------- Reviews (verified purchases only, moderated) ---------- */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 80 }).notNull(),
    rating: integer("rating").notNull(),
    title: varchar("title", { length: 80 }),
    body: varchar("body", { length: 1500 }).notNull(),
    fit: reviewFitEnum("fit"),
    photoUrl: text("photo_url"), // re-encoded upload; only shown publicly once the review is approved
    status: reviewStatusEnum("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reviews_order_product_uq").on(t.orderId, t.productId), // one review per product per order
    index("reviews_product_status_idx").on(t.productId, t.status),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
  ],
);

/* ---------- Audit log (admin actions & security events) ---------- */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(), // e.g. "order.status_changed", "auth.login_failed"
    entity: varchar("entity", { length: 40 }),
    entityId: varchar("entity_id", { length: 64 }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: varchar("ip", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_action_idx").on(t.action), index("audit_logs_created_idx").on(t.createdAt)],
);

/* ---------- Shop settings edited in the admin (key → JSON value, validated by a Zod schema per key) ---------- */
export const settings = pgTable("settings", {
  key: varchar("key", { length: 60 }).primaryKey(), // e.g. "couriers"
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
