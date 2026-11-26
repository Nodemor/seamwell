import { api } from "@/lib/api";
import { TestimonialsMarquee, type Testimonial } from "@/components/home/TestimonialsMarquee";

/**
 * Real customer words only: the latest approved 4–5 star reviews (verified purchases) from the API.
 * Hidden when there are fewer than three — we never show made-up testimonials.
 */
export async function Testimonials() {
  const data = await api<{ reviews: Testimonial[] }>("/reviews/recent?limit=12", { next: { revalidate: 300 } } as RequestInit).catch(() => null);
  // Real, distinct reviews only (the same text twice is shown once)
  const seen = new Set<string>();
  const reviews = (data?.reviews ?? []).filter((r) => {
    const key = `${r.authorName}|${r.body.trim().toLowerCase()}`;
    if (r.body.trim().length < 20 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (reviews.length < 3) return null;
  return <TestimonialsMarquee reviews={reviews} />;
}
