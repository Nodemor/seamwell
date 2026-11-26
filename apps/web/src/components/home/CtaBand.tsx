import Link from "next/link";
import { TryOnButton } from "@/components/tryon/TryOnButton";

export function CtaBand() {
  return (
    <section className="container-sw pt-24">
      <div data-reveal="scale" className="relative overflow-hidden rounded-[2rem] bg-midnight px-6 py-16 text-center text-ivory md:px-16 md:py-20">
        <div aria-hidden className="pinstripe absolute inset-0 opacity-40 [filter:invert(1)]" />
        <p className="eyebrow relative text-brass">Not sure about the fit?</p>
        <h2 className="relative mx-auto mt-4 max-w-3xl text-[clamp(2.2rem,5vw,4rem)] leading-tight text-ivory">Try it on at home, then let us tailor it to you.</h2>
        <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
          <TryOnButton />
          <Link href="/shop" className="rounded-full border border-ivory/25 px-6 py-3.5 text-[0.95rem] font-medium transition hover:border-ivory/60 hover:bg-white/5">
            Browse the collection
          </Link>
        </div>
      </div>
    </section>
  );
}
