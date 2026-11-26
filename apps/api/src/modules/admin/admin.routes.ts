import { auditQuerySchema, courierSettingsSchema } from "@seamwell/shared";
import { and, count, desc, eq, like } from "drizzle-orm";
import { Router } from "express";
import { db } from "../../db/client.js";
import { auditLogs, users } from "../../db/schema.js";
import { requireAdmin } from "../../middleware/auth.js";
import { body, query } from "../../middleware/validate.js";
import { adminDashboard } from "../orders/orders.service.js";
import { getCourierSettings, saveCourierSettings } from "./settings.service.js";

/** Admin home, audit log and shop settings. requireAdmin = role admin + MFA-verified session. */
export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

adminRouter.get("/dashboard", async (_req, res) => {
  res.json(await adminDashboard());
});

/** Read-only audit trail, newest first. `action` filters by prefix (e.g. "auth." or "order."). */
adminRouter.get("/audit", async (req, res) => {
  const q = query(req, auditQuerySchema);
  const pageSize = 50;
  const cond = q.action ? like(auditLogs.action, `${q.action.replace(/_/g, "\\_")}%`) : undefined;
  const [rows, [totals]] = await Promise.all([
    db
      .select({ id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, entityId: auditLogs.entityId, meta: auditLogs.meta, ip: auditLogs.ip, createdAt: auditLogs.createdAt, actorEmail: users.email, actorName: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(cond))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((q.page - 1) * pageSize),
    db.select({ n: count() }).from(auditLogs).where(cond),
  ]);
  res.json({ entries: rows, total: totals?.n ?? 0, page: q.page, pageSize });
});

adminRouter.get("/settings/couriers", async (_req, res) => {
  res.json(await getCourierSettings());
});

adminRouter.put("/settings/couriers", async (req, res) => {
  res.json(await saveCourierSettings(body(req, courierSettingsSchema), req.user!.sub, req.ip));
});
