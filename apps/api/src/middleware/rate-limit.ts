import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

/**
 * In-memory rate limits (fine for one VPS process).
 * If you run multiple API instances (PM2 cluster), switch to a shared store such as rate-limit-redis.
 */
const base = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  message: { error: { code: "too_many_requests", message: "Too many requests. Please wait a moment and try again." } },
};

const ip = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");

/**
 * The Next.js server rendering pages on the SAME machine (catalogue, shop info): it connects over loopback and
 * sends no X-Forwarded-For. Everything from the internet arrives through Nginx, which always sets
 * X-Forwarded-For, and port 4000 is never exposed — so this can't be used to dodge the limit from outside.
 * Without this, every visitor's page views would share one "127.0.0.1" bucket and the shop would 429 under load.
 */
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
export const isInternalRequest = (req: Pick<Request, "headers" | "socket">) =>
  !req.headers["x-forwarded-for"] && LOOPBACK.has(req.socket.remoteAddress ?? "");

/** Whole API: 300 requests / 15 min per visitor IP (server-side page rendering excluded, see above). */
export const globalLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 300, keyGenerator: ip, skip: isInternalRequest });

/** Login / register / MFA: 10 attempts / 15 min per IP + email (stops password guessing). */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) => `${ip(req)}:${String(req.body?.email ?? "").toLowerCase().slice(0, 254)}`,
});

/** Emails we send on request (forgot password, resend verification): 5 / hour per IP + email (stops mail-bombing). */
export const emailLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req) => `${ip(req)}:${String(req.body?.email ?? req.user?.sub ?? "").toLowerCase().slice(0, 254)}`,
});

/** Redeeming emailed links (reset password, verify email): 10 / 15 min per IP (stops token guessing). */
export const tokenLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 10, keyGenerator: ip });

/** Signed-in security actions (change password, list/revoke sessions): 20 / 15 min per account. */
export const accountSecurityLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 20,
  keyGenerator: (req) => (req.user ? `user:${req.user.sub}` : ip(req)),
});

/** Order tracking lookups: 20 / 15 min per IP (stops order-number guessing). */
export const trackLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 20, keyGenerator: ip });

/** Placing orders: 10 / hour per IP (stops fake-order spam). */
export const checkoutLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 10, keyGenerator: ip });

/** Bag price quotes: 30 / 15 min per IP (the bag re-quotes when quantities change). */
export const quoteLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 30, keyGenerator: ip });

/** Writing reviews: 5 / hour per IP. */
export const reviewLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 5, keyGenerator: ip });

/** Admin photo uploads: 60 / 15 min per account (each one is decoded + re-encoded, which costs CPU). */
export const uploadLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 60,
  keyGenerator: (req) => (req.user ? `user:${req.user.sub}` : ip(req)),
});
