import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { mfaRecoveryCodes, refreshTokens, users } from "../../db/schema.js";
import { audit } from "../../lib/audit.js";
import { decrypt, encrypt, randomToken, sha256 } from "../../lib/crypto.js";
import { badRequest, conflict, forbidden, HttpError, unauthorized } from "../../lib/http-error.js";
import { REFRESH_TTL_SECONDS, signAccessToken, signMfaToken, verifyMfaToken } from "../../lib/jwt.js";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  normaliseRecoveryCode,
  totpSetupPayload,
  verifyTotp,
} from "../../lib/mfa.js";
import { sendVerificationEmail } from "./email-tokens.js";
import { burnPasswordCheck, hashPassword, isWeakPassword, verifyPassword, WEAK_PASSWORD_MESSAGE } from "../../lib/password.js";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "customer" | "admin";
  mfaEnabled: boolean;
  emailVerified: boolean;
};
export const toPublic = (u: typeof users.$inferSelect): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  phone: u.phone,
  role: u.role,
  mfaEnabled: u.mfaEnabled,
  emailVerified: u.emailVerifiedAt !== null,
});

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/** Create a new session: short-lived JWT access token + opaque rotating refresh token (hashed in DB). */
export async function createSession(user: typeof users.$inferSelect, mfaVerified: boolean, client: ClientInfo, familyId: string = randomUUID()) {
  const refreshToken = randomToken(48);
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    familyId,
    mfaVerified,
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    userAgent: client.userAgent?.slice(0, 300),
    ip: client.ip,
  });
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, mfa: mfaVerified });
  return { accessToken, refreshToken } satisfies SessionTokens;
}

export async function register(input: { name: string; email: string; phone?: string; password: string }, client: ClientInfo) {
  if (await isWeakPassword(input.password)) throw badRequest("Please check the highlighted fields", [{ path: "password", message: WEAK_PASSWORD_MESSAGE }]);
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true } });
  if (existing) throw conflict("An account with this email already exists. Try signing in.");
  const [user] = await db
    .insert(users)
    .values({ name: input.name, email: input.email, phone: input.phone, passwordHash: await hashPassword(input.password) })
    .returning();
  if (!user) throw new Error("User insert failed");
  await audit({ actorId: user.id, action: "auth.registered", entity: "user", entityId: user.id, ip: client.ip });
  await sendVerificationEmail(user);
  return { user: toPublic(user), tokens: await createSession(user, false, client) };
}

export async function login(input: { email: string; password: string }, client: ClientInfo) {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (!user) {
    await burnPasswordCheck(input.password); // same timing as a real check
    throw unauthorized("Email or password is incorrect");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, "locked", "Too many failed attempts. Your account is locked for a few minutes.");
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db
      .update(users)
      .set({ failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
      .where(eq(users.id, user.id));
    await audit({ actorId: user.id, action: lock ? "auth.locked" : "auth.login_failed", entity: "user", entityId: user.id, ip: client.ip });
    throw unauthorized("Email or password is incorrect");
  }
  if (user.failedLogins > 0 || user.lockedUntil) {
    await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));
  }
  if (user.mfaEnabled) {
    return { mfaRequired: true as const, mfaToken: await signMfaToken(user.id) };
  }
  await audit({ actorId: user.id, action: "auth.login", entity: "user", entityId: user.id, ip: client.ip });
  return { mfaRequired: false as const, user: toPublic(user), tokens: await createSession(user, false, client) };
}

