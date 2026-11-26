import { Ruler, Star } from "lucide-react";
import Link from "next/link";
import { REVIEW_FIT_LABEL, REVIEW_FITS, type ReviewFit } from "@seamwell/shared";
import { RatingBars, type ReviewItem, ReviewList } from "@/components/product/ReviewList";
import { api } from "@/lib/api";

type ReviewsPage = {
  reviews: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  breakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
  fit: Record<ReviewFit, number>;
};

/** "Most say: True to size" — the most common fit answer (ties go to true to size). */
function fitHint(fit: Record<ReviewFit, number>) {
  const votes = REVIEW_FITS.reduce((n, f) => n + fit[f], 0);
  if (!votes) return null;
  const top = [...REVIEW_FITS].sort((a, b) => fit[b] - fit[a] || (a === "true" ? -1 : b === "true" ? 1 : 0))[0]!;
  return { label: REVIEW_FIT_LABEL[top], n: fit[top], votes };
}

/** Approved, verified-purchase reviews (server-rendered first page; more load on demand). */
export async function Reviews({ productId, ratingAvgX100, ratingCount }: { productId: string; ratingAvgX100: number; ratingCount: number }) {
  let data: ReviewsPage | null = null;
  try {
    data = await api<ReviewsPage>(`/reviews/product/${productId}`, { next: { revalidate: 60 } } as RequestInit);
  } catch {
    /* reviews are optional — the page still renders */
  }
  // A cached response from an older API version can lack newer fields — fill them in instead of crashing the page.
  if (data) data = { ...data, reviews: data.reviews ?? [], breakdown: data.breakdown ?? {}, fit: data.fit ?? { small: 0, true: 0, large: 0 } };
  const total = data?.total ?? data?.reviews.length ?? 0;
  const fit = data ? fitHint(data.fit) : null;
  const avg = ratingAvgX100 / 100;

  return (
    <section id="reviews" className="scroll-mt-24 border-t border-line pt-12" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-3xl">Reviews</h2>
      {!data || total === 0 ? (
        <p className="mt-4 max-w-xl text-stone">
          No reviews yet. Bought this? Once it&apos;s delivered you can review it from{" "}
          <Link href="/account?tab=orders" className="text-midnight underline underline-offset-2">your orders</Link> or{" "}
          <Link href="/track-order" className="text-midnight underline underline-offset-2">order tracking</Link>.
        </p>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-14">
          <div>
            <div className="flex items-end gap-3">
              <p className="font-display text-6xl leading-none">{avg.toFixed(1)}</p>
              <div className="pb-1">
                <p className="flex gap-0.5" aria-label={`Average ${avg.toFixed(1)} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={i < Math.round(avg) ? "size-4 fill-brass text-brass" : "size-4 text-line"} aria-hidden />
                  ))}
                </p>
                <p className="mt-1 text-sm text-stone">{ratingCount || total} verified {(ratingCount || total) === 1 ? "review" : "reviews"}</p>
              </div>
            </div>
            <RatingBars breakdown={data.breakdown} total={total} />
            {fit && (
              <p className="mt-6 flex items-start gap-2 rounded-xl bg-linen/70 p-3 text-sm">
                <Ruler className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
                <span>
                  <strong className="font-medium">Most say: {fit.label.toLowerCase()}</strong>
                  <span className="block text-xs text-stone">{fit.n} of {fit.votes} customers who told us about the fit</span>
                </span>
              </p>
            )}
          </div>
          <ReviewList productId={productId} initial={data.reviews} total={total} />
        </div>
      )}
    </section>
  );
}
