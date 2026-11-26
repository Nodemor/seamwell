"use client";

import { Star } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/**
 * Star rating as a real radio group (native inputs): Tab moves into the group, arrow keys change the rating,
 * screen readers announce "4 stars — Very good, 4 of 5". The stars are only the visual.
 */
export function StarInput({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset aria-describedby={error ? `${name}-err` : undefined} data-invalid={error ? "" : undefined}>
      <legend className="text-sm text-stone">Your rating</legend>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="group relative cursor-pointer p-1" onMouseEnter={() => setHover(n)}>
              <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
              <span className="sr-only">{n} {n === 1 ? "star" : "stars"} — {WORDS[n]}</span>
              <Star
                aria-hidden
                className={cn(
                  "size-9 rounded-md transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-brass/35 sm:size-8",
                  n <= shown ? "fill-brass text-brass" : "text-line",
                )}
              />
            </label>
          ))}
        </div>
        <span className="text-sm text-stone" aria-hidden>{WORDS[shown]}</span>
      </div>
      {error && <p id={`${name}-err`} className="mt-1 text-xs text-wine">{error}</p>}
    </fieldset>
  );
}
