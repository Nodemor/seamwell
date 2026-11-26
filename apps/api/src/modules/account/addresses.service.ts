import type { SavedAddressInput } from "@seamwell/shared";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { addresses } from "../../db/schema.js";
import { badRequest, notFound } from "../../lib/http-error.js";

const MAX_ADDRESSES = 10;

/** Columns returned to the owner (no userId — they already know it's theirs). */
const publicAddress = {
  id: addresses.id,
  label: addresses.label,
  line1: addresses.line1,
  line2: addresses.line2,
  city: addresses.city,
  district: addresses.district,
  postalCode: addresses.postalCode,
  isDefault: addresses.isDefault,
};

/** Every query is scoped by the owner's id: someone else's address id simply isn't found. */
const owned = (userId: string, id: string) => and(eq(addresses.id, id), eq(addresses.userId, userId));

export function listAddresses(userId: string) {
  return db.select(publicAddress).from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault), asc(addresses.createdAt));
}

export async function createAddress(userId: string, input: SavedAddressInput) {
  return db.transaction(async (tx) => {
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(addresses).where(eq(addresses.userId, userId));
    if (n >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses`);
    const makeDefault = input.isDefault ?? n === 0; // the first address becomes the default
    if (makeDefault) await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
    const [row] = await tx
      .insert(addresses)
      .values({ userId, label: input.label, line1: input.line1, line2: input.line2, city: input.city, district: input.district, postalCode: input.postalCode, isDefault: makeDefault })
      .returning(publicAddress);
    return row!;
  });
}

export async function updateAddress(userId: string, id: string, input: Partial<SavedAddressInput>) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ id: addresses.id }).from(addresses).where(owned(userId, id)).limit(1);
    if (!current) throw notFound("Address not found");
    if (input.isDefault) await tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
    const [row] = await tx
      .update(addresses)
      .set({
        ...(input.label !== undefined && { label: input.label }),
        ...(input.line1 !== undefined && { line1: input.line1 }),
        ...(input.line2 !== undefined && { line2: input.line2 }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.district !== undefined && { district: input.district }),
        ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      })
      .where(owned(userId, id))
      .returning(publicAddress);
    return row!;
  });
}

export async function deleteAddress(userId: string, id: string) {
  return db.transaction(async (tx) => {
    const [gone] = await tx.delete(addresses).where(owned(userId, id)).returning({ isDefault: addresses.isDefault });
    if (!gone) throw notFound("Address not found");
    // Deleted the default → promote the oldest remaining address.
    if (gone.isDefault) {
      const [next] = await tx.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, userId)).orderBy(asc(addresses.createdAt)).limit(1);
      if (next) await tx.update(addresses).set({ isDefault: true }).where(owned(userId, next.id));
    }
  });
}
