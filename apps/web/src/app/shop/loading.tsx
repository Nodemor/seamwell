import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the shop loads after a navigation from another page. */
export default function ShopLoading() {
  return (
    <div className="container-sw py-10 md:py-12" role="status" aria-busy="true" aria-label="Loading products">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-12 w-72 max-w-full" />
      <div className="mt-8 flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-20 shrink-0 rounded-full" />)}
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10 w-full rounded-full" />)}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[4/5] w-full rounded-[var(--radius-xl)]" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
