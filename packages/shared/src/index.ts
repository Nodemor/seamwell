/**
 * Shared constants, types and Zod schemas used by BOTH the API and the web app.
 * Rule: every request body the API accepts is validated with a schema from this file.
 */
import { z } from "zod";

// Browser only: Zod 4 probes `new Function("")` to enable its JIT parser. Our CSP (correctly) forbids eval,
// so the probe shows up as a CSP violation on every page. jitless mode skips the probe; forms are tiny, so
// there's no practical speed cost. The API (Node) keeps the JIT path.
if ("document" in globalThis) z.config({ jitless: true });

/* ---------- Enums (keep in sync with apps/api/src/db/schema.ts) ---------- */
export const GENDERS = ["men", "women", "unisex"] as const;
export const ORDER_STATUSES = [
  "pending_confirmation", // order placed, shop has not confirmed yet
  "awaiting_payment",     // bank transfer: waiting for the customer's transfer
  "confirmed",            // shop confirmed (COD) or payment received (bank transfer)
  "processing",           // being tailored / altered / packed
  "ready_to_ship",
  "shipped",              // handed to courier — tracking number required
  "delivered",
  "returned",             // rental orders only: the rented pieces came back (deposit settled)
  "cancelled",
] as const;
export const PAYMENT_METHODS = ["cod", "bank_transfer"] as const; // "payhere" etc. added in the payment-gateway phase
export const PAYMENT_STATUSES = ["unpaid", "pending_verification", "paid", "refunded"] as const;
export const TRYON_SLOTS = ["kit", "blazer", "shirt", "trousers"] as const;
export const TRYON_PHOTO_TYPES = ["flat-lay", "model"] as const;
/** The 25 administrative districts of Sri Lanka (delivery address must be one of these). */
export const SL_DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", "Hambantota", "Jaffna",
  "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala",
  "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya",
] as const;
export type District = (typeof SL_DISTRICTS)[number];

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36", "38", "40", "42", "44", "46"] as const;
/** Sort key for a size: XS → XXL, then numeric sizes ascending; anything unknown goes last in A–Z order. */
export function compareSizes(a: string, b: string) {
  const rank = (s: string) => {
    const i = (SIZES as readonly string[]).indexOf(s.toUpperCase());
    if (i !== -1) return i;
    const n = Number(s);
    return Number.isFinite(n) ? 100 + n : 10_000;
  };
  return rank(a) - rank(b) || a.localeCompare(b);
}

