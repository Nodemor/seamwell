"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
  label: string;
  error?: string;
  hint?: string;
  autoComplete: "current-password" | "new-password";
};

/** Password input with a show/hide toggle, wired like FormField (label, hint, error → aria-describedby). */
export function PasswordField({ label, error, hint, id: idProp, ...rest }: PasswordFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [shown, setShown] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          {...rest}
          id={id}
          type={shown ? "text" : "password"}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          aria-controls={id}
          className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-stone transition-colors hover:text-ink focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none"
        >
          {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {hint && !error && <p id={hintId} className="text-xs text-stone">{hint}</p>}
      {error && <p id={errorId} className="text-xs text-wine">{error}</p>}
    </div>
  );
}
