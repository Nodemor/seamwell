import type { Metadata } from "next";
import { TryOnStudio } from "@/components/tryon/TryOnStudio";

export const metadata: Metadata = { title: "Virtual Try-On", description: "Upload a photo and see any Seamwell suit, blazer, shirt or trousers on yourself — free." };

const FAKE = ["ok", "error", "partial"] as const;

export default async function TryOnPage({ searchParams }: { searchParams: Promise<{ product?: string; fake?: string }> }) {
  const { product, fake } = await searchParams;
  // Development only: ?fake=1|error|partial swaps in a stand-in runner so UI tests don't spend Hugging Face quota.
  const fakeMode = process.env.NODE_ENV !== "production" && fake ? (fake === "1" ? "ok" : FAKE.find((f) => f === fake)) : undefined;
  return (
    <div className="container-sw pt-10 sm:pt-12">
      <p className="eyebrow">Virtual Try-On · Free</p>
      <h1 className="mt-3 text-[clamp(2.4rem,5vw,4rem)] leading-tight">See it on you.</h1>
      <p className="mt-3 max-w-2xl text-stone">Three quick steps: a photo of you, the pieces you like, and our AI dresses you in them. It shows how the style looks on you — for the right size, use our size guide or visit for a free fitting.</p>
      <div className="mt-8 sm:mt-10">
        <TryOnStudio initialProductSlug={product && /^[a-z0-9-]{1,120}$/.test(product) ? product : undefined} fake={fakeMode} />
      </div>
    </div>
  );
}