export type Gender = (typeof GENDERS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type TryOnSlot = (typeof TRYON_SLOTS)[number];

/** Which status changes the admin is allowed to make. Enforced server-side. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ["awaiting_payment", "confirmed", "cancelled"],
  awaiting_payment: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["ready_to_ship", "cancelled"],
  ready_to_ship: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["returned"], // only allowed for orders with rentals (enforced by the API)
  returned: [],
  cancelled: [],
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_confirmation: "Order placed",
  awaiting_payment: "Waiting for bank transfer",
  confirmed: "Confirmed",
  processing: "Being tailored",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

/* ---------- Reusable field schemas ---------- */
/** Required text with human messages (they are shown under form fields as-is). */
const trimmed = (max: number, required = "Please fill this in") =>
  z.string({ error: required }).trim().min(1, required).max(max, `Please keep this under ${max} characters`);
export const emailSchema = z
  .email({ error: (iss) => (iss.input === undefined || iss.input === "" ? "Enter your email address" : "Enter a valid email address, like name@example.com") })
  .trim()
  .toLowerCase()
  .max(254);
/** Sri Lankan mobile/landline, digits with optional +94. */
export const phoneSchema = z
  .string({ error: "Enter your mobile number" })
  .trim()
  .regex(/^(\+94|0)\d{9}$/, "Enter a Sri Lankan number, like 071 234 5678");
/** Strong-enough password: 10+ chars, letters and a number. (Breached-password check runs on the API.) */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a number");
export const totpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");
export const uuidSchema = z.uuid();

/* ---------- Auth ---------- */
export const registerSchema = z.object({
  name: trimmed(80),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const mfaVerifySchema = z.object({
  mfaToken: z.string().min(10).max(2000),
  code: z.string().trim().min(6).max(20), // TOTP code or a recovery code
});
export const mfaEnableSchema = z.object({ code: totpCodeSchema });
export const mfaDisableSchema = z.object({ password: z.string().min(1).max(128), code: totpCodeSchema });

/** One-time emailed token (32 random bytes, base64url = 43 chars). Anything else is rejected before the DB. */
export const emailTokenSchema = z.string({ error: "This link is incomplete" }).trim().regex(/^[A-Za-z0-9_-]{43}$/, "This link is invalid or has expired");
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: emailTokenSchema, password: passwordSchema });
export const verifyEmailSchema = z.object({ token: emailTokenSchema });
export const changePasswordSchema = z
  .object({ currentPassword: z.string({ error: "Enter your current password" }).min(1, "Enter your current password").max(128), newPassword: passwordSchema })
  .refine((v) => v.currentPassword !== v.newPassword, { path: ["newPassword"], message: "Choose a password you haven't used here" });

/**
 * `?next=` after sign-in: only same-site relative paths. Rejects absolute URLs, protocol-relative "//evil.com",
 * backslash tricks ("/\evil.com" — browsers treat "\" as "/"), control characters and the auth pages themselves.
 */
export function safeNextPath(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]|%[01][0-9a-f]|%7f/i.test(next)) return fallback; // raw or percent-encoded control chars
  let url: URL;
  try {
    url = new URL(next, "https://seamwell.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://seamwell.invalid") return fallback;
  if (/^\/(login|register|forgot-password|reset-password|verify-email)(\/|$)/.test(url.pathname)) return fallback;
  const out = url.pathname + url.search + url.hash;
  // Dot-segments can normalise into a protocol-relative URL ("/..//evil.com" → "//evil.com"): check again.
  return out.startsWith("//") || out.includes("\\") ? fallback : out;
}

/* ---------- Catalogue ---------- */
export const PRODUCT_SORTS = ["new", "price_asc", "price_desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
/** Price filter bound in LKR cents (0 … LKR 1,000,000). */
const priceFilter = z.coerce.number().int().min(0).max(100_000_000);
export const slugSchema = z.string().regex(/^[a-z0-9-]{1,120}$/);

export const productQuerySchema = z
  .object({
    gender: z.enum(GENDERS).optional(),
    category: z.string().trim().max(60).regex(/^[a-z0-9-]+$/).optional(),
    q: z.string().trim().max(80).optional(),
    /** Only products with an IN-STOCK variant of this size. */
    size: z.enum(SIZES).optional(),
    /** Exact fabric name, e.g. "Pure linen" (letters, digits, spaces and . , ' & / - only). */
    fabric: z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N} .,'&/-]+$/u).optional(),
    minPrice: priceFilter.optional(),
    maxPrice: priceFilter.optional(),
    sort: z.enum(PRODUCT_SORTS).default("new"),
    page: z.coerce.number().int().min(1).max(500).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(12),
    /** "1" → also return available filter values (sizes, fabrics, price range) for the gender/category/search scope. */
    facets: z.literal("1").optional(),
    /** "1" → only products that can be rented. */
    rent: z.literal("1").optional(),
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: "Minimum price must be below the maximum",
    path: ["maxPrice"],
  });
export type ProductQuery = z.infer<typeof productQuerySchema>;

export interface ProductFacets {
  sizes: string[];
  fabrics: string[];
  price: { min: number; max: number } | null;
}

/* ---------- Checkout (guest or logged-in) ---------- */
export const districtSchema = z.enum(SL_DISTRICTS, { error: "Choose your district" });
export const addressSchema = z.object({
  line1: trimmed(120, "Enter your street address"),
  line2: z.string().trim().max(120).optional(),
  city: trimmed(60, "Enter your city or town"),
  district: districtSchema,
  postalCode: z.string().trim().regex(/^\d{5}$/, "Postal codes have 5 digits").optional(),
});

/* ---------- Rentals & sale prices ---------- */
export * from "./rental";
import { isIsoDate, type ItemMode, ITEM_MODES, RENTAL } from "./rental";

/** A calendar date field (YYYY-MM-DD). */
export const isoDaySchema = z.string({ error: "Choose a date" }).refine(isIsoDate, "Choose a valid date");

