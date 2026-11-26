"use client";

import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const Accordion = (props: React.ComponentProps<typeof AccordionPrimitive.Root>) => <AccordionPrimitive.Root data-slot="accordion" {...props} />;

function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b border-line", className)} {...props} />;
}

function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex min-h-14 flex-1 items-center justify-between gap-4 py-4 text-left font-medium outline-none transition-colors hover:text-midnight focus-visible:ring-4 focus-visible:ring-brass/30 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="size-4 shrink-0 text-brass transition-transform duration-300" aria-hidden />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content data-slot="accordion-content" className="overflow-hidden text-sm text-stone data-[state=closed]:sw-accordion-up data-[state=open]:sw-accordion-down" {...props}>
      <div className={cn("pb-5 pt-0 leading-relaxed", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
