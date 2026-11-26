import type { CookieOptions, Response } from "express";
import { env } from "../../config/env.js";
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from "../../lib/jwt.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../../middleware/auth.js";

/**
 * Tokens live ONLY in httpOnly cookies (JavaScript can't read them → safe from XSS token theft).
 * SameSite=Strict + the CSRF header check stop cross-site request forgery.
 */
const base: CookieOptions = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "strict" };

export function setSessionCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base, path: "/", maxAge: ACCESS_TTL_SECONDS * 1000 });
  // Refresh cookie is only sent to the auth endpoints.
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base, path: "/api/auth", maxAge: REFRESH_TTL_SECONDS * 1000 });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: "/api/auth" });
}
