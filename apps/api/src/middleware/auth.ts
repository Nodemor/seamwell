import type { NextFunction, Request, Response } from "express";
import { type AccessClaims, verifyAccessToken } from "../lib/jwt.js";
import { forbidden, unauthorized } from "../lib/http-error.js";

export const ACCESS_COOKIE = "sw_at";
export const REFRESH_COOKIE = "sw_rt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessClaims;
    }
  }
}

/** Reads the access token from the httpOnly cookie if present. Never throws. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (typeof token === "string" && token.length < 2000) {
    try {
      req.user = await verifyAccessToken(token);
    } catch {
      /* expired or invalid — treat as guest; the web app will call /auth/refresh */
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

/** Admins must be signed in, have the admin role AND have passed MFA in this session. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "admin") return next(forbidden());
  if (!req.user.mfa) return next(forbidden("Admin access requires two-factor authentication"));
  next();
}
