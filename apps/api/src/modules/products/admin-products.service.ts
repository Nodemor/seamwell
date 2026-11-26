import { type AdminProductInput, type AdminProductUpdate, colomboToday, compareSizes } from "@seamwell/shared";
import { and, asc, count, desc, eq, gte, ilike, max, or, sql, sum } from "drizzle-orm";
import { db } from "../../db/client.js";
import { categories, productImages, products, productVariants, rentalBookings } from "../../db/schema.js";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, notFound } from "../../lib/http-error.js";
import { deleteUpload, type ImageKind, processImage, saveImage } from "../../lib/uploads.js";
import { likeEscape } from "./products.service.js";

type Actor = { adminId: string; ip?: string };
const PAGE_SIZE = 25;
const MAX_IMAGES = 12;

const isUnique = (e: unknown, constraint: string) => {
  const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const c = err?.cause ?? err;
  return c?.code === "23505" && c?.constraint === constraint;
};

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "product";

/** First free slug: navy-suit, navy-suit-2, navy-suit-3… */
async function uniqueSlug(base: string, exceptId?: string) {
  const taken = await db.select({ id: products.id, slug: products.slug }).from(products).where(or(eq(products.slug, base), ilike(products.slug, `${likeEscape(base)}-%`)));
  const used = new Set(taken.filter((t) => t.id !== exceptId).map((t) => t.slug));
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
  throw conflict("Too many products with this name — choose a different slug");
}

async function assertCategory(categoryId: string, gender: string) {
  const cat = await db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  if (!cat) throw badRequest("Please check the highlighted fields", [{ path: "categoryId", message: "Choose a category" }]);
  if (cat.gender !== gender && cat.gender !== "unisex" && gender !== "unisex") {
    throw badRequest("Please check the highlighted fields", [{ path: "categoryId", message: `That category is for ${cat.gender}` }]);
  }
}

