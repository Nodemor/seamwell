import { Banknote, Landmark, PackageCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SL_DISTRICTS } from "@seamwell/shared";
import { ContentCard, ContentPage } from "@/components/layout/ContentPage";
import { api } from "@/lib/api";
import { SITE, whatsappHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Delivery & payment",
  description: "Island-wide tracked delivery to all 25 districts of Sri Lanka, cash on delivery and bank transfer — fees, times and how payment works.",
};
export const revalidate = 300;

const lkr = (cents: number) => `LKR ${(cents / 100).toLocaleString("en-LK")}`;

export default async function DeliveryPage() {
  // The same numbers checkout uses (API settings) — fall back to the defaults if the API is unreachable.
  const info = await api<{ shippingFeeCents: number; freeShippingThresholdCents: number }>("/shop/info", { next: { revalidate: 300 } } as RequestInit).catch(() => ({ shippingFeeCents: 45000, freeShippingThresholdCents: 2500000 }));
  return (
    <ContentPage
      eyebrow="Help"
      title="Delivery & payment"
      intro="We deliver to every district in Sri Lanka with a tracked courier, and you can pay in cash when your order arrives or by bank transfer."
      crumbs={[{ label: "Home", href: "/" }, { label: "Help" }, { label: "Delivery & payment" }]}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ContentCard>
          <Truck className="size-6 text-brass" aria-hidden />
          <p className="mt-3 font-medium text-ink">Delivery fee</p>
          <p className="mt-1 text-stone">{lkr(info.shippingFeeCents)} anywhere in Sri Lanka — <strong className="text-ink">free on orders of {lkr(info.freeShippingThresholdCents)} or more</strong>.</p>
        </ContentCard>
        <ContentCard>
          <PackageCheck className="size-6 text-brass" aria-hidden />
          <p className="mt-3 font-medium text-ink">Tracked to your door</p>
          <p className="mt-1 text-stone">When your parcel leaves the atelier we email you the courier and tracking number. You can also <Link href="/track-order" className="text-midnight underline underline-offset-4">track your order</Link> here.</p>
        </ContentCard>
      </div>

      <h2>How long it takes</h2>
      <table>
        <thead>
          <tr><th scope="col">Where</th><th scope="col">Ready-made sizes</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Colombo &amp; suburbs</th><td>1–2 working days</td></tr>
          <tr><th scope="row">Other districts</th><td>2–4 working days</td></tr>
          <tr><th scope="row">Northern &amp; Eastern provinces</th><td>3–5 working days</td></tr>
        </tbody>
      </table>
      <p>Times start when your order is confirmed (for bank transfers, once the payment arrives). <strong>Made-to-measure pieces and Nilame kits</strong> take 7–14 days after your fitting — we&apos;ll agree the date with you.</p>

      <h2>Where we deliver</h2>
      <p>All 25 districts: {SL_DISTRICTS.join(", ")}.</p>

      <h2>Paying for your order</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <ContentCard>
          <Banknote className="size-6 text-brass" aria-hidden />
          <p className="mt-3 font-medium text-ink">Cash on delivery</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-stone">
            <li>Pay the courier in cash when the parcel arrives.</li>
            <li>Please have the exact amount ready — couriers often carry little change.</li>
            <li>You can check the parcel&apos;s label and order number before paying.</li>
          </ul>
        </ContentCard>
        <ContentCard>
          <Landmark className="size-6 text-brass" aria-hidden />
          <p className="mt-3 font-medium text-ink">Bank transfer</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-stone">
            <li>Our bank details are shown after you order and in your confirmation email.</li>
            <li>Use your order number (e.g. SW-AB12CD) as the reference.</li>
            <li>We confirm your payment within one working day, then pack your order.</li>
          </ul>
        </ContentCard>
      </div>
      <p>Card payments are coming soon. Prices are always worked out again by our system at checkout, so the total you confirm is the total you pay.</p>

      <h2>Questions?</h2>
      <p>
        Message us on{" "}
        <a href={whatsappHref("Hello Seamwell, I have a question about delivery.")} target="_blank" rel="noopener noreferrer">WhatsApp ({SITE.whatsapp})</a> or see our{" "}
        <Link href="/contact">contact details</Link>.
      </p>
    </ContentPage>
  );
}
