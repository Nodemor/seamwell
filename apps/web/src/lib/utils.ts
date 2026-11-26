import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes (shadcn / React Bits / 21st.dev components expect this helper at @/lib/utils). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// From the zod-free entry: this file is imported by almost every component (see packages/shared/src/format.ts).
export { formatLKR } from "@seamwell/shared/format";
