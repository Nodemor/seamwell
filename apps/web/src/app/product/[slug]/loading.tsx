import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a product page loads after a navigation: gallery on the left, details on the right. */
export default function ProductLoading() {
  return (
    <div className="container-sw py-8 md:py-10" role="status" aria-busy="true" aria-label="Loading product">
      <Skeleton className="h-3 w-48" />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <Skeleton className="aspect-[4/5] w-full rounded-[var(--radius-xl)]" />
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="size-12 rounded-full" />)}
          </div>
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
