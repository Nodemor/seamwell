import type { Metadata } from "next";
import { productQuerySchema } from "@seamwell/shared";
import { ShopView } from "@/components/shop/ShopView";
import { api } from "@/lib/api";
import { apiQuery, type ProductList, SAMPLE_PRODUCTS, SHOP_CATEGORIES, SHOP_PARAMS, type ShopState } from "@/lib/catalog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Validate the URL with the shared schema; drop anything invalid instead of erroring. */
async function readState(searchParams: SearchParams): Promise<ShopState> {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const state: ShopState = {};
  for (const k of SHOP_PARAMS) {
    if (flat[k] === undefined) continue;
    // Validate each param on its own so one bad value doesn't wipe the others.
    const one = productQuerySchema.safeParse({ [k]: flat[k] });
    if (one.success && one.data[k] !== undefined) state[k] = String(one.data[k]);
  }
  if (state.minPrice && state.maxPrice && Number(state.minPrice) > Number(state.maxPrice)) delete state.maxPrice;
  return state;
}

function heading(state: ShopState) {
  const cat = SHOP_CATEGORIES.find((c) => c.slug === state.category)?.label;
  const who = state.gender === "men" ? "Men's" : state.gender === "women" ? "Women's" : "";
  if (state.q) return `Results for “${state.q}”`;
  if (cat) return `${who} ${who ? cat.toLowerCase() : cat}`.trim();
  return who ? `${who} collection` : "The collection";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const state = await readState(searchParams);
  const canonical = apiQuery({ gender: state.gender, category: state.category });
  // Narrowed / searched listings are near-duplicates: keep them out of the index but let crawlers follow links.
  const narrowed = Boolean(state.q || state.size || state.fabric || state.minPrice || state.maxPrice || (state.sort && state.sort !== "new"));
  return {
    title: heading(state),
    description: "Suits, blazers, shirts and trousers from our Colombo atelier — try any piece on yourself with free Virtual Try-On.",
    alternates: { canonical: canonical ? `/shop?${canonical}` : "/shop" },
    robots: narrowed ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  let data: ProductList = { items: SAMPLE_PRODUCTS, page: 1, pageSize: 12, total: SAMPLE_PRODUCTS.length };
  let live = false;
  try {
    data = await api<ProductList>(`/products?${apiQuery(state, { facets: "1", pageSize: "12" })}`, { cache: "no-store" });
    live = true;
  } catch {
    /* API not running — show samples */
  }

  return (
    <div className="container-sw py-10 md:py-12">
      <p className="eyebrow">{state.gender ? `${state.gender}'s collection` : "The collection"}</p>
      <h1 className="mt-3 text-[clamp(2.4rem,5vw,4rem)] leading-tight">{heading(state)}</h1>
      {/* key → a fresh view (and a fresh "Load more" list) whenever the filters change */}
      <ShopView key={apiQuery(state)} state={state} initial={data} live={live} />
    </div>
  );
}