/**
 * One bag line as sent by the client: variant + quantity, and for rentals the event date. Prices, deposits and
 * availability are ALWAYS worked out on the server.
 */
export const cartItemSchema = z
  .object({
    variantId: uuidSchema,
    quantity: z.number().int().min(1).max(10),
    mode: z.enum(ITEM_MODES).default("buy"),
    eventDate: isoDaySchema.optional(),
  })
  .refine((v) => (v.mode === "rent" ? !!v.eventDate : v.eventDate === undefined), { path: ["eventDate"], message: "Choose your event date" })
  .refine((v) => v.mode === "buy" || v.quantity <= RENTAL.maxQty, { path: ["quantity"], message: `You can rent up to ${RENTAL.maxQty} of the same piece` });
export type CartItemInput = z.input<typeof cartItemSchema>;

/** Bag lines as sent by the client: IDs, quantities and rental dates only — prices are ALWAYS calculated on the server. */
export const cartItemsSchema = z.array(cartItemSchema).min(1).max(30);

/** POST /orders/quote — server-priced bag preview. */
export const quoteSchema = z.object({ items: cartItemsSchema });

/** Idempotency-Key header on POST /orders: one random UUID per checkout attempt. */
export const idempotencyKeySchema = z.uuid({ error: "Idempotency-Key must be a UUID" });

export type UnavailableReason = "not_found" | "sold_out" | "not_enough_stock" | "not_rentable" | "not_available_dates" | "invalid_date";
export interface QuoteLine {
  variantId: string;
  mode: ItemMode;
  /** Rentals: the event date and when the piece is delivered / collected. */
  eventDate?: string;
  deliverOn?: string;
  returnOn?: string;
  /** Refundable deposit per piece (rentals; 0 for purchases). */
  depositCents: number;
  productSlug: string;
  productName: string;
  size: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  /** First product photo (for bag thumbnails), if any. */
  imageUrl: string | null;
}
export interface OrderQuote {
  lines: QuoteLine[];
  /** Lines that can't be ordered as-is. Never includes stock counts. */
  unavailable: { variantId: string; mode?: ItemMode; eventDate?: string; reason: UnavailableReason; productName?: string; size?: string; message?: string }[];
  subtotalCents: number;
  shippingCents: number;
  /** Refundable rental deposits (included in totalCents). */
  depositCents: number;
  totalCents: number;
  freeShippingThresholdCents: number;
}

/* ---------- Saved addresses (signed-in customers) ---------- */
export const savedAddressSchema = addressSchema.extend({
  label: trimmed(40, "Give this address a name, like Home"),
  isDefault: z.boolean().optional(),
});
export const savedAddressUpdateSchema = savedAddressSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
export type SavedAddressInput = z.infer<typeof savedAddressSchema>;
export const checkoutSchema = z.object({
  customer: z.object({ name: trimmed(80, "Enter your full name"), email: emailSchema, phone: phoneSchema }),
  shippingAddress: addressSchema,
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(500).optional(),
  /** Client sends only IDs and quantities. Prices are ALWAYS calculated on the server. */
  items: cartItemsSchema,
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().toUpperCase().regex(/^SW-[A-Z0-9]{6,10}$/, "Check your order number"),
  email: emailSchema,
});

/* ---------- Admin: order updates ---------- */
export const orderStatusUpdateSchema = z
  .object({
    status: z.enum(ORDER_STATUSES),
    note: z.string().trim().max(300).optional(),
    courierName: z.string().trim().max(60).optional(),
    trackingNumber: z.string().trim().max(60).regex(/^[A-Za-z0-9-]+$/).optional(),
    trackingUrl: z.url({ protocol: /^https$/ }).max(300).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    /** With status "returned": what happened to the rental deposit. */
    depositStatus: z.enum(["refunded", "kept"]).optional(),
  })
  .refine((v) => v.status !== "shipped" || (v.courierName && v.trackingNumber), {
    message: "Courier name and tracking number are required when marking an order as shipped",
    path: ["trackingNumber"],
  });

