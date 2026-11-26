import { savedAddressSchema, savedAddressUpdateSchema, uuidSchema } from "@seamwell/shared";
import { Router } from "express";
import { notFound } from "../../lib/http-error.js";
import { requireAuth } from "../../middleware/auth.js";
import { body } from "../../middleware/validate.js";
import * as addressesSvc from "./addresses.service.js";

/** Signed-in customer's own data. Every route requires a session; every query is scoped to req.user.sub. */
export const accountRouter = Router();
accountRouter.use(requireAuth);

/** Malformed ids look exactly like someone else's id: 404. */
const idParam = (raw: unknown) => {
  const r = uuidSchema.safeParse(raw);
  if (!r.success) throw notFound("Address not found");
  return r.data;
};

accountRouter.get("/addresses", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ addresses: await addressesSvc.listAddresses(req.user!.sub) });
});

accountRouter.post("/addresses", async (req, res) => {
  res.status(201).json({ address: await addressesSvc.createAddress(req.user!.sub, body(req, savedAddressSchema)) });
});

accountRouter.patch("/addresses/:id", async (req, res) => {
  const id = idParam(req.params.id);
  res.json({ address: await addressesSvc.updateAddress(req.user!.sub, id, body(req, savedAddressUpdateSchema)) });
});

accountRouter.delete("/addresses/:id", async (req, res) => {
  await addressesSvc.deleteAddress(req.user!.sub, idParam(req.params.id));
  res.status(204).end();
});
