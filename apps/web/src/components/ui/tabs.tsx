"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn("inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-linen p-1", className)} {...props} />;
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm text-stone outline-none transition-[background-color,color,box-shadow] duration-300 hover:text-ink focus-visible:ring-4 focus-visible:ring-brass/30 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:shadow-sm sm:h-9 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none focus-visible:ring-4 focus-visible:ring-brass/30", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
