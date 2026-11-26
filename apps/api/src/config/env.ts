import { isValidAdminPath } from "@seamwell/shared";
import { z } from "zod";

/**
 * All configuration comes from environment variables and is validated at startup.
 * The server refuses to start with missing or weak secrets.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().min(1).transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_MFA_SECRET: z.string().min(32, "JWT_MFA_SECRET must be at least 32 characters"),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, "DATA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SHOP_NAME: z.string().default("Seamwell Tailoring"),
  BANK_TRANSFER_DETAILS: z.string().default(""),
  SHIPPING_FEE_CENTS: z.coerce.number().int().min(0).default(45000),
  FREE_SHIPPING_THRESHOLD_CENTS: z.coerce.number().int().min(0).default(2500000),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("Seamwell Tailoring <orders@example.com>"),
  /** Where uploaded product photos are written (served at /uploads by Nginx in production). */
  UPLOAD_DIR: z.string().default("uploads"),
  /** Check new passwords against Have I Been Pwned (k-anonymity: only 5 hash characters leave the server). */
  /** Secret admin address (/<ADMIN_PATH>). Required in production; dev without it keeps /admin. */
  ADMIN_PATH: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidAdminPath(v), "ADMIN_PATH must be 16–64 random letters/digits/-/_ (e.g. openssl rand -hex 12)"),
  HIBP_CHECK: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment configuration:\n", z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === "production") {
  const weak = [env.JWT_ACCESS_SECRET, env.JWT_MFA_SECRET].some((s) => s.startsWith("change_me"));
  if (weak || /^0+$/.test(env.DATA_ENCRYPTION_KEY) || !env.COOKIE_SECURE) {
    console.error("❌ Refusing to start in production with default secrets or COOKIE_SECURE=false.");
    process.exit(1);
  }
  if (!env.ADMIN_PATH) {
    console.error("❌ Refusing to start in production without ADMIN_PATH (the secret admin address — docs/07-deployment-vps.md §4).");
    process.exit(1);
  }
}
