"use client";
/**
 * The customer's last try-on photo, kept ONLY in this tab's memory (a module variable) so it survives moving
 * between pages of the shop but disappears on reload/close. Never uploaded to our server, never written to
 * localStorage / IndexedDB.
 */
import type { PhotoCheckResult } from "./photo-check";

export interface RememberedPhoto {
  blob: Blob;
  check: PhotoCheckResult;
  useAnyway: boolean;
}

let last: RememberedPhoto | null = null;
let passesThisVisit = 0;

export const photoMemory = {
  get: () => last,
  set: (p: RememberedPhoto | null) => {
    last = p;
  },
};

/** AI passes run from this tab (for the free-quota hint — Hugging Face doesn't tell us the real remaining time). */
export const passCounter = {
  get: () => passesThisVisit,
  add: (n: number) => (passesThisVisit += n),
};

/** Rough free allowance without a Hugging Face login (docs/06: ~2 GPU-minutes/day ≈ 2 garments). */
export const FREE_PASSES_PER_DAY = 2;
export const SECONDS_PER_PASS = 25;
