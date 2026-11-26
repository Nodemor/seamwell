import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  mfaDisableSchema,
  mfaEnableSchema,
  mfaVerifySchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@seamwell/shared";
import { adminPathOrDefault } from "@seamwell/shared";
import { type Request, Router } from "express";
import { env } from "../../config/env.js";
import { REFRESH_COOKIE, requireAuth } from "../../middleware/auth.js";
import { accountSecurityLimiter, authLimiter, emailLimiter, tokenLimiter } from "../../middleware/rate-limit.js";
import { body } from "../../middleware/validate.js";
import { clearSessionCookies, setSessionCookies } from "./cookies.js";
import * as auth from "./auth.service.js";
import * as recovery from "./recovery.service.js";

/**
 * The secret admin address goes only to an admin whose session passed two-factor — never to guests,
 * customers or a half-signed-in admin. It is never in the public JavaScript.
 */
export const withAdminPath = <U extends { role: string }>(user: U, mfaVerified: boolean) =>
  user.role === "admin" && mfaVerified ? { ...user, adminPath: adminPathOrDefault(env.ADMIN_PATH) } : user;

const client = (req: Request) => ({ ip: req.ip, userAgent: req.get("user-agent") });

export const authRouter = Router();

authRouter.post("/register", authLimiter, async (req, res) => {
  const { user, tokens } = await auth.register(body(req, registerSchema), client(req));
  setSessionCookies(res, tokens);
  res.status(201).json({ user });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const result = await auth.login(body(req, loginSchema), client(req));
  if (result.mfaRequired) {
    res.json({ mfaRequired: true, mfaToken: result.mfaToken });
    return;
  }
  setSessionCookies(res, result.tokens);
  res.json({ mfaRequired: false, user: result.user });
});

authRouter.post("/mfa/verify", authLimiter, async (req, res) => {
  const { user, tokens } = await auth.verifyMfaLogin(body(req, mfaVerifySchema), client(req));
  setSessionCookies(res, tokens);
  res.json({ user: withAdminPath(user, true) });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== "string") {
    clearSessionCookies(res);
    res.status(401).json({ error: { code: "unauthorized", message: "Please sign in" } });
    return;
  }
  try {
    const { user, mfaVerified, tokens } = await auth.refresh(token, client(req));
    setSessionCookies(res, tokens);
    res.json({ user: withAdminPath(user, mfaVerified) });
  } catch (err) {
    clearSessionCookies(res);
    throw err;
  }
});

authRouter.post("/logout", async (req, res) => {
  await auth.logout(req.cookies?.[REFRESH_COOKIE]);
  clearSessionCookies(res);
  res.status(204).end();
});

/**
 * Quiet session probe for the web app (always 200, so guests don't produce 401s in the console):
 * { user } when the access cookie is valid, otherwise { user: null, refreshable } — refreshable tells the
 * client a refresh cookie exists and POST /auth/refresh is worth trying.
 */
authRouter.get("/session", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (req.user) {
    res.json({ user: withAdminPath(await auth.getUser(req.user.sub), req.user.mfa), refreshable: true });
    return;
  }
  res.json({ user: null, refreshable: typeof req.cookies?.[REFRESH_COOKIE] === "string" });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: withAdminPath(await auth.getUser(req.user!.sub), req.user!.mfa) });
});

/* MFA management (signed-in users) */
authRouter.post("/mfa/setup", requireAuth, async (req, res) => {
  res.json(await auth.startMfaSetup(req.user!.sub));
});

authRouter.post("/mfa/enable", requireAuth, authLimiter, async (req, res) => {
  const { code } = body(req, mfaEnableSchema);
  const { recoveryCodes, tokens } = await auth.enableMfa(req.user!.sub, code, client(req));
  setSessionCookies(res, tokens);
  res.json({ recoveryCodes }); // shown ONCE — the user must save them
});

authRouter.post("/mfa/disable", requireAuth, authLimiter, async (req, res) => {
  const { password, code } = body(req, mfaDisableSchema);
  await auth.disableMfa(req.user!.sub, password, code, client(req));
  clearSessionCookies(res);
  res.status(204).end();
});

/* ---------- Forgot / reset password ---------- */

/** Same 200 + body whether or not the email has an account (no user enumeration). */
authRouter.post("/password/forgot", emailLimiter, (req, res) => {
  const { email } = body(req, forgotPasswordSchema);
  recovery.requestPasswordReset(email, client(req));
  res.json({ ok: true, message: "If an account exists for that email, we've sent a link to reset the password." });
});

authRouter.post("/password/reset", tokenLimiter, async (req, res) => {
  const { token, password } = body(req, resetPasswordSchema);
  await recovery.resetPassword(token, password, client(req));
  clearSessionCookies(res); // whatever session this browser had is gone — sign in with the new password
  res.json({ ok: true });
});

/** Signed in: current + new password. Other devices are signed out; this one keeps a fresh session. */
authRouter.post("/password/change", requireAuth, accountSecurityLimiter, async (req, res) => {
  const { currentPassword, newPassword } = body(req, changePasswordSchema);
  const tokens = await recovery.changePassword(req.user!.sub, currentPassword, newPassword, req.user!.mfa, client(req));
  setSessionCookies(res, tokens);
  res.json({ ok: true });
});

/* ---------- Email verification (POST only: link scanners that GET the URL can't redeem it) ---------- */

authRouter.post("/email/verify", tokenLimiter, async (req, res) => {
  const { token } = body(req, verifyEmailSchema);
  res.json(await recovery.verifyEmail(token, client(req)));
});

authRouter.post("/email/resend", requireAuth, emailLimiter, async (req, res) => {
  res.json(await recovery.resendVerification(req.user!.sub));
});

/* ---------- Sessions ---------- */

authRouter.get("/sessions", requireAuth, accountSecurityLimiter, async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ sessions: await recovery.listSessions(req.user!.sub, req.cookies?.[REFRESH_COOKIE]) });
});

authRouter.post("/sessions/revoke-all", requireAuth, accountSecurityLimiter, async (req, res) => {
  await recovery.signOutEverywhere(req.user!.sub, client(req));
  clearSessionCookies(res);
  res.status(204).end();
});
