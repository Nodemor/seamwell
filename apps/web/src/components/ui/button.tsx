import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Seamwell button. Pill-shaped, midnight primary, ≥44px tall on touch screens.
 * Only colour/shadow transitions (never `transition-all`) so GSAP can safely animate it or its wrapper.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium outline-none transition-[background-color,border-color,color,box-shadow,opacity] duration-300 focus-visible:ring-4 focus-visible:ring-brass/35 disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-midnight text-ivory hover:bg-midnight-2",
        secondary: "border border-line bg-paper text-ink hover:border-ink/35 hover:bg-ivory",
        accent: "bg-brass text-ink hover:bg-[#c09d66]",
        ghost: "text-ink hover:bg-linen",
        destructive: "bg-wine text-ivory hover:bg-[#8d3644]",
        link: "rounded-md px-0 text-midnight underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-11 px-4 text-sm sm:h-9",
        md: "h-11 px-6 text-[0.95rem] sm:h-12",
        lg: "h-14 px-8 text-base",
        icon: "size-11",
        "icon-sm": "size-11 sm:size-9",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a Next `<Link>`) with button styles. */
    asChild?: boolean;
    /** Shows a spinner, disables the button and sets aria-busy. Ignored with `asChild`. */
    loading?: boolean;
  };

function Button({ className, variant, size, block, asChild = false, loading = false, disabled, children, type = "button", ...props }: ButtonProps) {
  if (asChild) {
    return <Slot.Root data-slot="button" className={cn(buttonVariants({ variant, size, block }), className)} {...props}>{children}</Slot.Root>;
  }
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export { Button, buttonVariants, type ButtonProps };
