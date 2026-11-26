import { NextResponse, type NextRequest } from "next/server";

/**
 * Strict Content-Security-Policy with a fresh nonce on every page request (docs/02-security.md).
 *
 * - script-src: only scripts carrying this request's nonce run. Next.js adds the nonce to its own scripts
 *   automatically (it reads it from the CSP request header); our one inline script (motion boot) gets it from
 *   the root layout. 'strict-dynamic' lets those trusted scripts load their chunks — and the try-on photo check's
 *   MediaPipe loader from cdn.jsdelivr.net. No 'unsafe-inline' for scripts. 'self' keeps our own files working in
 *   older browsers without 'strict-dynamic' (e.g. Safari before 15.4).
 * - 'wasm-unsafe-eval': MediaPipe runs WebAssembly. No 'unsafe-eval' in production.
 * - style-src keeps 'unsafe-inline': GSAP animates through style attributes and the CSS is inlined.
 *   (Adding a nonce there would switch 'unsafe-inline' off.)
 * - connect-src: the free Hugging Face try-on Space (customer's own quota) and MediaPipe model files.
 */
export function buildCsp(nonce: string, { dev = false, https = false } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.hf.space https://huggingface.co",
    "font-src 'self' data:",
    `connect-src 'self' https://*.hf.space https://huggingface.co https://cdn.jsdelivr.net https://storage.googleapis.com${dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    https: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API, static files, images or link prefetches.
      source: "/((?!api|uploads|_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|.well-known|brand/|catalog/|hero/|tryon/|og-default.jpg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