/* ---------- Reviews ---------- */
export const REVIEW_FITS = ["small", "true", "large"] as const;
export type ReviewFit = (typeof REVIEW_FITS)[number];
export const REVIEW_FIT_LABEL: Record<ReviewFit, string> = { small: "Runs small", true: "True to size", large: "Runs large" };
export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 1500;
export const reviewCreateSchema = z.object({
  productId: uuidSchema,
  rating: z.number({ error: "Choose a star rating" }).int().min(1, "Choose a star rating").max(5),
  title: z.string().trim().max(80, "Keep the title under 80 characters").optional(),
  body: z
    .string({ error: "Tell us a little about it" })
    .trim()
    .min(REVIEW_BODY_MIN, `Write at least ${REVIEW_BODY_MIN} characters`)
    .max(REVIEW_BODY_MAX, `Keep it under ${REVIEW_BODY_MAX} characters`),
  fit: z.enum(REVIEW_FITS).optional(),
  /** Guests prove the purchase with their order number + email (same as order tracking). */
  orderNumber: z.string().trim().toUpperCase().optional(),
  email: emailSchema.optional(),
});
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

/* ---------- Helpers ---------- */
/** Prices are stored as integer cents (LKR). */
export { formatLKR } from "./format";

/* ---------- Admin (phase 5) ---------- */

/** Courier presets. Tracking-link templates are edited by the admin in Settings (`{tracking}` is replaced). */
export const COURIERS = [
  { id: "domex", name: "Domex" },
  { id: "pronto", name: "Pronto" },
  { id: "citypak", name: "Citypak" },
  { id: "kapruka", name: "Kapruka" },
  { id: "slpost", name: "Sri Lanka Post" },
  { id: "other", name: "Other" },
] as const;
export type CourierId = (typeof COURIERS)[number]["id"];
export const COURIER_IDS = COURIERS.map((c) => c.id) as [CourierId, ...CourierId[]];

/** A tracking-link template: https only, must contain {tracking}. Empty = no automatic link. */
export const trackingTemplateSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || (/^https:\/\/[^\s]+$/.test(v) && v.includes("{tracking}") && URL.canParse(v.replace("{tracking}", "X1"))), {
    message: "Use an https:// link that contains {tracking}, e.g. https://courier.lk/track?no={tracking}",
  });
export const courierSettingsSchema = z.object({
  templates: z.partialRecord(z.enum(COURIER_IDS), trackingTemplateSchema),
});
export type CourierSettings = z.infer<typeof courierSettingsSchema>;

/** Fill a courier template with a tracking number (URL-encoded). Returns undefined if there's no template. */
export function trackingUrlFor(template: string | undefined | null, trackingNumber: string): string | undefined {
  if (!template || !trackingNumber) return undefined;
  return template.replace("{tracking}", encodeURIComponent(trackingNumber.trim()));
}

