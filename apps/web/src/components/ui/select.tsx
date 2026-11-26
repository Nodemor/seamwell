"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

const Select = (props: React.ComponentProps<typeof SelectPrimitive.Root>) => <SelectPrimitive.Root data-slot="select" {...props} />;
const SelectGroup = (props: React.ComponentProps<typeof SelectPrimitive.Group>) => <SelectPrimitive.Group data-slot="select-group" {...props} />;
const SelectValue = (props: React.ComponentProps<typeof SelectPrimitive.Value>) => <SelectPrimitive.Value data-slot="select-value" {...props} />;

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(fieldClass, "flex h-12 items-center justify-between gap-2 whitespace-nowrap text-left data-[placeholder]:text-stone/70 *:data-[slot=select-value]:line-clamp-1", className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-brass" aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(
          "relative z-[70] max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-[var(--radius)] border border-line bg-paper text-ink shadow-[0_18px_50px_-15px_rgb(31_42_68/0.35)] data-[state=closed]:sw-fade-out data-[state=open]:sw-fade-in",
          position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)] data-[side=bottom]:translate-y-1.5 data-[side=top]:-translate-y-1.5",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1"><ChevronUp className="size-4" /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1"><ChevronDown className="size-4" /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label data-slot="select-label" className={cn("eyebrow px-3 py-2", className)} {...props} />;
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-11 w-full cursor-default select-none items-center rounded-[calc(var(--radius)-4px)] py-2 pl-3 pr-9 text-[0.95rem] outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-linen data-[disabled]:opacity-50 sm:min-h-10",
        className,
      )}
      {...props}
    >
      <span className="absolute right-3 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4 text-brass" aria-hidden />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn("pointer-events-none -mx-1.5 my-1.5 h-px bg-line", className)} {...props} />;
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue };
