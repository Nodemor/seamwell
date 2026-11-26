"use client";

import { useEffect, useRef } from "react";
import { gsap, MOTION_OK } from "@/lib/gsap";
import { cn } from "@/lib/utils";

const LENGTH = 6;

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called once all 6 digits are filled (typed or pasted). */
  onComplete?: (value: string) => void;
  /** Visible label id of the group (e.g. a <p id=…>Enter the 6-digit code</p>). */
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
  /** Change this number to shake the boxes (e.g. after a wrong code). */
  shake?: number;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Six one-digit boxes for authenticator codes.
 * - Typing moves to the next box, Backspace goes back, arrows move, paste/autofill spreads the whole code.
 * - The first box carries autocomplete="one-time-code" so phones can fill the code from SMS/password managers.
 * - GSAP: a small pop as each digit lands and a shake on a wrong code (only when motion is allowed).
 */
export function OtpInput({ value, onChange, onComplete, labelledBy, describedBy, invalid, shake = 0, disabled, autoFocus }: OtpInputProps) {
  const group = useRef<HTMLDivElement>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  const motionOk = () => window.matchMedia(MOTION_OK).matches;
  // Event-handler only (never during render): a short pop on the box that just got a digit.
  function pop(i: number) {
    const box = boxes.current[i];
    if (box && motionOk()) gsap.fromTo(box, { scale: 0.86 }, { scale: 1, duration: 0.35, ease: "back.out(3)", overwrite: true });
  }

  // Shake on a wrong code
  useEffect(() => {
    if (!shake || !group.current || !motionOk()) return;
    gsap.fromTo(group.current, { x: -10 }, { x: 0, duration: 0.6, ease: "elastic.out(1, 0.3)" });
  }, [shake]);

  useEffect(() => {
    if (autoFocus) boxes.current[0]?.focus();
  }, [autoFocus]);

  const focus = (i: number) => boxes.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  function setFrom(index: number, raw: string) {
    const incoming = raw.replace(/\D/g, "");
    if (!incoming) return;
    const next = digits.slice();
    let i = index;
    for (const ch of incoming) {
      if (i >= LENGTH) break;
      next[i] = ch;
      pop(i);
      i++;
    }
    const joined = next.join("").slice(0, LENGTH);
    onChange(joined);
    focus(i);
    if (joined.length === LENGTH && !next.includes("")) onComplete?.(joined);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = digits.slice();
      if (next[i]) next[i] = "";
      else if (i > 0) {
        next[i - 1] = "";
        focus(i - 1);
      }
      onChange(next.join("").replace(/\s+$/, ""));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  }

  return (
    <div ref={group} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          value={d}
          onChange={(e) => setFrom(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => {
            e.preventDefault();
            setFrom(i, e.clipboardData.getData("text"));
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? LENGTH : 1}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-14 w-full min-w-0 max-w-14 rounded-[var(--radius)] border bg-paper text-center font-mono text-2xl text-ink outline-none transition-[border-color,box-shadow] duration-200 focus-visible:border-brass focus-visible:ring-4 focus-visible:ring-brass/20 disabled:opacity-50",
            invalid ? "border-wine" : d ? "border-ink/40" : "border-line",
          )}
        />
      ))}
    </div>
  );
}
