import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ReviewFromLink } from "@/components/reviews/ReviewFromLink";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Review your order", robots: { index: false } };

type Product = { id: string; name: string; slug: string; images: { url: string }[] };

/** Opened from the "delivered" email: /review?order=SW-…&product=<slug>. The customer confirms with their email. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const order = typeof sp.order === "string" && /^SW-[A-Z0-9]{6,10}$/i.test(sp.order) ? sp.order.toUpperCase() : "";
  const slug = typeof sp.product === "string" && /^[a-z0-9-]{1,120}$/.test(sp.product) ? sp.product : "";
  let product: Product | null = null;
  if (slug) {
    try {
      product = (await api<{ product: Product }>(`/products/${slug}`, { next: { revalidate: 300 } } as RequestInit)).product;
    } catch {
      product = null;
    }
  }

  return (
    <AuthShell eyebrow="Verified review" title={<>How did it <em>fit</em>?</>} description="Reviews come only from customers whose order was delivered.">
      {order && product ? (
        <ReviewFromLink orderNumber={order} product={{ id: product.id, name: product.name, imageUrl: product.images[0]?.url ?? null }} />
      ) : (
        <p className="rounded-xl bg-wine/10 p-3 text-sm text-wine">
          This review link is incomplete. Open it from your email again, or find your order on <Link href="/track-order" className="font-medium underline underline-offset-2">Track order</Link> and review it there.
        </p>
      )}
    </AuthShell>
  );
}
