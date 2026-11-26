import { formatLKR } from "@seamwell/shared";
import { env } from "../config/env.js";
import type { Mail } from "./mailer.js";

/**
 * Customer email templates (plain text + simple HTML).
 * Every value that came from a customer or admin is HTML-escaped; links are built from our own origin
 * or are admin-entered https tracking links (validated before they're stored).
 */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const site = () => env.WEB_ORIGIN[0] ?? "";
const NL = "\n";

type Item = {
  productName: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
  mode?: "buy" | "rent";
  eventDate?: string | null;
  rentStart?: string | null;
  rentEnd?: string | null;
  depositCents?: number;
};
/** "12 Dec 2026" from YYYY-MM-DD (no time zone shifts). */
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const rentNote = (i: Item) => (i.mode === "rent" && i.eventDate && i.rentStart && i.rentEnd ? `Rental for ${day(i.eventDate)} — delivered ${day(i.rentStart)}, collected ${day(i.rentEnd)}` : "");
export type OrderEmailData = {
  orderNumber: string;
  customerName: string;
  email: string;
  paymentMethod: "cod" | "bank_transfer";
  subtotalCents: number;
  shippingCents: number;
  /** Refundable rental deposits (included in totalCents). */
  depositCents?: number;
  totalCents: number;
  items: Item[];
};

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1b1a18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5ddd0;border-radius:16px">
<tr><td style="background:#1f2a44;border-radius:16px 16px 0 0;padding:20px 28px;color:#e9dcc4;font-family:Georgia,serif;font-size:22px">${escapeHtml(env.SHOP_NAME)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:26px;color:#1b1a18">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:12px;color:#6f6a61;border-top:1px solid #e5ddd0">You're receiving this because you ordered from ${escapeHtml(env.SHOP_NAME)}. Questions? Just reply to this email.</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${html}</p>`;
const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#1f2a44;color:#faf7f2;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px">${escapeHtml(label)}</a></p>`;

function itemsTable(o: OrderEmailData) {
  const rows = o.items
    .map((i) => `<tr><td style="padding:6px 0;font-size:14px">${i.quantity} × ${escapeHtml(i.productName)} <span style="color:#6f6a61">(size ${escapeHtml(i.size)})</span>${rentNote(i) ? `<br><span style="color:#7d602d;font-size:13px">${escapeHtml(rentNote(i))}</span>` : ""}</td><td align="right" style="padding:6px 0;font-size:14px">${formatLKR(i.unitPriceCents * i.quantity)}</td></tr>`)
    .join("");
  const line = (label: string, v: string, bold = false) =>
    `<tr><td style="padding:4px 0;font-size:14px;${bold ? "font-weight:600" : "color:#6f6a61"}">${label}</td><td align="right" style="padding:4px 0;font-size:14px;${bold ? "font-weight:600" : ""}">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border-top:1px solid #e5ddd0;border-bottom:1px solid #e5ddd0">${rows}
${line("Subtotal", formatLKR(o.subtotalCents))}${line("Delivery", o.shippingCents ? formatLKR(o.shippingCents) : "Free")}${o.depositCents ? line("Refundable deposit", formatLKR(o.depositCents)) : ""}${line("Total", formatLKR(o.totalCents), true)}</table>`;
}
const itemsText = (o: OrderEmailData) =>
  [
    ...o.items.map((i) => `  ${i.quantity} × ${i.productName} (size ${i.size}) — ${formatLKR(i.unitPriceCents * i.quantity)}${rentNote(i) ? `${NL}    ${rentNote(i)}` : ""}`),
    ...(o.depositCents ? [`  Refundable deposit: ${formatLKR(o.depositCents)}`] : []),
    `  Total: ${formatLKR(o.totalCents)}`,
  ].join(NL);

const trackLink = (o: { orderNumber: string }) => `${site()}/track-order?order=${encodeURIComponent(o.orderNumber)}`;
const first = (name: string) => name.split(/\s+/)[0] ?? name;

export function orderReceivedEmail(o: OrderEmailData, bankDetails: string): Mail {
  const bank = o.paymentMethod === "bank_transfer";
  const payText = bank
    ? ["Please transfer the total to:", bankDetails, `Use ${o.orderNumber} as the payment reference. We'll confirm as soon as it arrives.`].join(NL)
    : "You'll pay in cash when your order is delivered.";
  const payHtml = bank
    ? p("Please transfer the total to:") +
      `<pre style="margin:0 0 14px;padding:12px 14px;background:#f1ebe1;border-radius:10px;font-family:Consolas,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(bankDetails)}</pre>` +
      p(`Use <strong>${escapeHtml(o.orderNumber)}</strong> as the payment reference. We'll confirm as soon as it arrives.`)
    : p("You'll pay in cash when your order is delivered.");
  return {
    to: o.email,
    subject: `${env.SHOP_NAME} — order ${o.orderNumber} received`,
    text: [`Thank you, ${first(o.customerName)}!`, "", `Order ${o.orderNumber}`, itemsText(o), "", payText, "", `Track your order: ${trackLink(o)}`].join(NL),
    html: layout(`Thank you, ${first(o.customerName)}!`, p(`We've received your order <strong>${escapeHtml(o.orderNumber)}</strong>.`) + itemsTable(o) + payHtml + button(trackLink(o), "Track your order")),
  };
}

export function paymentConfirmedEmail(o: OrderEmailData): Mail {
  return {
    to: o.email,
    subject: `${env.SHOP_NAME} — payment received for ${o.orderNumber}`,
    text: [`Hello ${first(o.customerName)},`, "", `We've received your bank transfer of ${formatLKR(o.totalCents)} for order ${o.orderNumber}. Your order is confirmed and our tailors are getting started.`, "", `Track your order: ${trackLink(o)}`].join(NL),
    html: layout("Payment received", p(`Hello ${escapeHtml(first(o.customerName))}, we've received your bank transfer of <strong>${formatLKR(o.totalCents)}</strong> for order <strong>${escapeHtml(o.orderNumber)}</strong>.`) + p("Your order is confirmed and our tailors are getting started.") + button(trackLink(o), "Track your order")),
  };
}

export function shippedEmail(o: OrderEmailData, ship: { courierName: string; trackingNumber: string; trackingUrl?: string | null }): Mail {
  const courierLine = `Courier: ${ship.courierName} · Tracking number: ${ship.trackingNumber}`;
  return {
    to: o.email,
    subject: `${env.SHOP_NAME} — order ${o.orderNumber} is on its way`,
    text: [`Good news, ${first(o.customerName)} — your order ${o.orderNumber} has been shipped.`, courierLine, ship.trackingUrl ? `Track it with the courier: ${ship.trackingUrl}` : "", `Order status: ${trackLink(o)}`].filter(Boolean).join(NL),
    html: layout(
      "Your order is on its way",
      p(`Good news, ${escapeHtml(first(o.customerName))} — order <strong>${escapeHtml(o.orderNumber)}</strong> has been handed to the courier.`) +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;background:#f1ebe1;border-radius:10px;width:100%"><tr><td style="padding:12px 14px;font-size:14px">Courier: <strong>${escapeHtml(ship.courierName)}</strong><br>Tracking number: <strong style="font-family:Consolas,monospace">${escapeHtml(ship.trackingNumber)}</strong></td></tr></table>` +
        (ship.trackingUrl ? button(ship.trackingUrl, `Track with ${ship.courierName}`) : button(trackLink(o), "Track your order")),
    ),
  };
}

/** Rental pieces are back: thank-you + what happened to the deposit. */
export function returnedEmail(o: OrderEmailData, deposit: "refunded" | "kept" | null): Mail {
  const depositLine =
    !o.depositCents || !deposit
      ? ""
      : deposit === "refunded"
        ? `Your refundable deposit of ${formatLKR(o.depositCents)} has been refunded.`
        : `We've kept your deposit of ${formatLKR(o.depositCents)} — we'll be in touch to explain why.`;
  return {
    to: o.email,
    subject: `${env.SHOP_NAME} — rental ${o.orderNumber} returned`,
    text: [`Hello ${first(o.customerName)},`, "", `We've received the rented pieces from order ${o.orderNumber}. Thank you!`, ...(depositLine ? ["", depositLine] : [])].join(NL),
    html: layout("Thank you — rental returned", p(`Hello ${escapeHtml(first(o.customerName))}, we've received the rented pieces from order <strong>${escapeHtml(o.orderNumber)}</strong>. Thank you!`) + (depositLine ? p(escapeHtml(depositLine)) : "")),
  };
}

export function deliveredEmail(o: OrderEmailData, products: { name: string; slug: string }[]): Mail {
  const rentals = o.items.filter((i) => i.mode === "rent" && i.rentEnd);
  // Opens the review form for this order + product; the customer confirms with their email (nothing secret in the link).
  const links = products.map((x) => ({ name: x.name, url: `${site()}/review?order=${encodeURIComponent(o.orderNumber)}&product=${encodeURIComponent(x.slug)}` }));
  return {
    to: o.email,
    subject: `${env.SHOP_NAME} — order ${o.orderNumber} delivered`,
    text: [
      `Hello ${first(o.customerName)},`,
      "",
      `Your order ${o.orderNumber} has been delivered. We hope it fits beautifully — free alterations are available within 30 days.`,
      ...rentals.map((i) => `Rented: ${i.productName} — we'll collect it on ${day(i.rentEnd!)}.`),
      ...(links.length ? ["", "How did we do? Review your items (use your order number and this email):", ...links.map((l) => `  ${l.name}: ${l.url}`)] : []),
    ].join(NL),
    html: layout(
      "Delivered — enjoy!",
      p(`Hello ${escapeHtml(first(o.customerName))}, order <strong>${escapeHtml(o.orderNumber)}</strong> has been delivered. We hope it fits beautifully — free alterations are available within 30 days.`) +
        rentals.map((i) => p(`Rented: <strong>${escapeHtml(i.productName)}</strong> — we'll collect it on ${escapeHtml(day(i.rentEnd!))}.`)).join("") +
        (links.length
          ? p("How did we do? Review your items with your order number and this email:") +
            `<ul style="margin:0 0 14px;padding-left:18px">${links.map((l) => `<li style="margin:6px 0;font-size:14px"><a href="${escapeHtml(l.url)}" style="color:#1f2a44">${escapeHtml(l.name)}</a></li>`).join("")}</ul>`
          : ""),
    ),
  };
}
