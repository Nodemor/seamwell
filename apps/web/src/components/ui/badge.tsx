import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-midnight text-ivory",
        accent: "bg-brass-soft text-ink",
        outline: "border border-line bg-paper text-ink",
        success: "bg-sage/10 text-sage",
        sale: "bg-wine text-ivory",
        danger: "bg-wine/10 text-wine",
        muted: "bg-linen text-stone",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, asChild = false, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
