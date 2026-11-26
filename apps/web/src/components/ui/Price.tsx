import { cn, formatLKR } from "@/lib/utils";

type PriceProps = {
  /** Selling price in LKR cents (display only — the API always recalculates). */
  cents: number;
  /** Original price in cents; shown struck-through when higher than `cents`. */
  compareAtCents?: number | null;
  size?: "sm" | "md" | "lg";
  /** Put the original price under the price instead of beside it. */
  stacked?: boolean;
  className?: string;
};

const SIZE = { sm: "text-sm", md: "text-base", lg: "font-display text-3xl" } as const;

/** LKR price with optional sale (original price struck through + screen-reader wording). */
export function Price({ cents, compareAtCents, size = "md", stacked = false, className }: PriceProps) {
  const onSale = compareAtCents != null && compareAtCents > cents;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2.5", stacked && "flex-col gap-0", className)}>
      <span className={cn("font-medium", SIZE[size], onSale && "text-wine")}>
        {onSale && <span className="sr-only">Sale price </span>}
        {formatLKR(cents)}
      </span>
      {onSale && (
        <s className={cn("text-stone", size === "lg" ? "text-base" : "text-xs")}>
          <span className="sr-only">Original price </span>
          {formatLKR(compareAtCents)}
        </s>
      )}
    </span>
  );
}
