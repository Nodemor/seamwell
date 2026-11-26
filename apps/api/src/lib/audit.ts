import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
import { logger } from "./logger.js";

/** Record admin actions and security events. Never throws (auditing must not break the request). */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      meta: entry.meta,
      ip: entry.ip,
    });
  } catch (err) {
    logger.error({ err, action: entry.action }, "audit log write failed");
  }
}
