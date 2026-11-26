import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const KEY = Buffer.from(env.DATA_ENCRYPTION_KEY, "hex");

/** Cryptographically random URL-safe token (used for refresh tokens, lookup tokens). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** SHA-256 hex. Store only hashes of tokens — never the tokens themselves. */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

/** AES-256-GCM encryption for secrets stored in the database (e.g. TOTP secrets). Output: iv.tag.ciphertext (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !enc) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Human-friendly order number: SW- + 6 chars without look-alike characters (0/O, 1/I). */
export function newOrderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `SW-${out}`;
}
