"use client";

import { X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Slide-in panel (Radix Dialog → focus trap, Esc closes, focus returns to the trigger). */
const Sheet = (props: React.ComponentProps<typeof SheetPrimitive.Root>) => <SheetPrimitive.Root data-slot="sheet" {...props} />;
const SheetTrigger = (props: React.ComponentProps<typeof SheetPrimitive.Trigger>) => <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
const SheetClose = (props: React.ComponentProps<typeof SheetPrimitive.Close>) => <SheetPrimitive.Close data-slot="sheet-close" {...props} />;

const SIDE = {
  right: "inset-y-0 right-0 h-full w-[88%] max-w-md border-l data-[state=closed]:sw-slide-out-right data-[state=open]:sw-slide-in-right",
  left: "inset-y-0 left-0 h-full w-[88%] max-w-md border-r data-[state=closed]:sw-slide-out-left data-[state=open]:sw-slide-in-left",
  top: "inset-x-0 top-0 h-auto border-b data-[state=closed]:sw-slide-out-top data-[state=open]:sw-slide-in-top",
  bottom: "inset-x-0 bottom-0 h-auto max-h-[90dvh] rounded-t-[var(--radius-xl)] border-t data-[state=closed]:sw-slide-out-bottom data-[state=open]:sw-slide-in-bottom",
} as const;

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof SIDE; showCloseButton?: boolean }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-[60] bg-midnight/45 backdrop-blur-[2px] data-[state=closed]:sw-fade-out data-[state=open]:sw-fade-in" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn("fixed z-[60] flex flex-col border-line bg-ivory shadow-[0_0_60px_-10px_rgb(31_42_68/0.35)] outline-none", SIDE[side], className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-stone transition-colors hover:bg-linen hover:text-ink">
            <X className="size-5" aria-hidden />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

const SheetHeader = ({ className, ...props }: React.ComponentProps<"div">) => <div data-slot="sheet-header" className={cn("flex flex-col gap-1 border-b border-line p-5 pr-16", className)} {...props} />;
const SheetFooter = ({ className, ...props }: React.ComponentProps<"div">) => <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 border-t border-line bg-paper p-5", className)} {...props} />;

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn("font-display text-3xl leading-tight text-ink", className)} {...props} />;
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-stone", className)} {...props} />;
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger };
