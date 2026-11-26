import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared field look: paper surface, 14px radius, brass focus, wine when aria-invalid. */
export const fieldClass =
  "w-full min-w-0 rounded-[var(--radius)] border border-line bg-paper px-4 text-[0.95rem] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-stone/70 focus-visible:border-brass focus-visible:ring-4 focus-visible:ring-brass/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-wine aria-invalid:focus-visible:ring-wine/15";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, "h-12 py-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium", className)} {...props} />;
}

export { Input };
