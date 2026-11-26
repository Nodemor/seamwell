import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { orders, refreshTokens, users } from "../../db/schema.js";
import { audit } from "../../lib/audit.js";
import { sha256 } from "../../lib/crypto.js";
import { badRequest, unauthorized } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import { sendMail } from "../../lib/mailer.js";
import { hashPassword, isWeakPassword, verifyPassword, WEAK_PASSWORD_MESSAGE } from "../../lib/password.js";
import { type ClientInfo, createSession, revokeAllSessions } from "./auth.service.js";
import { consumeToken, revokeTokens, sendPasswordResetEmail, sendVerificationEmail } from "./email-tokens.js";


/* ---------- Forgot / reset password ---------- */

/**
 * Always returns immediately and identically, whether or not the email has an account:
 * the lookup, token and email happen after the response, so neither the body nor the timing tells them apart.
 */
export function requestPasswordReset(email: string, client: ClientInfo) {
  void (async () => {
    const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true, email: true, name: true } });
    if (!user) return;
    await sendPasswordResetEmail(user);
    await audit({ actorId: user.id, action: "auth.password_reset_requested", entity: "user", entityId: user.id, ip: client.ip });
  })().catch((err) => logger.error({ err }, "password reset email failed"));
}

export async function resetPassword(token: string, password: string, client: ClientInfo) {
  // before redeeming, so the link still works
  if (await isWeakPassword(password)) throw badRequest("Please check the highlighted fields", [{ path: "password", message: WEAK_PASSWORD_MESSAGE }]);
  const userId = await consumeToken(token, "password_reset");
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw badRequest("This link is invalid or has expired. Please request a new one.");

  // Opening the emailed link proves the inbox is theirs → counts as a verified email too.
  const newlyVerified = user.emailVerifiedAt === null;
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      failedLogins: 0,
      lockedUntil: null,
      ...(newlyVerified && { emailVerifiedAt: new Date() }),
    })
    .where(eq(users.id, userId));
  await revokeTokens(userId, "password_reset");
  await revokeAllSessions(userId); // every device signs in again with the new password
  await audit({ actorId: userId, action: "auth.password_reset", entity: "user", entityId: userId, ip: client.ip });
  if (newlyVerified) await attachGuestOrders(user.id, user.email, client);
  await notifyPasswordChanged(user);
}

/* ---------- Email verification ---------- */

export async function verifyEmail(token: string, client: ClientInfo) {
  const userId = await consumeToken(token, "email_verify");
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw badRequest("This link is invalid or has expired. Please request a new one.");
  if (user.emailVerifiedAt === null) {
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
    await audit({ actorId: userId, action: "auth.email_verified", entity: "user", entityId: userId, ip: client.ip });
  }
  return { attachedOrders: await attachGuestOrders(user.id, user.email, client) };
}

export async function resendVerification(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, email: true, name: true, emailVerifiedAt: true } });
  if (!user) throw unauthorized();
  if (user.emailVerifiedAt) return { alreadyVerified: true };
  await sendVerificationEmail(user);
  return { alreadyVerified: false };
}

/**
 * Guest orders placed with this email join the account — ONLY once the email is verified
 * (otherwise anyone could register with someone else's email and read their orders).
 */
async function attachGuestOrders(userId: string, email: string, client: ClientInfo) {
  const attached = await db
    .update(orders)
    .set({ userId })
    .where(and(eq(orders.email, email), isNull(orders.userId)))
    .returning({ id: orders.id });
  if (attached.length) {
    await audit({ actorId: userId, action: "orders.guest_attached", entity: "user", entityId: userId, meta: { count: attached.length }, ip: client.ip });
  }
  return attached.length;
}

/* ---------- Signed-in security ---------- */

/** New password → every other device is signed out; this one gets a fresh session (same MFA state). */
export async function changePassword(userId: string, currentPassword: string, newPassword: string, mfaVerified: boolean, client: ClientInfo) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw unauthorized();
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    await audit({ actorId: userId, action: "auth.password_change_failed", entity: "user", entityId: userId, ip: client.ip });
    throw badRequest("Please check the highlighted fields", [{ path: "currentPassword", message: "That isn't your current password" }]);
  }
  if (await isWeakPassword(newPassword)) throw badRequest("Please check the highlighted fields", [{ path: "newPassword", message: WEAK_PASSWORD_MESSAGE }]);
  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId));
  await revokeAllSessions(userId);
  await revokeTokens(userId, "password_reset");
  await audit({ actorId: userId, action: "auth.password_changed", entity: "user", entityId: userId, ip: client.ip });
  await notifyPasswordChanged(user);
  return createSession(user, mfaVerified, client);
}

/** Active sign-ins (one live refresh token per session family). */
export async function listSessions(userId: string, currentRefreshToken: string | undefined) {
  const currentHash = currentRefreshToken ? sha256(currentRefreshToken) : "";
  const rows = await db
    .select({ id: refreshTokens.id, tokenHash: refreshTokens.tokenHash, lastActiveAt: refreshTokens.createdAt, userAgent: refreshTokens.userAgent, ip: refreshTokens.ip, mfaVerified: refreshTokens.mfaVerified })
    .from(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())))
    .orderBy(desc(refreshTokens.createdAt))
    .limit(20);
  return rows.map(({ tokenHash, ...r }) => ({ ...r, current: tokenHash === currentHash }));
}

export async function signOutEverywhere(userId: string, client: ClientInfo) {
  await revokeAllSessions(userId);
  await audit({ actorId: userId, action: "auth.signed_out_everywhere", entity: "user", entityId: userId, ip: client.ip });
}

async function notifyPasswordChanged(user: Pick<typeof users.$inferSelect, "email" | "name">) {
  await sendMail(
    user.email,
    `${env.SHOP_NAME} — your password was changed`,
    `Hello ${user.name},\n\nThe password for your account was just changed and every device was signed out.\nIf this wasn't you, reset your password straight away and contact us.`,
  ).catch((err) => logger.error({ err }, "password-changed email failed"));
}
