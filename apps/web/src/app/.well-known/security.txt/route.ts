import { SITE } from "@/lib/site";

/**
 * RFC 9116 security.txt — tells security researchers how to report a problem.
 * Contact comes from NEXT_PUBLIC_SHOP_EMAIL; "Expires" is set one year after each build (redeploy at least yearly).
 */
export const dynamic = "force-static";

export function GET() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = [
    `Contact: mailto:${SITE.email}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en, si, ta",
    `Canonical: ${site}/.well-known/security.txt`,
    `Policy: ${site}/privacy`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