/* ---------- Products ---------- */
export async function listProducts(f: { q?: string; status: "active" | "archived" | "all"; page: number }) {
  const where = [];
  if (f.status !== "all") where.push(eq(products.isActive, f.status === "active"));
  if (f.q) {
    const term = `%${likeEscape(f.q)}%`;
    where.push(or(ilike(products.name, term), ilike(products.slug, term), ilike(categories.name, term))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const stock = db
    .select({ productId: productVariants.productId, total: sum(productVariants.stock).mapWith(Number).as("total"), sizes: count().as("sizes"), low: sql<number>`count(*) filter (where ${productVariants.stock} <= 3)::int`.as("low") })
    .from(productVariants)
    .groupBy(productVariants.productId)
    .as("stock");
  const firstImage = sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = ${products.id} order by ${productImages.sortOrder} limit 1)`;
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        gender: products.gender,
        categoryName: categories.name,
        priceCents: products.priceCents,
        isActive: products.isActive,
        tryonEnabled: products.tryonEnabled,
        hasTryonPhoto: sql<boolean>`${products.tryonImageUrl} is not null`,
        imageUrl: firstImage,
        totalStock: sql<number>`coalesce(${stock.total}, 0)::int`,
        sizes: sql<number>`coalesce(${stock.sizes}, 0)::int`,
        lowSizes: sql<number>`coalesce(${stock.low}, 0)::int`,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(stock, eq(stock.productId, products.id))
      .where(cond)
      .orderBy(desc(products.isActive), desc(products.updatedAt))
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(products).innerJoin(categories, eq(products.categoryId, categories.id)).where(cond),
  ]);
  return { products: rows, total: totals?.n ?? 0, page: f.page, pageSize: PAGE_SIZE };
}

/** Everything the editor needs, including stock (admins only). */
export async function getProduct(id: string) {
  const product = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!product) throw notFound("Product not found");
  const [images, variants] = await Promise.all([
    db.select({ id: productImages.id, url: productImages.url, alt: productImages.alt, sortOrder: productImages.sortOrder }).from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder)),
    db.select({ id: productVariants.id, size: productVariants.size, sku: productVariants.sku, stock: productVariants.stock, rentStock: productVariants.rentStock, priceOverrideCents: productVariants.priceOverrideCents }).from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.sku)),
  ]);
  const { ratingAvg, ...rest } = product;
  return { ...rest, ratingAvgX100: ratingAvg, images, variants: variants.sort((a, b) => compareSizes(a.size, b.size)) };
}

/** Sale start/end arrive as ISO strings; store them as timestamps (null clears, undefined leaves unchanged). */
const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));
const fieldError = (path: string, message: string) => badRequest("Please check the highlighted fields", [{ path, message }]);

export async function createProduct(input: AdminProductInput, a: Actor) {
  await assertCategory(input.categoryId, input.gender);
  const slug = await uniqueSlug(input.slug || slugify(input.name));
  try {
    const [p] = await db
      .insert(products)
      .values({ ...input, slug, compareAtCents: input.compareAtCents ?? null, colorHex: input.colorHex ?? null, saleStartsAt: toDate(input.saleStartsAt), saleEndsAt: toDate(input.saleEndsAt) })
      .returning({ id: products.id });
    await audit({ actorId: a.adminId, action: "product.created", entity: "product", entityId: p!.id, meta: { name: input.name }, ip: a.ip });
    return getProduct(p!.id);
  } catch (e) {
    if (isUnique(e, "products_slug_uq")) throw badRequest("Please check the highlighted fields", [{ path: "slug", message: "That web address is already used" }]);
    throw e;
  }
}

export async function updateProduct(id: string, input: AdminProductUpdate, a: Actor) {
  const current = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!current) throw notFound("Product not found");
  if (input.categoryId || input.gender) await assertCategory(input.categoryId ?? current.categoryId, input.gender ?? current.gender);
  // The "was" price must beat the (possibly unchanged) price
  const price = input.priceCents ?? current.priceCents;
  const was = input.compareAtCents === undefined ? current.compareAtCents : input.compareAtCents;
  if (was != null && was <= price) throw badRequest("Please check the highlighted fields", [{ path: "compareAtCents", message: "The 'was' price must be higher than the price" }]);
  // Rent + sale rules against the merged (current + changed) values
  const pick = <T,>(next: T | undefined, cur: T) => (next === undefined ? cur : next);
  if (pick(input.rentEnabled, current.rentEnabled) && !pick(input.rentPriceCents, current.rentPriceCents)) throw fieldError("rentPriceCents", "Set a rent price to allow renting");
  const sale = pick(input.salePriceCents, current.salePriceCents);
  if (sale != null && sale >= price) throw fieldError("salePriceCents", "The sale price must be lower than the price");
  const starts = input.saleStartsAt === undefined ? current.saleStartsAt : toDate(input.saleStartsAt);
  const ends = input.saleEndsAt === undefined ? current.saleEndsAt : toDate(input.saleEndsAt);
  if (starts && ends && ends <= starts) throw fieldError("saleEndsAt", "The sale must end after it starts");
  const slug = input.slug && input.slug !== current.slug ? await uniqueSlug(input.slug, id) : undefined;
  try {
    await db
      .update(products)
      .set({ ...input, ...(slug && { slug }), saleStartsAt: toDate(input.saleStartsAt), saleEndsAt: toDate(input.saleEndsAt) })
      .where(eq(products.id, id));
  } catch (e) {
    if (isUnique(e, "products_slug_uq")) throw badRequest("Please check the highlighted fields", [{ path: "slug", message: "That web address is already used" }]);
    throw e;
  }
  const action = input.isActive === false && current.isActive ? "product.archived" : input.isActive === true && !current.isActive ? "product.restored" : "product.updated";
  await audit({ actorId: a.adminId, action, entity: "product", entityId: id, meta: { fields: Object.keys(input) }, ip: a.ip });
  return getProduct(id);
}

/* ---------- Variants (sizes & stock) ---------- */
type VariantInput = { size: string; sku: string; stock: number; priceOverrideCents?: number | null; rentStock?: number };

async function assertProduct(id: string) {
  const p = await db.query.products.findFirst({ where: eq(products.id, id), columns: { id: true } });
  if (!p) throw notFound("Product not found");
}

export async function addVariant(productId: string, v: VariantInput, a: Actor) {
  await assertProduct(productId);
  const dupSize = await db.query.productVariants.findFirst({ where: and(eq(productVariants.productId, productId), eq(productVariants.size, v.size)), columns: { id: true } });
  if (dupSize) throw badRequest("Please check the highlighted fields", [{ path: "size", message: "This product already has that size" }]);
  try {
    const [row] = await db.insert(productVariants).values({ productId, size: v.size, sku: v.sku, stock: v.stock, rentStock: v.rentStock ?? 0, priceOverrideCents: v.priceOverrideCents ?? null }).returning({ id: productVariants.id });
    await audit({ actorId: a.adminId, action: "variant.created", entity: "product", entityId: productId, meta: { sku: v.sku, stock: v.stock }, ip: a.ip });
    return row!;
  } catch (e) {
    if (isUnique(e, "product_variants_sku_uq")) throw badRequest("Please check the highlighted fields", [{ path: "sku", message: "That SKU is already used" }]);
    throw e;
  }
}

export async function updateVariant(productId: string, variantId: string, v: Partial<VariantInput>, a: Actor) {
  const current = await db.query.productVariants.findFirst({ where: and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)) });
  if (!current) throw notFound("Size not found");
  if (v.size && v.size !== current.size) {
    const dup = await db.query.productVariants.findFirst({ where: and(eq(productVariants.productId, productId), eq(productVariants.size, v.size)), columns: { id: true } });
    if (dup) throw badRequest("Please check the highlighted fields", [{ path: "size", message: "This product already has that size" }]);
  }
  try {
    await db.update(productVariants).set(v).where(eq(productVariants.id, variantId));
  } catch (e) {
    if (isUnique(e, "product_variants_sku_uq")) throw badRequest("Please check the highlighted fields", [{ path: "sku", message: "That SKU is already used" }]);
    throw e;
  }
  await audit({ actorId: a.adminId, action: "variant.updated", entity: "product", entityId: productId, meta: { sku: v.sku ?? current.sku, ...(v.stock !== undefined && { stockFrom: current.stock, stockTo: v.stock }), ...(v.rentStock !== undefined && { rentStockFrom: current.rentStock, rentStockTo: v.rentStock }) }, ip: a.ip });
}

export async function deleteVariant(productId: string, variantId: string, a: Actor) {
  // Don't delete a size that is booked for a rental that hasn't finished (the booking would vanish with it)
  const [upcoming] = await db
    .select({ n: count() })
    .from(rentalBookings)
    .where(and(eq(rentalBookings.variantId, variantId), eq(rentalBookings.status, "active"), gte(rentalBookings.endDate, colomboToday())));
  if (upcoming?.n) throw conflict("This size has rentals booked. Set its rental pieces to 0 instead, and delete it after they're returned.");
  const [row] = await db.delete(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId))).returning({ sku: productVariants.sku });
  if (!row) throw notFound("Size not found");
  await audit({ actorId: a.adminId, action: "variant.deleted", entity: "product", entityId: productId, meta: { sku: row.sku }, ip: a.ip });
}

/* ---------- Photos ---------- */
export async function addImage(productId: string, file: Express.Multer.File | undefined, alt: string, a: Actor) {
  const img = await processImage(file, "gallery"); // reject non-images before touching the database
  await assertProduct(productId);
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(productImages).where(eq(productImages.productId, productId));
  if (n >= MAX_IMAGES) throw badRequest(`A product can have up to ${MAX_IMAGES} photos`);
  const url = await saveImage(img);
  const [{ top } = { top: -1 }] = await db.select({ top: max(productImages.sortOrder) }).from(productImages).where(eq(productImages.productId, productId));
  const [row] = await db
    .insert(productImages)
    .values({ productId, url, alt: alt.slice(0, 160), sortOrder: (top ?? -1) + 1 })
    .returning({ id: productImages.id, url: productImages.url, alt: productImages.alt, sortOrder: productImages.sortOrder });
  await audit({ actorId: a.adminId, action: "product.image_added", entity: "product", entityId: productId, meta: { url }, ip: a.ip });
  return row!;
}

export async function updateImageAlt(productId: string, imageId: string, alt: string, a: Actor) {
  const [row] = await db.update(productImages).set({ alt }).where(and(eq(productImages.id, imageId), eq(productImages.productId, productId))).returning({ id: productImages.id });
  if (!row) throw notFound("Photo not found");
  await audit({ actorId: a.adminId, action: "product.image_updated", entity: "product", entityId: productId, ip: a.ip });
}

/** New order = the full list of this product's image ids, first = main photo. */
export async function reorderImages(productId: string, ids: string[], a: Actor) {
  const existing = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId));
  const have = new Set(existing.map((e) => e.id));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || !ids.every((id) => have.has(id))) {
    throw badRequest("The photo list changed — reload the page and try again");
  }
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(productImages).set({ sortOrder: i }).where(eq(productImages.id, id));
  });
  await audit({ actorId: a.adminId, action: "product.images_reordered", entity: "product", entityId: productId, ip: a.ip });
}

export async function deleteImage(productId: string, imageId: string, a: Actor) {
  const [row] = await db.delete(productImages).where(and(eq(productImages.id, imageId), eq(productImages.productId, productId))).returning({ url: productImages.url });
  if (!row) throw notFound("Photo not found");
  // Only remove the file if no other product still uses it
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(productImages).where(eq(productImages.url, row.url));
  if (!n) await deleteUpload(row.url);
  await audit({ actorId: a.adminId, action: "product.image_deleted", entity: "product", entityId: productId, meta: { url: row.url }, ip: a.ip });
}

/** White-background garment photo sent to the try-on model (JPEG). Replaces the previous one. */
export async function setTryonImage(productId: string, file: Express.Multer.File | undefined, a: Actor) {
  const img = await processImage(file, "tryon" satisfies ImageKind); // reject non-images before touching the database
  const current = await db.query.products.findFirst({ where: eq(products.id, productId), columns: { tryonImageUrl: true } });
  if (!current) throw notFound("Product not found");
  const url = await saveImage(img);
  await db.update(products).set({ tryonImageUrl: url }).where(eq(products.id, productId));
  await deleteUpload(current.tryonImageUrl);
  await audit({ actorId: a.adminId, action: "product.tryon_photo_set", entity: "product", entityId: productId, meta: { url, width: img.width, height: img.height }, ip: a.ip });
  return { tryonImageUrl: url, width: img.width, height: img.height };
}
