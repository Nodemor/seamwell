import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/seo/JsonLd";
import { api } from "@/lib/api";
import { type ProductList, SHOP_CATEGORIES } from "@/lib/catalog";

export const revalidate = 3600;

/** All public pages + every active product (paged through the public API, 48 at a time). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), changeFrequency: "weekly", priority: 1, lastModified: now },
    { url: siteUrl("/shop"), changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: siteUrl("/try-on"), changeFrequency: "monthly", priority: 0.8 },
    // Single-parameter listing URLs only: Next does not XML-escape "&" inside <loc>.
    ...(["men", "women"] as const).map((g) => ({ url: siteUrl(`/shop?gender=${g}`), changeFrequency: "daily" as const, priority: 0.8 })),
    ...SHOP_CATEGORIES.map((c) => ({ url: siteUrl(`/shop?category=${c.slug}`), changeFrequency: "daily" as const, priority: 0.7 })),
    ...["/track-order", "/help/sizes", "/help/delivery", "/help/returns", "/about", "/contact", "/privacy", "/terms"].map((p) => ({ url: siteUrl(p), changeFrequency: "monthly" as const, priority: 0.3 })),
  ];

  const products: MetadataRoute.Sitemap = [];
  try {
    for (let page = 1; page <= 50; page++) {
      const data = await api<ProductList>(`/products?pageSize=48&page=${page}`, { next: { revalidate: 3600 } } as RequestInit);
      for (const p of data.items) {
        products.push({ url: siteUrl(`/product/${p.slug}`), changeFrequency: "weekly", priority: 0.8, ...(p.images[0] && { images: [siteUrl(p.images[0].url)] }) });
      }
      if (page * data.pageSize >= data.total) break;
    }
  } catch {
    /* API down: still serve the static part */
  }
  return [...staticPages, ...products];
}
