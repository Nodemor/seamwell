import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/seo/JsonLd";

/** Crawl the shop; keep private, transactional and internal pages out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/account", "/cart", "/checkout", "/order/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/styleguide"] }],
    sitemap: siteUrl("/sitemap.xml"),
  };
}
