import {
  adminProductListSchema,
  adminProductSchema,
  adminProductUpdateSchema,
  adminVariantSchema,
  adminVariantUpdateSchema,
  imageAltSchema,
  imageOrderSchema,
  uuidSchema,
} from "@seamwell/shared";
import { type Request, Router } from "express";
import { notFound } from "../../lib/http-error.js";
import { receiveImage } from "../../lib/uploads.js";
import { requireAdmin } from "../../middleware/auth.js";
import { uploadLimiter } from "../../middleware/rate-limit.js";
import { body, query } from "../../middleware/validate.js";
import * as svc from "./admin-products.service.js";

/** Product management. Every route: requireAdmin (role admin + MFA session); every change is audited. */
export const adminProductsRouter = Router();
adminProductsRouter.use(requireAdmin);
adminProductsRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const actor = (req: Request) => ({ adminId: req.user!.sub, ip: req.ip });
/** Malformed ids → 404, same as a missing record. */
const id = (raw: unknown, what = "Product") => {
  const r = uuidSchema.safeParse(raw);
  if (!r.success) throw notFound(`${what} not found`);
  return r.data;
};

adminProductsRouter.get("/", async (req, res) => {
  res.json(await svc.listProducts(query(req, adminProductListSchema)));
});

adminProductsRouter.post("/", async (req, res) => {
  res.status(201).json({ product: await svc.createProduct(body(req, adminProductSchema), actor(req)) });
});

adminProductsRouter.get("/:id", async (req, res) => {
  res.json({ product: await svc.getProduct(id(req.params.id)) });
});

/** Partial update. Archive = { isActive: false } (soft — orders and reviews keep their product). */
adminProductsRouter.patch("/:id", async (req, res) => {
  res.json({ product: await svc.updateProduct(id(req.params.id), body(req, adminProductUpdateSchema), actor(req)) });
});

/* Sizes & stock */
adminProductsRouter.post("/:id/variants", async (req, res) => {
  res.status(201).json({ variant: await svc.addVariant(id(req.params.id), body(req, adminVariantSchema), actor(req)) });
});
adminProductsRouter.patch("/:id/variants/:variantId", async (req, res) => {
  await svc.updateVariant(id(req.params.id), id(req.params.variantId, "Size"), body(req, adminVariantUpdateSchema), actor(req));
  res.json({ ok: true });
});
adminProductsRouter.delete("/:id/variants/:variantId", async (req, res) => {
  await svc.deleteVariant(id(req.params.id), id(req.params.variantId, "Size"), actor(req));
  res.status(204).end();
});

/* Photos (multipart, field "file"; optional "alt") */
adminProductsRouter.post("/:id/images", uploadLimiter, receiveImage, async (req, res) => {
  const alt = typeof req.body?.alt === "string" ? req.body.alt.trim() : "";
  res.status(201).json({ image: await svc.addImage(id(req.params.id), req.file, alt, actor(req)) });
});
adminProductsRouter.put("/:id/images/order", async (req, res) => {
  await svc.reorderImages(id(req.params.id), body(req, imageOrderSchema).ids, actor(req));
  res.json({ ok: true });
});
adminProductsRouter.patch("/:id/images/:imageId", async (req, res) => {
  await svc.updateImageAlt(id(req.params.id), id(req.params.imageId, "Photo"), body(req, imageAltSchema).alt, actor(req));
  res.json({ ok: true });
});
adminProductsRouter.delete("/:id/images/:imageId", async (req, res) => {
  await svc.deleteImage(id(req.params.id), id(req.params.imageId, "Photo"), actor(req));
  res.status(204).end();
});

/** Try-on garment photo (white background, front view) → products.tryon_image_url. */
adminProductsRouter.post("/:id/tryon-image", uploadLimiter, receiveImage, async (req, res) => {
  res.json(await svc.setTryonImage(id(req.params.id), req.file, actor(req)));
});
