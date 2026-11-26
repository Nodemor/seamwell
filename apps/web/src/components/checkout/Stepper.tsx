"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Step indicator for the mobile checkout (Details → Delivery → Payment).
 * Completed steps are buttons (go back); the current one has aria-current="step"; later ones are inert.
 */
export function Stepper({ steps, current, onStep }: { steps: readonly string[]; current: number; onStep: (i: number) => void }) {
  return (
    <nav aria-label="Checkout steps">
      <ol className="flex items-center gap-2">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const body = (
            <>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-midnight bg-midnight text-ivory",
                  active && "border-brass bg-brass-soft text-ink",
                  !done && !active && "border-line text-stone",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-sm", active ? "font-medium text-ink" : "text-stone")}>{label}</span>
              {done && <span className="sr-only"> (completed, go back)</span>}
            </>
          );
          return (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
              {done ? (
                <button type="button" onClick={() => onStep(i)} className="flex min-h-11 items-center gap-2 rounded-full pr-2">
                  {body}
                </button>
              ) : (
                <span className="flex min-h-11 items-center gap-2">{body}</span>
              )}
              {i < steps.length - 1 && <span aria-hidden className={cn("h-px flex-1", done ? "bg-midnight" : "bg-line")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
