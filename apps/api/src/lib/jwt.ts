import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";

const ACCESS_KEY = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const MFA_KEY = new TextEncoder().encode(env.JWT_MFA_SECRET);
const ISSUER = "seamwell-api";

export const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const MFA_TTL_SECONDS = 5 * 60; // 5 minutes to enter the code

export type Role = "customer" | "admin";
export interface AccessClaims {
  sub: string;
  role: Role;
  mfa: boolean; // true when this session passed an MFA check
}

export async function signAccessToken(claims: AccessClaims) {
  return new SignJWT({ role: claims.role, mfa: claims.mfa })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience("seamwell-web")
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(ACCESS_KEY);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, ACCESS_KEY, {
    issuer: ISSUER,
    audience: "seamwell-web",
    algorithms: ["HS256"], // never accept "none" or other algorithms
  });
  if (typeof payload.sub !== "string" || (payload.role !== "customer" && payload.role !== "admin")) {
    throw new Error("Invalid token claims");
  }
  return { sub: payload.sub, role: payload.role, mfa: payload.mfa === true };
}

/** Short-lived token proving "password was correct, MFA code still needed". Separate key = can't be used as an access token. */
export async function signMfaToken(userId: string) {
  return new SignJWT({ purpose: "mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${MFA_TTL_SECONDS}s`)
    .sign(MFA_KEY);
}

export async function verifyMfaToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, MFA_KEY, { issuer: ISSUER, algorithms: ["HS256"] });
  if (payload.purpose !== "mfa" || typeof payload.sub !== "string") throw new Error("Invalid MFA token");
  return payload.sub;
}
