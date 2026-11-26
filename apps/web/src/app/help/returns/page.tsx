import { Scissors } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContentCard, ContentPage } from "@/components/layout/ContentPage";
import { mailHref, SITE, whatsappHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Returns & alterations",
  description: "Free alterations within 30 days, 14-day returns on ready-made pieces, and how to start a return or exchange with Seamwell.",
};

export default function ReturnsPage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Returns & alterations"
      intro="We want every piece to fit like it was always yours. If it doesn't, we'll adjust it for free — and ready-made pieces can be returned."
      crumbs={[{ label: "Home", href: "/" }, { label: "Help" }, { label: "Returns & alterations" }]}
    >
      <ContentCard>
        <Scissors className="size-6 text-brass" aria-hidden />
        <p className="mt-3 text-lg font-medium text-ink">Free alterations for 30 days</p>
        <p className="mt-1 text-stone">Hems, sleeve length and waist adjustments are free within 30 days of delivery. Bring the piece to the atelier, or send it with the courier and we&apos;ll return it altered — you only pay the courier.</p>
      </ContentCard>

      <h2>Returns</h2>
      <ul>
        <li>Ready-made pieces can be returned within <strong>14 days of delivery</strong> if they&apos;re unworn, unwashed and still have their tags.</li>
        <li><strong>Made-to-measure pieces and Nilame kits</strong> are cut for you, so they can&apos;t be returned unless they&apos;re faulty — but alterations are always free.</li>
        <li>Prefer a different size? We&apos;ll exchange it if the size is in stock; otherwise we refund you.</li>
      </ul>

      <h2>Faulty or wrong item</h2>
      <p>If something arrives damaged or isn&apos;t what you ordered, tell us within 7 days with a photo. We&apos;ll collect it at our cost and send the right piece or refund you in full.</p>

      <h2>How to start a return</h2>
      <ol>
        <li>Message us with your order number (e.g. SW-AB12CD) on <a href={whatsappHref("Hello Seamwell, I'd like to return or exchange an item from my order.")} target="_blank" rel="noopener noreferrer">WhatsApp</a> or by <a href={mailHref("Return request")}>email ({SITE.email})</a>.</li>
        <li>We&apos;ll reply within one working day with how to send it back.</li>
        <li>Once we&apos;ve checked the piece, refunds are paid by bank transfer within 7 working days — for cash-on-delivery orders too.</li>
      </ol>
      <p>You can follow your order any time on <Link href="/track-order">Track your order</Link>.</p>
    </ContentPage>
  );
}
