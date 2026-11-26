import type { z } from "zod";
import { ApiError } from "@/lib/api";

/** First message per field path from a Zod result — shown under the matching input. */
export function fieldErrors(error: z.ZodError | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error?.issues ?? []) out[i.path.join(".")] ??= i.message;
  return out;
}

/** Field errors the API sent back (400 details), plus a general message for everything else. */
export function apiErrors(err: unknown): { fields: Record<string, string>; message: string } {
  if (!(err instanceof ApiError)) return { fields: {}, message: "We couldn't reach the shop. Check your connection and try again." };
  const fields: Record<string, string> = {};
  for (const d of err.details ?? []) if (d.path) fields[d.path] ??= d.message;
  return { fields, message: Object.keys(fields).length ? "" : err.message };
}

/** Move focus to the first invalid field after a failed submit (screen readers then read its error). */
export const focusFirstInvalid = (form: HTMLFormElement | null) =>
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
