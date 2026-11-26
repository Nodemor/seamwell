"use client";

import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Brand-styled toaster (light only — the site has no dark mode). Mounted once in app/layout.tsx. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-4 text-sage" />,
        info: <Info className="size-4 text-midnight" />,
        warning: <TriangleAlert className="size-4 text-brass" />,
        error: <OctagonX className="size-4 text-wine" />,
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!rounded-[var(--radius)] !border-line !bg-paper !text-ink !shadow-[0_12px_40px_-12px_rgb(31_42_68/0.35)] !font-sans",
          description: "!text-stone",
          actionButton: "!rounded-full !bg-midnight !text-ivory !px-3",
          cancelButton: "!rounded-full !bg-linen !text-ink",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
