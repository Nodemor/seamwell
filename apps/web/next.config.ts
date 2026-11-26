import type { NextConfig } from "next";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";

// Content-Security-Policy (per-request nonce) is set in src/proxy.ts.
const SITE_IS_HTTPS = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

/** next/image remote pattern for our own /uploads (host taken from NEXT_PUBLIC_SITE_URL). */
function siteUploadsPattern() {
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  return {
    protocol: site.protocol.replace(":", "") as "http" | "https",
    hostname: site.hostname,
    port: site.port,
    pathname: "/uploads/**",
  };
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Inline the (single, ~75 KB) Tailwind stylesheet into the HTML: removes the render-blocking CSS request,
    // which was ~0.8 s of LCP on mid-range phones. Production / app router only.
    inlineCss: true,
  },
  poweredByHeader: false,
  transpilePackages: ["@seamwell/shared"],
  // Same-origin API: the browser calls /api/* and Next forwards it to the Node API.
  // In production Nginx sends /api/* straight to the API (see docs/07-deployment-vps.md).
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
      // Admin-uploaded photos (Nginx serves these directly in production).
      { source: "/uploads/:path*", destination: `${API_INTERNAL_URL}/uploads/:path*` },
    ];
  },
  async headers() {
    return [
      // No special headers for /admin: it must look exactly like any other missing page. The real admin lives at
      // the secret /<ADMIN_PATH> (app/[staff]) — rendered per request (never cached) with a noindex robots tag.
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // HTTPS sites only: browsers remember to use HTTPS for a year (localhost / http builds never send it)
          ...(SITE_IS_HTTPS ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
          // camera=self lets customers take a photo for the virtual try-on
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.hf.space" },
      // Product photos uploaded through the admin (phase 5) are served from our own domain under /uploads.
      siteUploadsPattern(),
    ],
  },
};

export default nextConfig;
