import { addDays, colomboToday, effectivePricing, type ProductFacets, type ProductQuery, rangesOverlap, RENTAL, rentalWindow, compareSizes } from "@seamwell/shared";
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNotNull, lte, max, min, ne, notInArray, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import { categories, productImages, products, productVariants, rentalBookings } from "../../db/schema.js";

/** Escape % and _ so user search text is matched literally inside ILIKE (still a bound parameter). */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Columns safe to show the public (no stock counts, no internal flags). */
export const publicProduct = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  gender: products.gender,
  priceCents: products.priceCents,
  compareAtCents: products.compareAtCents,
  color: products.color,
  colorHex: products.colorHex,
  fabric: products.fabric,
  fit: products.fit,
  tryonEnabled: products.tryonEnabled,
  tryonSlot: products.tryonSlot,
  tryonPhotoType: products.tryonPhotoType,
  tryonImageUrl: products.tryonImageUrl,
  ratingAvgX100: products.ratingAvg,
  ratingCount: products.ratingCount,
  categorySlug: categories.slug,
  categoryName: categories.name,
  // Mapped by toPublic() before leaving the API (sale window → effective price; rent → one object)
  salePriceCents: products.salePriceCents,
  saleStartsAt: products.saleStartsAt,
  saleEndsAt: products.saleEndsAt,
  rentEnabled: products.rentEnabled,
  rentPriceCents: products.rentPriceCents,
  rentDepositCents: products.rentDepositCents,
  rentDays: products.rentDays,
};

type RawPublic = {
  priceCents: number;
  compareAtCents: number | null;
  salePriceCents: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  rentEnabled: boolean;
  rentPriceCents: number | null;
  rentDepositCents: number | null;
  rentDays: number;
};
/**
 * What the shop shows: the price customers pay now (sale price while a sale runs, normal price crossed out) and the
 * rental terms. The sale schedule itself isn't exposed beyond its end date.
 */
export function toPublic<T extends RawPublic>(p: T, now = new Date()) {
  const { salePriceCents: _s, saleStartsAt: _a, saleEndsAt: _e, rentEnabled, rentPriceCents, rentDepositCents, rentDays, ...rest } = p;
  void _s, void _a, void _e;
  const price = effectivePricing(p, now);
  return {
    ...rest,
    priceCents: price.priceCents,
    compareAtCents: price.compareAtCents,
    onSale: price.onSale,
    saleEndsAt: price.saleEndsAt,
    rent: rentEnabled && rentPriceCents ? { priceCents: rentPriceCents, depositCents: rentDepositCents ?? 0, days: rentDays } : null,
  };
}

type Row = { id: string };

/** Attach ordered {url, alt} images to a list of products (one query). */
export async function withImages<T extends Row>(items: T[]) {
  const ids = items.map((p) => p.id);
  const images = ids.length
    ? await db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.sortOrder))
    : [];
  return items.map((p) => ({ ...("rentEnabled" in p ? toPublic(p as T & RawPublic) : p), images: images.filter((i) => i.productId === p.id).map(({ url, alt }) => ({ url, alt })) }));
}

/** Scope shared by the listing and its facets: active + gender + category + search text. */
function scopeConditions(q: ProductQuery): SQL[] {
  const where: SQL[] = [eq(products.isActive, true)];
  if (q.gender) where.push(inArray(products.gender, [q.gender, "unisex"]));
  if (q.category) where.push(eq(categories.slug, q.category));
  if (q.q) {
    const term = `%${likeEscape(q.q)}%`;
    where.push(or(ilike(products.name, term), ilike(products.fabric, term), ilike(products.color, term), ilike(categories.name, term))!);
  }
  return where;
}

/** Narrowing filters chosen by the shopper: size (in stock), fabric, price range. */
function filterConditions(q: ProductQuery): SQL[] {
  const where: SQL[] = [];
  if (q.size) {
    const inStock = db
      .select({ id: productVariants.productId })
      .from(productVariants)
      .where(and(eq(productVariants.size, q.size), gt(productVariants.stock, 0)));
    where.push(inArray(products.id, inStock));
  }
  if (q.fabric) where.push(eq(products.fabric, q.fabric));
  if (q.rent) {
    const rentable = db.select({ id: productVariants.productId }).from(productVariants).where(gt(productVariants.rentStock, 0));
    where.push(eq(products.rentEnabled, true), inArray(products.id, rentable));
  }
  if (q.minPrice !== undefined) where.push(gte(products.priceCents, q.minPrice));
  if (q.maxPrice !== undefined) where.push(lte(products.priceCents, q.maxPrice));
  return where;
}

export async function listProducts(q: ProductQuery) {
  const where = and(...scopeConditions(q), ...filterConditions(q));
  const order =
    q.sort === "price_asc"
      ? [asc(products.priceCents), asc(products.id)]
      : q.sort === "price_desc"
        ? [desc(products.priceCents), asc(products.id)]
        : [desc(products.createdAt), asc(products.id)];

  const [items, [total], facets] = await Promise.all([
    db
      .select(publicProduct)
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(where)
      .orderBy(...order)
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(products).innerJoin(categories, eq(products.categoryId, categories.id)).where(where),
    q.facets ? getFacets(q) : Promise.resolve(undefined),
  ]);

  return { items: await withImages(items), page: q.page, pageSize: q.pageSize, total: total?.n ?? 0, ...(facets && { facets }) };
}

