import { COURIERS, type CourierSettings, courierSettingsSchema, trackingUrlFor } from "@seamwell/shared";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { settings } from "../../db/schema.js";
import { audit } from "../../lib/audit.js";

/** Settings are key → JSON, always re-validated on read (a bad row falls back to the defaults). */
const EMPTY_COURIERS: CourierSettings = { templates: Object.fromEntries(COURIERS.map((c) => [c.id, ""])) as CourierSettings["templates"] };

export async function getCourierSettings(): Promise<CourierSettings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "couriers") });
  const parsed = courierSettingsSchema.safeParse(row?.value);
  return parsed.success ? { templates: { ...EMPTY_COURIERS.templates, ...parsed.data.templates } } : EMPTY_COURIERS;
}

export async function saveCourierSettings(value: CourierSettings, adminId: string, ip?: string) {
  const merged = { templates: { ...EMPTY_COURIERS.templates, ...value.templates } };
  await db
    .insert(settings)
    .values({ key: "couriers", value: merged, updatedBy: adminId })
    .onConflictDoUpdate({ target: settings.key, set: { value: merged, updatedBy: adminId, updatedAt: new Date() } });
  await audit({ actorId: adminId, action: "settings.couriers_updated", entity: "settings", entityId: "couriers", ip });
  return merged;
}

/** Tracking link for a courier (matched by preset name) and tracking number, from the saved template. */
export async function courierTemplateFor(courierName: string, trackingNumber: string) {
  const preset = COURIERS.find((c) => c.name.toLowerCase() === courierName.trim().toLowerCase());
  if (!preset) return undefined;
  const { templates } = await getCourierSettings();
  return trackingUrlFor(templates[preset.id], trackingNumber);
}
