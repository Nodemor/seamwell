import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Email sending.
 * - SMTP_URL set (production): sent through that server with nodemailer (TLS required for smtp:// via STARTTLS).
 * - SMTP_URL empty (development): the email is printed to the API console instead.
 * Callers should treat email as best-effort: a mail failure must never undo an order or a status change.
 */
let transport: Transporter | null = null;
function getTransport() {
  if (!env.SMTP_URL) return null;
  if (!transport) {
    const u = new URL(env.SMTP_URL);
    const secure = u.protocol === "smtps:";
    transport = nodemailer.createTransport({
      host: u.hostname,
      port: Number(u.port) || (secure ? 465 : 587),
      secure,
      requireTLS: !secure, // never send the password in plain text: smtp:// must upgrade with STARTTLS
      auth: u.username ? { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transport;
}

export type Mail = { to: string; subject: string; text: string; html?: string };

export async function sendMail(to: string, subject: string, text: string, html?: string) {
  const t = getTransport();
  if (!t) {
    // Production without SMTP: never print the email — it can hold reset links, addresses and phone numbers.
    if (env.NODE_ENV === "production") {
      logger.warn({ subject }, "email NOT sent: SMTP_URL is not configured");
      return;
    }
    logger.info({ to, subject }, `📧 [dev email]\n${text}`);
    return;
  }
  await t.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
  logger.info({ subject }, "email sent"); // recipient not logged in production (personal data)
}

/** Fire-and-forget wrapper for transactional emails: logs failures instead of throwing. */
export function sendMailSafe(mail: Mail) {
  void sendMail(mail.to, mail.subject, mail.text, mail.html).catch((err) => logger.error({ err, subject: mail.subject }, "email failed"));
}
