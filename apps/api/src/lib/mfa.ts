import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { env } from "../config/env.js";

/** TOTP (Google Authenticator / Microsoft Authenticator / Authy compatible). */
const build = (secretBase32: string, label = "account") =>
  new TOTP({ issuer: env.SHOP_NAME, label, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secretBase32) });

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export async function totpSetupPayload(secretBase32: string, email: string) {
  const uri = build(secretBase32, email).toString();
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { otpauthUri: uri, qrDataUrl };
}

/** Accepts the current code and ±1 time step (30 s) for clock drift. */
export function verifyTotp(secretBase32: string, code: string): boolean {
  return build(secretBase32).validate({ token: code.trim(), window: 1 }) !== null;
}

/** 10 one-time recovery codes like "7KQ2-M9XD". Shown once; only hashes are stored. */
export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: count }, () => {
    const b = randomBytes(8);
    const s = Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

export const normaliseRecoveryCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
