"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { emailSchema } from "@seamwell/shared";
import { FormMessage } from "@/components/auth/AuthShell";
import type { Reviewable } from "@/components/reviews/ReviewableItems";
import { type ReviewProduct, ReviewForm } from "@/components/reviews/ReviewForm";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { api, ApiError } from "@/lib/api";

/**
 * The email link carries only the order number and product (nothing secret), so the customer confirms with
 * the email they ordered with — the same check as order tracking (rate-limited, same answer for wrong email / no order).
 */
export function ReviewFromLink({ orderNumber, product }: { orderNumber: string; product: ReviewProduct }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ orderNumber: string; email: string } | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter your email");
    setBusy(true);
    setError("");
    try {
      const { order } = await api<{ order: { status: string; reviewable: Reviewable[] } }>("/orders/track", { method: "POST", json: { orderNumber, email: parsed.data } });
      if (order.reviewable.some((r) => r.productId === product.id)) setProof({ orderNumber, email: parsed.data });
      else if (order.status !== "delivered") setError("This order hasn't been delivered yet — you can review it once it arrives.");
      else setError(`You've already reviewed ${product.name} for this order. Thank you!`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (proof) return <ReviewForm product={product} proof={proof} />;

  return (
    <form ref={ref} onSubmit={check} className="space-y-5" noValidate>
      <p className="text-sm text-stone">
        Reviewing <strong className="font-medium text-ink">{product.name}</strong> from order <span className="font-mono text-ink">{orderNumber}</span>.
      </p>
      <FormField label="The email you ordered with" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error && !/delivered|already/.test(error) ? error : undefined} />
      {error && /delivered|already/.test(error) && <FormMessage tone="info">{error}</FormMessage>}
      <Button type="submit" size="lg" block loading={busy}>Continue</Button>
      <p className="text-xs text-stone">Signed in? You can also review from <Link href="/account?tab=orders" className="underline underline-offset-2">Account → Orders</Link>.</p>
    </form>
  );
}
