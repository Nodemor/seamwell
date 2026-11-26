import { and, eq, gt, isNull } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { authTokens, users } from "../../db/schema.js";
import { randomToken, sha256 } from "../../lib/crypto.js";
import { badRequest } from "../../lib/http-error.js";
import { sendMail } from "../../lib/mailer.js";

/**
 * One-time links we email (password reset, email verification).
 * - 32 random bytes (base64url, 43 chars) → only the sha256 is stored, so a database leak can't be replayed.
 * - Issuing a new link kills the earlier unused ones of the same kind.
 * - Redeeming is ONE atomic UPDATE … WHERE used_at IS NULL AND expires_at > now(): two parallel clicks can't both win.
 */
export type TokenPurpose = (typeof authTokens.$inferSelect)["purpose"];

export const RESET_TTL_MS = 30 * 60_000; // 30 minutes
export const VERIFY_TTL_MS = 24 * 60 * 60_000; // 24 hours

export async function issueToken(userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
  const token = randomToken(32);
  await db.transaction(async (tx) => {
    await tx
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
    await tx.insert(authTokens).values({ userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) });
  });
  return token;
}

/** Marks the token used and returns its user id. Same error for unknown, used and expired links. */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<string> {
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, sha256(token)),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: authTokens.userId });
  if (!row) throw badRequest("This link is invalid or has expired. Please request a new one.");
  return row.userId;
}

/** Kill every unused link of a kind (e.g. after a successful password reset). */
export async function revokeTokens(userId: string, purpose: TokenPurpose) {
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
}

/** Links point at the web app (first allowed origin). The token is the only secret ever put in a URL. */
const webLink = (path: string, token: string) => `${env.WEB_ORIGIN[0]}${path}?token=${encodeURIComponent(token)}`;
const NL = "\n";

export async function sendVerificationEmail(user: Pick<typeof users.$inferSelect, "id" | "email" | "name">) {
  const token = await issueToken(user.id, "email_verify", VERIFY_TTL_MS);
  await sendMail(
    user.email,
    `${env.SHOP_NAME} — confirm your email`,
    [
      `Hello ${user.name},`,
      "",
      "Please confirm your email address so we can link your orders to your account:",
      webLink("/verify-email", token),
      "",
      "This link works once and expires in 24 hours. If you didn't create an account, you can ignore this email.",
    ].join(NL),
  );
}

export async function sendPasswordResetEmail(user: Pick<typeof users.$inferSelect, "id" | "email" | "name">) {
  const token = await issueToken(user.id, "password_reset", RESET_TTL_MS);
  await sendMail(
    user.email,
    `${env.SHOP_NAME} — reset your password`,
    [
      `Hello ${user.name},`,
      "",
      "Someone (hopefully you) asked to reset the password for your account. Choose a new one here:",
      webLink("/reset-password", token),
      "",
      "This link works once and expires in 30 minutes. If you didn't ask for this, ignore this email — your password stays the same.",
    ].join(NL),
  );
}
