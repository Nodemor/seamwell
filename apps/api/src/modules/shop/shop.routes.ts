import { PAYMENT_METHODS } from "@seamwell/shared";
import { Router } from "express";
import { env } from "../../config/env.js";

/**
 * Public shop facts for the content pages (delivery fee, free-delivery threshold, payment methods),
 * so the help pages always match what checkout really charges. Nothing secret here — bank account details are
 * only shown after ordering.
 */
export const shopRouter = Router();

shopRouter.get("/info", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    shippingFeeCents: env.SHIPPING_FEE_CENTS,
    freeShippingThresholdCents: env.FREE_SHIPPING_THRESHOLD_CENTS,
    paymentMethods: PAYMENT_METHODS,
  });
});
