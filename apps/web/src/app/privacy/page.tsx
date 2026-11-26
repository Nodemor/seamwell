import type { Metadata } from "next";
import Link from "next/link";
import { OFFICIAL_SPACE, spacePage, TRYON_SPACES } from "@/lib/tryon/spaces";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Seamwell Tailoring handles your order details and your Virtual Try-On photos.",
};

/**
 * Privacy policy. The Virtual Try-On section is complete (phase 7); phase 8 polishes the rest of the content pages.
 */
export default function PrivacyPage() {
  return (
    <div className="container-sw max-w-3xl py-12 sm:py-16">
      <p className="eyebrow">Your privacy</p>
      <h1 className="mt-3 text-[clamp(2.4rem,5vw,3.6rem)] leading-tight">Privacy policy</h1>
      <p className="mt-4 text-stone">We collect only what we need to make and deliver your clothes, and we never sell your data.</p>

      <div className="mt-10 space-y-10 text-[0.95rem] leading-relaxed text-ink/90 [&_h2]:text-2xl [&_h2]:text-ink [&_li]:mt-1.5 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        <section aria-labelledby="orders">
          <h2 id="orders">Orders and accounts</h2>
          <ul>
            <li>For an order we keep your name, phone, email and delivery address, what you bought and how you paid (cash on delivery or bank transfer). We use them to make, deliver and support your order.</li>
            <li>If you create an account we also keep your password as a secure one-way hash — we can&apos;t read it.</li>
            <li>We share your delivery details only with the courier delivering your parcel.</li>
            <li>Reviews show your first name and last initial, your words and any photo you added — only after we&apos;ve checked them.</li>
          </ul>
        </section>

        <section id="try-on" aria-labelledby="try-on-title" className="scroll-mt-24 rounded-[var(--radius-xl)] border border-line bg-paper p-6">
          <h2 id="try-on-title">Virtual Try-On photos</h2>
          <ul>
            <li><strong>Seamwell never receives or stores your photo.</strong> It stays in your browser&apos;s memory and is forgotten when you close the tab (or press &ldquo;Forget my photo&rdquo;). It isn&apos;t saved on your device either, unless you press &ldquo;Save image&rdquo;.</li>
            <li>The photo check (is your face and are your hands visible?) runs on your own device. The checking model is downloaded from Google&apos;s and jsDelivr&apos;s servers, but your photo isn&apos;t sent to them.</li>
            <li>
              When you press &ldquo;Try it on&rdquo;, your browser sends the photo and the garment photos directly to a third-party AI service: the <strong>FASHN virtual try-on model, run on Hugging Face</strong>. They process it to make the picture and send it back. We use the official FASHN service whenever it&apos;s working; when it&apos;s busy, the try-on uses a public copy of the same model run by another Hugging Face user. The services we use:
              <ul>
                {TRYON_SPACES.map((id) => (
                  <li key={id}>
                    <a href={spacePage(id)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{id}</a>
                    {id === OFFICIAL_SPACE ? " (official, by FASHN)" : " (public copy)"}
                  </li>
                ))}
              </ul>
              <span className="mt-3 block">Each try-on goes to one of them only. Their own terms and privacy policies apply —{" "}
              <a href="https://huggingface.co/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Hugging Face privacy policy</a>.</span>
            </li>
            <li>The try-on is free because it uses Hugging Face&apos;s small free daily AI allowance for your internet connection — no account needed.</li>
            <li>Prefer not to use your own photo? Use our sample model instead.</li>
          </ul>
        </section>

        <section aria-labelledby="cookies">
          <h2 id="cookies">Cookies and storage</h2>
          <ul>
            <li>Signing in uses secure, http-only cookies that only our site can read.</li>
            <li>Your shopping bag is saved in your browser so it&apos;s still there next time. We don&apos;t use advertising or tracking cookies.</li>
          </ul>
        </section>

        <section aria-labelledby="rights">
          <h2 id="rights">Your choices</h2>
          <p className="mt-3">You can ask us to see, correct or delete your details at any time — just reply to any email from us. Signed-in customers can update their addresses in <Link href="/account" className="underline underline-offset-4">your account</Link>. We keep order records only as long as the law requires for accounting.</p>
        </section>
      </div>
    </div>
  );
}
