"use client";

import type { PaymentMethod } from "@seamwell/shared";
import { create } from "zustand";

export type PlacedOrder = {
  orderNumber: string;
  status: string;
  paymentMethod: PaymentMethod;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  email: string;
  items: { productName: string; size: string; quantity: number; unitPriceCents: number; mode?: "buy" | "rent"; eventDate?: string | null; rentStart?: string | null; rentEnd?: string | null }[];
  depositCents?: number;
  bankTransferDetails?: string;
};

/**
 * The order that was just placed — IN MEMORY ONLY (deliberately not persisted).
 * The thank-you page shows details from here; after a refresh it only shows the order number and a
 * link to tracking (which asks for the email), so no order data is exposed by the URL alone.
 */
export const useLastOrder = create<{ order: PlacedOrder | null; set: (o: PlacedOrder) => void }>((set) => ({
  order: null,
  set: (order) => set({ order }),
}));
