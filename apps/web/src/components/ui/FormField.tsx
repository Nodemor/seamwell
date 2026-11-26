"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { fieldClass, Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";

type Common = {
  label: string;
  /** Error message — sets aria-invalid and is announced via aria-describedby. */
  error?: string;
  hint?: string;
  /** Classes for the wrapper (e.g. `sm:col-span-2`). Use `className` for the control itself. */
  wrapperClassName?: string;
};

type FormFieldProps =
  | (Common & { as?: "input" } & React.ComponentProps<"input">)
  | (Common & { as: "textarea" } & React.ComponentProps<"textarea">)
  | (Common & { as: "select" } & React.ComponentProps<"select">);

/**
 * Label + input / textarea / native select + hint + error text,
 * wired up with id / aria-describedby / aria-invalid.
 * (Native <select> on purpose for long lists like districts: best picker on phones, fully accessible.)
 */
export function FormField(props: FormFieldProps) {
  const { label, error, hint, wrapperClassName, id: idProp, as = "input", ...rest } = props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const a11y = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
  };

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      <Label htmlFor={id}>{label}</Label>
      {as === "textarea" ? (
        <Textarea {...(rest as React.ComponentProps<"textarea">)} {...a11y} />
      ) : as === "select" ? (
        <div className="relative">
          <select
            {...(rest as React.ComponentProps<"select">)}
            {...a11y}
            className={cn(fieldClass, "h-12 appearance-none pr-10", (rest as React.ComponentProps<"select">).className)}
          />
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-brass" aria-hidden />
        </div>
      ) : (
        <Input {...(rest as React.ComponentProps<"input">)} {...a11y} />
      )}
      {hint && !error && <p id={hintId} className="text-xs text-stone">{hint}</p>}
      {error && <p id={errorId} className="text-xs text-wine">{error}</p>}
    </div>
  );
}