/** Second login step: TOTP code or a one-time recovery code. */
export async function verifyMfaLogin(input: { mfaToken: string; code: string }, client: ClientInfo) {
  let userId: string;
  try {
    userId = await verifyMfaToken(input.mfaToken);
  } catch {
    throw unauthorized("Your sign-in session expired. Please sign in again.");
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.mfaEnabled || !user.mfaSecretEnc) throw unauthorized();

  let ok = /^\d{6}$/.test(input.code.trim()) && verifyTotp(decrypt(user.mfaSecretEnc), input.code);
  if (!ok) {
    const hash = sha256(normaliseRecoveryCode(input.code));
    const used = await db
      .update(mfaRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(mfaRecoveryCodes.userId, user.id), eq(mfaRecoveryCodes.codeHash, hash), isNull(mfaRecoveryCodes.usedAt)))
      .returning({ id: mfaRecoveryCodes.id });
    ok = used.length === 1;
    if (ok) await audit({ actorId: user.id, action: "auth.recovery_code_used", entity: "user", entityId: user.id, ip: client.ip });
  }
  if (!ok) {
    await audit({ actorId: user.id, action: "auth.mfa_failed", entity: "user", entityId: user.id, ip: client.ip });
    throw unauthorized("That code is not correct");
  }
  await audit({ actorId: user.id, action: "auth.login", entity: "user", entityId: user.id, meta: { mfa: true }, ip: client.ip });
  return { user: toPublic(user), tokens: await createSession(user, true, client) };
}

/**
 * Refresh-token rotation with reuse detection:
 * each refresh token works once. If an already-used token is presented again (it was stolen),
 * the whole session family is revoked and the user must sign in again.
 */
export async function refresh(refreshToken: string, client: ClientInfo) {
  const row = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, sha256(refreshToken)) });
  if (!row) throw unauthorized();
  if (row.revokedAt) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
    await audit({ actorId: row.userId, action: "auth.refresh_reuse_detected", entity: "user", entityId: row.userId, ip: client.ip });
    throw unauthorized();
  }
  if (row.expiresAt < new Date()) throw unauthorized();
  const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
  if (!user) throw unauthorized();

  const revoked = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, row.id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  if (revoked.length !== 1) throw unauthorized(); // lost a race with a parallel refresh
  return { user: toPublic(user), mfaVerified: row.mfaVerified, tokens: await createSession(user, row.mfaVerified, client, row.familyId) };
}

export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  const row = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, sha256(refreshToken)) });
  if (row) await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.familyId, row.familyId));
}

/** Sign out everywhere (used after password change / MFA change). */
export async function revokeAllSessions(userId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())));
}

export async function getUser(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw unauthorized();
  return toPublic(user);
}

/* ---------- MFA management ---------- */
export async function startMfaSetup(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw unauthorized();
  if (user.mfaEnabled) throw conflict("Two-factor authentication is already on");
  const secret = generateTotpSecret();
  await db.update(users).set({ mfaSecretEnc: encrypt(secret) }).where(eq(users.id, userId)); // pending until confirmed
  return totpSetupPayload(secret, user.email);
}

export async function enableMfa(userId: string, code: string, client: ClientInfo) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.mfaSecretEnc) throw badRequest("Start the setup first");
  if (user.mfaEnabled) throw conflict("Two-factor authentication is already on");
  if (!verifyTotp(decrypt(user.mfaSecretEnc), code)) throw badRequest("That code is not correct. Check your authenticator app.");

  const codes = generateRecoveryCodes();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ mfaEnabled: true }).where(eq(users.id, userId));
    await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
    await tx.insert(mfaRecoveryCodes).values(codes.map((c) => ({ userId, codeHash: sha256(normaliseRecoveryCode(c)) })));
  });
  await revokeAllSessions(userId);
  await audit({ actorId: userId, action: "auth.mfa_enabled", entity: "user", entityId: userId, ip: client.ip });
  const tokens = await createSession({ ...user, mfaEnabled: true }, true, client);
  return { recoveryCodes: codes, tokens };
}

export async function disableMfa(userId: string, password: string, code: string, client: ClientInfo) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.mfaEnabled || !user.mfaSecretEnc) throw badRequest("Two-factor authentication is not on");
  if (user.role === "admin") throw forbidden("Admins must keep two-factor authentication on");
  if (!(await verifyPassword(user.passwordHash, password)) || !verifyTotp(decrypt(user.mfaSecretEnc), code)) {
    throw unauthorized("Password or code is incorrect");
  }
  await db.update(users).set({ mfaEnabled: false, mfaSecretEnc: null }).where(eq(users.id, userId));
  await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
  await revokeAllSessions(userId);
  await audit({ actorId: userId, action: "auth.mfa_disabled", entity: "user", entityId: userId, ip: client.ip });
}
