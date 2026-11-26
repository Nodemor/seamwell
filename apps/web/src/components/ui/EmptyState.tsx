import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Usually a <Button asChild><Link/></Button>. */
  action?: React.ReactNode;
  className?: string;
};

/** Friendly "nothing here yet" panel (empty bag, no results, no orders…). */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center rounded-[var(--radius-xl)] border border-line bg-paper px-6 py-12 text-center sm:px-10", className)}>
      {Icon && (
        <span className="grid size-14 place-items-center rounded-full bg-linen text-brass">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <h2 className={cn("font-display text-3xl", Icon && "mt-5")}>{title}</h2>
      {description && <p className="mt-2 max-w-md text-stone">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