export const PRODUCT_STATUSES = ["active", "archived", "all"] as const;
export const adminProductListSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(PRODUCT_STATUSES).default("all"),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters`)
    .transform((v) => v || null)
    .nullable()
    .optional();
const cents = (msg: string) => z.number({ error: msg }).int(msg).min(1, msg).max(100_000_000, "That price looks too high");

/** Product fields without defaults (so a PATCH never silently resets something it didn't send). */
const productFields = {
  name: trimmed(120, "Give the product a name"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lower-case letters, numbers and dashes only")
    .max(120)
    .optional(),
  description: z.string().trim().max(4000),
  categoryId: z.uuid({ error: "Choose a category" }),
  gender: z.enum(GENDERS, { error: "Choose who it's for" }),
  priceCents: cents("Enter a price"),
  compareAtCents: cents("Enter a valid price").nullable().optional(),
  fabric: optionalText(80),
  fit: optionalText(40),
  color: optionalText(40),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1F2A44")
    .nullable()
    .optional(),
  isActive: z.boolean(),
  tryonEnabled: z.boolean(),
  tryonSlot: z.enum(TRYON_SLOTS, { error: "Choose how it's tried on" }),
  tryonPhotoType: z.enum(TRYON_PHOTO_TYPES),
  // Renting (event-date rentals with a refundable deposit)
  rentEnabled: z.boolean(),
  rentPriceCents: cents("Enter the rent price").nullable().optional(),
  rentDepositCents: z.number({ error: "Enter the deposit" }).int("Enter the deposit").min(0, "The deposit can't be negative").max(100_000_000).nullable().optional(),
  rentDays: z.number({ error: "Enter the rental days" }).int().min(RENTAL.minDays, `At least ${RENTAL.minDays} days`).max(RENTAL.maxDays, `At most ${RENTAL.maxDays} days`),
  // Scheduled sale price (buying only)
  salePriceCents: cents("Enter the sale price").nullable().optional(),
  saleStartsAt: z.iso.datetime({ offset: true, error: "Choose when the sale starts" }).nullable().optional(),
  saleEndsAt: z.iso.datetime({ offset: true, error: "Choose when the sale ends" }).nullable().optional(),
};
const rentOk = (v: { rentEnabled?: boolean; rentPriceCents?: number | null }) => v.rentEnabled !== true || v.rentPriceCents === undefined || v.rentPriceCents !== null;
const rentIssue = { path: ["rentPriceCents"], message: "Set a rent price to allow renting" };
const saleOk = (v: { priceCents?: number; salePriceCents?: number | null }) => v.salePriceCents == null || v.priceCents === undefined || v.salePriceCents < v.priceCents;
const saleIssue = { path: ["salePriceCents"], message: "The sale price must be lower than the price" };
const saleDatesOk = (v: { saleStartsAt?: string | null; saleEndsAt?: string | null }) => !v.saleStartsAt || !v.saleEndsAt || Date.parse(v.saleEndsAt) > Date.parse(v.saleStartsAt);
const saleDatesIssue = { path: ["saleEndsAt"], message: "The sale must end after it starts" };
const wasPriceOk = (v: { priceCents?: number; compareAtCents?: number | null }) =>
  v.compareAtCents == null || v.priceCents === undefined || v.compareAtCents > v.priceCents;
const wasPriceIssue = { path: ["compareAtCents"], message: "The 'was' price must be higher than the price" };

export const adminProductSchema = z
  .object({
    ...productFields,
    description: productFields.description.default(""),
    isActive: productFields.isActive.default(true),
    tryonEnabled: productFields.tryonEnabled.default(true),
    tryonPhotoType: productFields.tryonPhotoType.default("flat-lay"),
    rentEnabled: productFields.rentEnabled.default(false),
    rentDays: productFields.rentDays.default(RENTAL.defaultDays),
  })
  .refine(wasPriceOk, wasPriceIssue)
  .refine((v) => !v.rentEnabled || v.rentPriceCents != null, rentIssue)
  .refine(saleOk, saleIssue)
  .refine(saleDatesOk, saleDatesIssue);
export type AdminProductInput = z.infer<typeof adminProductSchema>;
/** PATCH: any subset of fields (archive = { isActive: false }). */
export const adminProductUpdateSchema = z
  .object(productFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" })
  .refine(wasPriceOk, wasPriceIssue)
  .refine(rentOk, rentIssue)
  .refine(saleOk, saleIssue)
  .refine(saleDatesOk, saleDatesIssue);
export type AdminProductUpdate = z.infer<typeof adminProductUpdateSchema>;

export const adminVariantSchema = z.object({
  size: z.enum(SIZES, { error: "Choose a size" }),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,58}$/, "Letters, numbers and dashes, e.g. SW-NAVY-40"),
  stock: z.number({ error: "Enter the stock" }).int().min(0, "Stock can't be negative").max(100_000),
  priceOverrideCents: cents("Enter a valid price").nullable().optional(),
  /** Pieces of this size available for RENTING (separate from stock for sale). */
  rentStock: z.number({ error: "Enter the rental pieces" }).int().min(0, "Can't be negative").max(1000).optional(),
});
export const adminVariantUpdateSchema = adminVariantSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const imageOrderSchema = z.object({ ids: z.array(z.uuid()).min(1).max(30) });
export const imageAltSchema = z.object({ alt: z.string().trim().max(160) });

export const adminOrderListSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  /** Order number (or part of it) or phone digits. */
  q: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const orderExportSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { path: ["to"], message: "The end date must be after the start date" })
  .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 366, { path: ["to"], message: "Export at most one year at a time" });

/** Admin rentals board: what to deliver, what's out, what's due back, what's late. */
export const RENTAL_VIEWS = ["deliver", "out", "due", "overdue", "all"] as const;
export const adminRentalsQuerySchema = z.object({
  view: z.enum(RENTAL_VIEWS).default("deliver"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const auditQuerySchema = z.object({
  action: z.string().trim().regex(/^[a-z_.]{1,60}$/).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

// ---------------------------------------------------------------------------
// Size charts & the try-on helpers (shared so the rules are unit-tested)
// ---------------------------------------------------------------------------

/**
 * Size charts (body measurements in cm). Used by the size-guide dialog and the try-on size helper.
 * Replace with the shop's own block measurements.
 */
export const SIZE_CHARTS = {
  jackets: {
    label: "Suits & blazers",
    note: "Measure around the fullest part of your chest, under the arms.",
    columns: ["Size", "Chest", "Waist", "Sleeve"],
    rows: [
      ["38", "96", "82", "62"],
      ["40", "101", "87", "63"],
      ["42", "106", "92", "64"],
      ["44", "111", "97", "65"],
      ["46", "116", "102", "66"],
    ],
  },
  shirts: {
    label: "Shirts & blouses",
    note: "Measure around the base of your neck and the fullest part of your chest.",
    columns: ["Size", "Neck", "Chest", "Waist"],
    rows: [
      ["S", "37", "94", "80"],
      ["M", "39", "100", "86"],
      ["L", "41", "106", "92"],
      ["XL", "43", "112", "98"],
    ],
  },
  trousers: {
    label: "Trousers",
    note: "Measure around your natural waist, where your trousers sit.",
    columns: ["Size", "Waist", "Hip", "Inside leg"],
    rows: [
      ["28", "72", "90", "78"],
      ["30", "77", "95", "79"],
      ["32", "82", "100", "80"],
      ["34", "87", "105", "81"],
      ["36", "92", "110", "82"],
    ],
  },
} as const;

export type SizeChartKey = keyof typeof SIZE_CHARTS;

/** Which chart belongs to a product's try-on slot. */
export const chartForSlot = (slot: TryOnSlot): SizeChartKey => (slot === "shirt" ? "shirts" : slot === "trousers" ? "trousers" : "jackets");

/** Optional measurements for the size helper (cm). Chest and waist are what the charts use. */
export const measurementsSchema = z.object({
  heightCm: z.coerce.number({ error: "Enter your height in cm" }).min(120, "Enter your height in cm (120–220)").max(220, "Enter your height in cm (120–220)").optional(),
  chestCm: z.coerce.number({ error: "Enter your chest in cm" }).min(70, "Chest: 70–150 cm").max(150, "Chest: 70–150 cm"),
  waistCm: z.coerce.number({ error: "Enter your waist in cm" }).min(55, "Waist: 55–150 cm").max(150, "Waist: 55–150 cm"),
});
export type Measurements = z.infer<typeof measurementsSchema>;

export type SizeSuggestion =
  | { size: string; between: boolean; note?: string }
  | { size: null; note: string };

/**
 * Suggest a size from body measurements — a SUGGESTION, not a fitting.
 * Jackets & shirts go by chest, trousers by waist; the smallest size that is at least the body measurement
 * (between sizes → the larger one, since taking in is easier than letting out). Height only adds a note.
 */
export function suggestSize(slot: TryOnSlot, m: Measurements): SizeSuggestion {
  const chart = SIZE_CHARTS[chartForSlot(slot)];
  const col = chart.columns.indexOf((slot === "trousers" ? "Waist" : "Chest") as never);
  const body = slot === "trousers" ? m.waistCm : m.chestCm;
  const rows = chart.rows.map((r) => ({ size: r[0] as string, cm: Number(r[col]) }));
  const heightNote =
    m.heightCm == null ? undefined
    : m.heightCm >= 188 ? "You're tall — ask us about longer sleeves and leg length (free)."
    : m.heightCm <= 160 ? "We shorten sleeves and hems for free."
    : undefined;
  const first = rows[0]!;
  const last = rows.at(-1)!;
  if (body > last.cm + 2) return { size: null, note: `Larger than our ${chart.label.toLowerCase()} chart — we'll make it to measure. Message us.` };
  if (body < first.cm - 8) return { size: null, note: `Smaller than our ${chart.label.toLowerCase()} chart — we'll make it to measure. Message us.` };
  const hit = rows.find((r) => r.cm >= body) ?? last;
  return { size: hit.size, between: !rows.some((r) => r.cm === body) && body > first.cm && body < last.cm, note: heightNote };
}

