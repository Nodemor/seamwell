"use client";

import { Check, MessageSquareText, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { REVIEW_FIT_LABEL, type ReviewFit } from "@seamwell/shared";
import { toast } from "sonner";
import { AdminHeading } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Review = { id: string; productName: string; productSlug: string; authorName: string; rating: number; title: string | null; body: string; fit: ReviewFit | null; photoUrl: string | null; status: "pending" | "approved" | "rejected"; createdAt: string };
const TABS = [
  { id: "pending", label: "To check" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;

/** Moderation: verified-purchase reviews wait here until approved. Text is rendered as plain text (React escapes it). */
export function ReviewsQueue() {
  const [tab, setTab] = useState<Review["status"]>("pending");
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ reviews: Review[] }>(`/admin/reviews?status=${tab}`, { cache: "no-store" })
      .then((r) => alive && setReviews(r.reviews))
      .catch((e) => alive && (setReviews([]), toast.error(e instanceof ApiError ? e.message : "Couldn't load reviews")));
    return () => {
      alive = false;
    };
  }, [tab]);

  async function decide(r: Review, status: "approved" | "rejected") {
    setBusy(r.id);
    try {
      await api(`/admin/reviews/${r.id}`, { method: "PATCH", json: { status } });
      setReviews((list) => list?.filter((x) => x.id !== r.id) ?? null);
      toast.success(status === "approved" ? "Approved — it's now on the product page" : "Rejected");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't update the review");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <AdminHeading title="Reviews" description="Only customers with a delivered order can review. Approve the ones to show in the shop — rejecting deletes any photo." />
      <div className="mt-6 flex gap-1.5" role="group" aria-label="Show reviews">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => (setTab(t.id), setReviews(null))}
            className={cn("h-11 rounded-full border px-4 text-sm transition-colors focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none sm:h-9", tab === t.id ? "border-midnight bg-midnight text-ivory" : "border-line bg-paper text-stone hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!reviews ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2" aria-busy="true">{[0, 1].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
      ) : reviews.length === 0 ? (
        <EmptyState className="mt-6" icon={MessageSquareText} title={tab === "pending" ? "All caught up" : "Nothing here"} description={tab === "pending" ? "New reviews will appear here for you to check." : undefined} />
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col rounded-2xl border border-line bg-paper p-5">
              <p className="text-xs uppercase tracking-wider text-stone">{r.productName}</p>
              <p className="mt-2 flex items-center gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("size-4", i < r.rating ? "fill-brass text-brass" : "text-line")} aria-hidden />)}
              </p>
              {r.title && <h2 className="mt-2 font-sans text-base font-medium">{r.title}</h2>}
              <p className="mt-1 flex-1 whitespace-pre-line text-sm text-ink/90">{r.body}</p>
              {r.photoUrl && (
                <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block w-fit overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- moderation preview */}
                  <img src={r.photoUrl} alt={`Photo attached by ${r.authorName}`} className="h-32 w-24 object-cover" />
                  <span className="sr-only">(opens full size)</span>
                </a>
              )}
              {r.fit && <p className="mt-2 text-xs text-stone">Fit: {REVIEW_FIT_LABEL[r.fit]}</p>}
              <p className="mt-3 text-xs text-stone">{r.authorName} · {dateTime(r.createdAt)}</p>
              {r.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" loading={busy === r.id} onClick={() => void decide(r, "approved")}><Check aria-hidden /> Approve</Button>
                  <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => void decide(r, "rejected")}><X aria-hidden /> Reject</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
