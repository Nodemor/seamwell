import { createHash } from "node:crypto";
import argon2 from "argon2";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/** argon2id with OWASP-recommended parameters (19 MiB memory, 2 iterations). */
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => argon2.hash(password, OPTIONS);

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * A pre-computed hash used when the email does not exist, so a login attempt for an unknown
 * email takes the same time as for a real one (prevents user enumeration by timing).
 */
let dummyHash: string | undefined;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= await hashPassword("dummy-password-for-timing-1234");
  await verifyPassword(dummyHash, password);
}

/** Small offline list of very common passwords (works even when the breach check is unavailable). */
const COMMON = new Set(["password123", "1234567890", "qwerty12345", "iloveyou123", "admin12345", "password1234"]);
export const isCommonPassword = (pw: string) => COMMON.has(pw.toLowerCase());

export const WEAK_PASSWORD_MESSAGE = "That password is too common or has appeared in a data breach. Please choose another.";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Have I Been Pwned "range" check with k-anonymity: we send only the first 5 characters of the password's SHA-1
 * hash and compare the returned suffixes locally — the password (and its full hash) never leaves the server.
 * "Add-Padding" hides how many matches the prefix had. 2-second timeout; if the service is slow or down we
 * fail open (log a warning) so nobody is locked out of signing up.
 */
export async function isBreachedPassword(password: string, fetchFn: Fetch = fetch): Promise<boolean> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetchFn(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "seamwell-shop" },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    return body.split(/\r?\n/).some((line) => {
      const [hashSuffix, count] = line.trim().split(":");
      return hashSuffix === suffix && Number(count) > 0; // padding rows have count 0
    });
  } catch (err) {
    logger.warn({ reason: err instanceof Error ? err.message : String(err) }, "breached-password check unavailable — skipped");
    return false;
  }
}

/** Offline common list first, then the breach check (unless HIBP_CHECK=false, e.g. in tests). */
export async function isWeakPassword(password: string, fetchFn?: Fetch): Promise<boolean> {
  if (isCommonPassword(password)) return true;
  if (!env.HIBP_CHECK && !fetchFn) return false;
  return isBreachedPassword(password, fetchFn);
}
