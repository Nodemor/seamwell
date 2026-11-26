import type { Gender, ProductFacets, ProductQuery } from "@seamwell/shared";
import { api } from "./api";

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  gender: Gender;
  /** What customers pay now (the sale price while a sale runs). */
  priceCents: number;
  compareAtCents: number | null;
  onSale?: boolean;
  saleEndsAt?: string | null;
  /** Rental terms when the product can be rented. */
  rent?: { priceCents: number; depositCents: number; days: number } | null;
  color: string | null;
  colorHex: string | null;
  fabric: string | null;
  fit: string | null;
  tryonEnabled: boolean;
  tryonSlot: "kit" | "blazer" | "shirt" | "trousers";
  tryonImageUrl: string | null;
  ratingAvgX100: number;
  ratingCount: number;
  categorySlug: string;
  categoryName: string;
  images: { url: string; alt: string }[];
}

/** Fallback shown when the API isn't running yet, so the home page always renders during development. */
export const SAMPLE_PRODUCTS: ProductCard[] = [
  { name: "Midnight Navy Blazer", file: "midnight-navy-blazer-1", slot: "blazer", price: 3650000, cat: "Blazers" },
  { name: "Black Tuxedo Three-Piece", file: "black-tuxedo-three-piece", slot: "blazer", price: 7850000, cat: "Suits" },
  { name: "Crisp White Oxford Shirt", file: "crisp-white-oxford-shirt", slot: "shirt", price: 690000, cat: "Shirts" },
  { name: "Tan Check Trousers", file: "tan-check-trousers-1", slot: "trousers", price: 1690000, cat: "Trousers" },
  { name: "Grey Tweed Blazer", file: "grey-tweed-blazer", slot: "blazer", price: 3850000, cat: "Blazers" },
  { name: "Ivory Dinner Suit", file: "ivory-dinner-suit", slot: "blazer", price: 6900000, compare: 7500000, cat: "Suits" },
].map((p, i) => ({
  id: `sample-${i}`,
  slug: "",
  name: p.name,
  gender: "men",
  priceCents: p.price,
  compareAtCents: p.compare ?? null,
  color: null,
  colorHex: null,
  fabric: null,
  fit: null,
  tryonEnabled: true,
  tryonSlot: p.slot as ProductCard["tryonSlot"],
  tryonImageUrl: null,
  ratingAvgX100: 0,
  ratingCount: 0,
  categorySlug: p.cat.toLowerCase(),
  categoryName: p.cat,
  images: [{ url: `/catalog/${p.file}.webp`, alt: p.name }],
}));

export async function getFeaturedProducts(): Promise<{ items: ProductCard[]; live: boolean }> {
  try {
    const data = await api<{ items: ProductCard[] }>("/products?pageSize=6&sort=new", { next: { revalidate: 60 } } as RequestInit);
    return data.items.length ? { items: data.items, live: true } : { items: SAMPLE_PRODUCTS, live: false };
  } catch {
    return { items: SAMPLE_PRODUCTS, live: false };
  }
}

/* ---------- Phase 2: listing, detail and shop URL helpers ---------- */

export interface ProductList {
  items: ProductCard[];
  page: number;
  pageSize: number;
  total: number;
  facets?: ProductFacets;
}

export type ProductDetail = ProductCard & {
  description: string;
  variants: { id: string; size: string; inStock: boolean; lowStock: boolean; priceOverrideCents: number | null; rentable?: boolean }[];
};

export const SHOP_CATEGORIES = [
  { slug: "suits", label: "Suits" },
  { slug: "blazers", label: "Blazers" },
  { slug: "shirts", label: "Shirts" },
  { slug: "trousers", label: "Trousers" },
  { slug: "nilame", label: "Nilame kits" },
  { slug: "kurtas", label: "Kurtas" },
  { slug: "sarees", label: "Sarees" },
  { slug: "salwar", label: "Salwar kits" },
  { slug: "frocks", label: "Frocks" },
] as const;

export const SORT_LABEL: Record<ProductQuery["sort"], string> = {
  new: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

/** Price filter presets in LKR cents (max undefined = no upper bound). */
export const PRICE_BUCKETS = [
  { id: "u10", label: "Under LKR 10,000", min: undefined, max: 1_000_000 },
  { id: "10-25", label: "LKR 10,000 – 25,000", min: 1_000_000, max: 2_500_000 },
  { id: "25-50", label: "LKR 25,000 – 50,000", min: 2_500_000, max: 5_000_000 },
  { id: "50+", label: "LKR 50,000 +", min: 5_000_000, max: undefined },
] as const;

/** Filters that live in the shop URL (page is not — "Load more" appends client-side). */
export const SHOP_PARAMS = ["gender", "category", "q", "size", "fabric", "minPrice", "maxPrice", "rent", "sort"] as const;
export type ShopState = Partial<Record<(typeof SHOP_PARAMS)[number], string>>;

/** Build a /shop URL from the current state plus a patch (undefined/empty removes a key; default sort omitted). */
export function shopHref(state: ShopState, patch: ShopState = {}) {
  const merged = { ...state, ...patch };
  const p = new URLSearchParams();
  for (const k of SHOP_PARAMS) {
    const v = merged[k];
    if (v && !(k === "sort" && v === "new")) p.set(k, v);
  }
  const s = p.toString();
  return s ? `/shop?${s}` : "/shop";
}

/** Query string for the API from validated shop state. */
export function apiQuery(state: ShopState, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  for (const k of SHOP_PARAMS) if (state[k]) p.set(k, state[k]!);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}
