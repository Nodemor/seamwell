import pino from "pino";
import { env } from "../config/env.js";

/** Structured logger. Secrets and personal data are redacted so they never reach log files. */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : env.NODE_ENV === "test" ? "silent" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.mfaToken",
      "*.code",
      "*.currentPassword",
      "*.newPassword",
      "*.refreshToken",
      "*.accessToken",
      "*.secret",
      "*.mfaSecret",
      "*.recoveryCodes",
      "*.otpauthUri",
      "*.headers.cookie",
      "*.headers.authorization",
    ],
    censor: "[redacted]",
  },
});