/** What the "Complete the look" dialog needs to know about a catalogue item. */
export interface LookItem {
  id: string;
  slot: TryOnSlot;
  color: string | null;
  fabric: string | null;
  name: string;
}

const has = (v: string | null | undefined, words: string[]) => !!v && words.some((w) => v.toLowerCase().includes(w));

/**
 * Simple pairing rules for a blazer picked on its own:
 *  - linen blazer → white shirt + stone chinos
 *  - navy / black / charcoal blazer → white or sky-blue shirt + black or charcoal trousers
 *  - anything else → white shirt; trousers in a neutral that isn't the blazer's colour
 * Returns every shirt / trousers with the recommended ones first (and flagged).
 */
export function completeTheLook<T extends LookItem>(blazer: LookItem, items: T[]): { shirts: (T & { recommended: boolean })[]; trousers: (T & { recommended: boolean })[] } {
  const linen = has(blazer.fabric, ["linen"]) || has(blazer.name, ["linen"]);
  const dark = has(blazer.color, ["navy", "black", "charcoal", "midnight"]);
  const shirtOk = (s: T) => (linen ? has(s.color, ["white"]) : dark ? has(s.color, ["white", "sky"]) : has(s.color, ["white"]));
  const trousersOk = (t: T) =>
    linen ? has(t.color, ["stone"]) || has(t.name, ["chino"])
    : dark ? has(t.color, ["black", "charcoal"])
    : has(t.color, ["black", "charcoal", "navy", "grey", "stone"]) && !has(t.color, [String(blazer.color ?? "").toLowerCase() || "\u0000"]);
  const rank = <U extends T>(list: U[], ok: (x: U) => boolean) =>
    list.map((x) => ({ ...x, recommended: ok(x) })).sort((a, b) => Number(b.recommended) - Number(a.recommended));
  return {
    shirts: rank(items.filter((i) => i.slot === "shirt"), shirtOk),
    trousers: rank(items.filter((i) => i.slot === "trousers"), trousersOk),
  };
}

