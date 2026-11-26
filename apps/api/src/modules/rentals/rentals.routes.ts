import { adminRentalsQuerySchema } from "@seamwell/shared";
import { Router } from "express";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../middleware/validate.js";
import { listRentals, rentalCounts } from "./rentals.service.js";

/** Admin rentals board — admin + MFA session only, never cached. */
export const adminRentalsRouter = Router();
adminRentalsRouter.use(requireAdmin);
adminRentalsRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

adminRentalsRouter.get("/", async (req, res) => {
  const { view, page } = query(req, adminRentalsQuerySchema);
  const [list, counts] = await Promise.all([listRentals(view, page), rentalCounts()]);
  res.json({ ...list, counts });
});
