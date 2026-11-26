"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const Dialog = (props: React.ComponentProps<typeof DialogPrimitive.Root>) => <DialogPrimitive.Root data-slot="dialog" {...props} />;
const DialogTrigger = (props: React.ComponentProps<typeof DialogPrimitive.Trigger>) => <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
const DialogPortal = (props: React.ComponentProps<typeof DialogPrimitive.Portal>) => <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
const DialogClose = (props: React.ComponentProps<typeof DialogPrimitive.Close>) => <DialogPrimitive.Close data-slot="dialog-close" {...props} />;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-[60] bg-midnight/45 backdrop-blur-[2px] data-[state=closed]:sw-fade-out data-[state=open]:sw-fade-in", className)}
      {...props}
    />
  );
}

function DialogContent({ className, children, showCloseButton = true, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-[60] grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-[var(--radius-xl)] border border-line bg-paper p-6 shadow-[0_30px_80px_-20px_rgb(31_42_68/0.45)] outline-none data-[state=closed]:sw-pop-out data-[state=open]:sw-pop-in sm:p-8",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-stone transition-colors hover:bg-linen hover:text-ink">
            <X className="size-5" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

const DialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => <div data-slot="dialog-header" className={cn("flex flex-col gap-2 pr-8", className)} {...props} />;
const DialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div data-slot="dialog-footer" className={cn("mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("font-display text-3xl leading-tight text-ink", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-sm text-stone", className)} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger };
