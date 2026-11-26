import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { env } from "../config/env.js";
import { forbidden } from "../lib/http-error.js";

/** Security headers. The API only returns JSON, so the CSP can be fully locked down. */
export const securityHeaders = helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: "same-site" },
  hsts: env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true } : false,
});

/** CORS: only the shop website may call the API with cookies. */
export const corsPolicy = cors({
  origin(origin, cb) {
    // Same-origin requests (via the Next.js /api rewrite or Nginx) have no Origin header or the web origin.
    if (!origin || env.WEB_ORIGIN.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "X-Seamwell-CSRF", "Idempotency-Key"],
  maxAge: 600,
});

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF protection (defence in depth, on top of SameSite=Strict cookies):
 *  1. state-changing requests must carry the custom header X-Seamwell-CSRF (browsers can't send
 *     custom headers cross-site without a CORS preflight, which corsPolicy rejects), and
 *  2. if an Origin header is present it must be an allowed web origin.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (!UNSAFE.has(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !env.WEB_ORIGIN.includes(origin)) return next(forbidden("Request origin not allowed"));
  if (req.get("x-seamwell-csrf") !== "1") return next(forbidden("Missing CSRF header"));
  next();
}