// ---------------------------------------------------------------------------
// Hidden admin address (docs/02-security.md → Admin area)
// ---------------------------------------------------------------------------
/**
 * The admin area lives at /<ADMIN_PATH>, a long random value set only in the server env files (never in the
 * repo or in public JavaScript). /admin itself answers 404. Dev without ADMIN_PATH keeps /admin.
 * Rule: 16–64 letters, digits, "-" or "_", and not a word anyone would guess.
 */
export const ADMIN_PATH_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const DEFAULT_ADMIN_PATH = "admin";
export function isValidAdminPath(value: string | undefined | null): value is string {
  return !!value && ADMIN_PATH_RE.test(value) && !/^(admin|administrator|dashboard|manage|staff)/i.test(value);
}
/** The configured secret path, or "admin" when none (or an invalid one) is set. */
export function adminPathOrDefault(value: string | undefined | null): string {
  const v = value?.trim().replace(/^\/+|\/+$/g, "");
  return isValidAdminPath(v) ? v : DEFAULT_ADMIN_PATH;
}

/**
 * Is this first URL segment the admin area? Used by app/[staff]/layout.tsx on the server for every request:
 * only the exact secret answers; "admin", "ADMIN" or any other guess → the normal 404 page.
 */
export function isAdminSegment(segment: string, configured: string | undefined | null): boolean {
  const expected = adminPathOrDefault(configured);
  let seg = segment;
  try {
    seg = decodeURIComponent(segment);
  } catch {
    return false;
  }
  if (seg.length !== expected.length) return false;
  let diff = 0; // constant-time compare: no timing hint about how much of a guess was right
  for (let i = 0; i < seg.length; i++) diff |= seg.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
