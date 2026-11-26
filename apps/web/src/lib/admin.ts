"use client";

import type { OrderStatus, PaymentStatus } from "@seamwell/shared";
import { api, ApiError } from "@/lib/api";

/* ---------- Types returned by /api/admin/* ---------- */
export type AdminOrderRow = {
  orderNumber: string;
  customerName: string;
  phone: string;
  city: string;
  district: string;
  status: OrderStatus;
  paymentMethod: "cod" | "bank_transfer";
  paymentStatus: PaymentStatus;
  totalCents: number;
  createdAt: string;
};

export type AdminOrder = {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "cod" | "bank_transfer";
  paymentStatus: PaymentStatus;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
  items: {
    productName: string;
    size: string;
    quantity: number;
    unitPriceCents: number;
    productId: string | null;
    mode: "buy" | "rent";
    eventDate: string | null;
    rentStart: string | null;
    rentEnd: string | null;
    depositCents: number;
  }[];
  depositCents: number;
  depositStatus: "none" | "held" | "refunded" | "kept";
  hasRental: boolean;
  returnedAt: string | null;
  history: { status: OrderStatus; note: string | null; at: string; by: string | null }[];
  customer: { name: string; email: string; phone: string; hasAccount: boolean };
  address: { line1: string; line2: string | null; city: string; district: string; postalCode: string | null };
  notes: string | null;
};

export type AdminProductRow = {
  id: string;
  slug: string;
  name: string;
  gender: "men" | "women" | "unisex";
  categoryName: string;
  priceCents: number;
  isActive: boolean;
  tryonEnabled: boolean;
  hasTryonPhoto: boolean;
  imageUrl: string | null;
  totalStock: number;
  sizes: number;
  lowSizes: number;
  updatedAt: string;
};

export type AdminImage = { id: string; url: string; alt: string; sortOrder: number };
export type AdminVariant = { id: string; size: string; sku: string; stock: number; rentStock: number; priceOverrideCents: number | null };
export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  gender: "men" | "women" | "unisex";
  priceCents: number;
  compareAtCents: number | null;
  fabric: string | null;
  fit: string | null;
  color: string | null;
  colorHex: string | null;
  isActive: boolean;
  tryonEnabled: boolean;
  tryonSlot: "kit" | "blazer" | "shirt" | "trousers";
  tryonPhotoType: "flat-lay" | "model";
  tryonImageUrl: string | null;
  rentEnabled: boolean;
  rentPriceCents: number | null;
  rentDepositCents: number | null;
  rentDays: number;
  salePriceCents: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  images: AdminImage[];
  variants: AdminVariant[];
};
export type Category = { id: string; slug: string; name: string; gender: "men" | "women" | "unisex" };

/** Multipart upload (field "file") through the same-origin API, with CSRF header + one refresh retry. */
export async function uploadFile<T>(path: string, file: File, extra: Record<string, string> = {}): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return api<T>(path, { method: "POST", body: fd });
}

/** Download a file from the admin API (e.g. CSV) — refreshes the session once if it expired. */
export async function downloadFile(path: string, filename: string) {
  const get = () => fetch(`/api${path}`, { credentials: "same-origin" });
  let res = await get();
  if (res.status === 401) {
    await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin", headers: { "X-Seamwell-CSRF": "1" } });
    res = await get();
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data?.error?.code ?? "error", data?.error?.message ?? "Download failed", data?.error?.details);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const rupeesToCents = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return v.trim() === "" || !Number.isFinite(n) ? undefined : Math.round(n * 100);
};
export const centsToRupees = (c: number | null | undefined) => (c == null ? "" : String(c / 100));

/** <input type="datetime-local"> works in local wall-clock time; the shop runs on Sri Lanka time (UTC+5:30). */
export const isoToColomboLocal = (iso: string | null | undefined) => (iso ? new Date(Date.parse(iso) + 5.5 * 3_600_000).toISOString().slice(0, 16) : "");
export const colomboLocalToIso = (local: string) => (local.trim() ? `${local.trim().slice(0, 16)}:00+05:30` : null);

export const dateTime = (iso: string) => new Date(iso).toLocaleString("en-LK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
