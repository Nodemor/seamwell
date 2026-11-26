import { Shirt } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 10"><filter id="b"><feGaussianBlur stdDeviation="1.4"/></filter><rect width="8" height="10" fill="#f1ebe1"/><ellipse cx="4" cy="5" rx="2.4" ry="3.6" fill="#e5ddd0" filter="url(#b)"/></svg>';

type Props = {
  src?: string | null;
  alt: string;
  /** next/image `sizes` (the parent must be positioned and sized — the image fills it). */
  sizes: string;
  priority?: boolean;
  /** Padding around a contained cut-out photo. */
  className?: string;
};

/**
 * A product photo that fills its (positioned) parent, or — when a product has no photo yet — a quiet
 * "photo coming soon" tile. No drawn garments: the shop only shows real photos.
 */
/** Tiny blurred linen tile shown while a photo loads (product photos are dynamic paths, so Next can't derive one). */
const BLUR = `data:image/svg+xml;base64,${typeof btoa === "function" ? btoa(SVG) : Buffer.from(SVG).toString("base64")}`;

export function ProductPhoto({ src, alt, sizes, priority = false, className }: Props) {
  if (src) return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} placeholder="blur" blurDataURL={BLUR} className={cn("object-contain", className)} />;
  return (
    <span role="img" aria-label={`${alt} — photo coming soon`} className="absolute inset-0 grid place-items-center bg-linen text-stone">
      <span className="flex flex-col items-center gap-1.5 text-center text-[0.7rem]">
        <Shirt className="size-6 opacity-50" aria-hidden />
        <span className="hidden sm:block">Photo coming soon</span>
      </span>
    </span>
  );
}
