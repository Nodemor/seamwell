import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/layout/ContentPage";
import { mailHref, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of sale",
  description: "The terms for ordering from Seamwell Tailoring: prices, payment, delivery, returns, the Virtual Try-On and reviews.",
};

/** Plain-language terms for the sample brand — have them checked by a lawyer before going live. */
export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="The small print"
      title="Terms of sale"
      intro="These terms apply when you order from this website. We've kept them short and plain."
      crumbs={[{ label: "Home", href: "/" }, { label: "Terms of sale" }]}
    >
      <h2>Ordering</h2>
      <ul>
        <li>Your order is an offer to buy. It&apos;s accepted when we confirm it by email (for bank transfers, once the payment arrives).</li>
        <li>If a piece becomes unavailable after you order, we&apos;ll tell you and refund anything you&apos;ve paid for it.</li>
      </ul>

      <h2>Prices and payment</h2>
      <ul>
        <li>Prices are in Sri Lankan rupees (LKR) and include taxes. The delivery fee is shown before you confirm.</li>
        <li>Our system works out the price of every order again at checkout — the total you confirm is the one you pay.</li>
        <li>We accept cash on delivery and bank transfer. See <Link href="/help/delivery">Delivery &amp; payment</Link>.</li>
      </ul>

      <h2>Delivery</h2>
      <p>We deliver island-wide with a tracked courier. Delivery times are estimates; made-to-measure pieces are scheduled with you after your fitting.</p>

      <h2>Returns and alterations</h2>
      <p>Free alterations for 30 days and 14-day returns on ready-made pieces — the details are on <Link href="/help/returns">Returns &amp; alterations</Link>. This doesn&apos;t affect your rights under the Consumer Affairs Authority Act of Sri Lanka.</p>

      <h2>Virtual Try-On</h2>
      <ul>
        <li>The try-on is a free preview made by an AI service. It shows how a style looks on you — <strong>not the exact fit, colour or size</strong>. Use the <Link href="/help/sizes">size guide</Link> or visit us for a fitting.</li>
        <li>Your photo is processed by a third-party service, as explained in our <Link href="/privacy#try-on">privacy policy</Link>. Only use photos of yourself, or of someone who has agreed.</li>
      </ul>

      <h2>Reviews</h2>
      <p>Only customers with a delivered order can review, and we check each review before it appears. We don&apos;t publish reviews that are offensive, off-topic or contain personal details.</p>

      <h2>Accounts</h2>
      <p>Keep your password private. You can order as a guest — an account just keeps your orders and addresses in one place.</p>

      <h2>Liability and law</h2>
      <p>We&apos;re responsible for losses that are a foreseeable result of us breaking these terms, up to the value of your order. These terms are governed by the laws of Sri Lanka.</p>

      <h2>Contact</h2>
      <p>{SITE.name} · {SITE.address} · <a href={mailHref("About your terms")}>{SITE.email}</a></p>
    </ContentPage>
  );
}