/**
 * Filter values available in the current scope (gender / category / search), ignoring the narrowing filters
 * so options don't disappear as soon as one is picked.
 */
export async function getFacets(q: ProductQuery): Promise<ProductFacets> {
  const scope = and(...scopeConditions(q));
  const [sizeRows, fabricRows, [price]] = await Promise.all([
    db
      .selectDistinct({ size: productVariants.size })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(scope, gt(productVariants.stock, 0))),
    db
      .selectDistinct({ fabric: products.fabric })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(scope, isNotNull(products.fabric)))
      .orderBy(asc(products.fabric)),
    db
      .select({ min: min(products.priceCents), max: max(products.priceCents) })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(scope),
  ]);
  return {
    sizes: sizeRows.map((r) => r.size).sort(compareSizes),
    fabrics: fabricRows.map((r) => r.fabric!).filter(Boolean),
    price: price?.min != null && price.max != null ? { min: price.min, max: price.max } : null,
  };
}

export async function getProductBySlug(slug: string) {
  const [product] = await db
    .select({ ...publicProduct, description: products.description, categoryId: products.categoryId })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);
  if (!product) return null;

  const [images, variants] = await Promise.all([
    db.select({ url: productImages.url, alt: productImages.alt }).from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.sortOrder)),
    db
      .select({ id: productVariants.id, size: productVariants.size, stock: productVariants.stock, rentStock: productVariants.rentStock, priceOverrideCents: productVariants.priceOverrideCents })
      .from(productVariants)
      .where(eq(productVariants.productId, product.id))
      .orderBy(asc(productVariants.sku)),
  ]);
  const { categoryId: _categoryId, ...rest } = product;
  void _categoryId;
  // Exact stock numbers are never exposed — only whether a size is available (to buy / to rent).
  const pub = toPublic(rest);
  return {
    ...pub,
    images,
    variants: variants.sort((a, b) => compareSizes(a.size, b.size)).map(({ stock, rentStock, ...v }) => ({ ...v, inStock: stock > 0, lowStock: stock > 0 && stock <= 3, rentable: !!pub.rent && rentStock > 0 })),
  };
}

/**
 * Event dates a size CAN'T be rented for (all its rental pieces are booked around that date), from the first
 * bookable day to a year ahead — for the date picker. Counts are never exposed, only the dates.
 */
export async function rentCalendar(slug: string, variantId: string) {
  const [row] = await db
    .select({ rentEnabled: products.rentEnabled, rentPriceCents: products.rentPriceCents, rentDays: products.rentDays, rentStock: productVariants.rentStock })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true), eq(productVariants.id, variantId)))
    .limit(1);
  if (!row) return null;
  const today = colomboToday();
  const first = addDays(today, RENTAL.minNoticeDays);
  const last = addDays(today, RENTAL.maxAheadDays);
  if (!row.rentEnabled || !row.rentPriceCents || row.rentStock <= 0) return { rentable: false, first, last, unavailable: [] as string[] };
  const bookings = await db
    .select({ start: rentalBookings.startDate, end: rentalBookings.endDate, qty: rentalBookings.quantity })
    .from(rentalBookings)
    .where(and(eq(rentalBookings.variantId, variantId), eq(rentalBookings.status, "active"), gte(rentalBookings.endDate, today)));
  const unavailable: string[] = [];
  if (bookings.length) {
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const w = rentalWindow(d, row.rentDays);
      const taken = bookings.filter((b) => rangesOverlap(b.start, b.end, w.deliverOn, w.busyUntil)).reduce((n, b) => n + b.qty, 0);
      if (taken >= row.rentStock) unavailable.push(d);
    }
  }
  return { rentable: true, first, last, unavailable };
}

/**
 * Up to `limit` related products: same category & gender first, then filled with other pieces for the same
 * gender (so a blazer page can suggest the shirt and trousers that complete the look).
 */
export async function getRelated(slug: string, limit = 4) {
  const [base] = await db
    .select({ id: products.id, gender: products.gender, categoryId: products.categoryId })
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);
  if (!base) return null;

  const genders = base.gender === "unisex" ? (["men", "women", "unisex"] as const) : ([base.gender, "unisex"] as const);
  const sameCategory = await db
    .select(publicProduct)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.isActive, true), eq(products.categoryId, base.categoryId), inArray(products.gender, [...genders]), ne(products.id, base.id)))
    .orderBy(desc(products.createdAt), asc(products.id))
    .limit(limit);

  let items = sameCategory;
  if (items.length < limit) {
    const exclude = [base.id, ...items.map((p) => p.id)];
    const others = await db
      .select(publicProduct)
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.isActive, true), inArray(products.gender, [...genders]), notInArray(products.id, exclude)))
      // Category order is suits → blazers → shirts → trousers; descending favours complementary pieces
      // (blazer → trousers & shirts, shirt → trousers & blazers, trousers → shirts & blazers).
      .orderBy(desc(categories.sortOrder), desc(products.createdAt), asc(products.id))
      .limit(limit - items.length);
    items = [...items, ...others];
  }
  return withImages(items);
}
