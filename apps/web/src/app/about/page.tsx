import { Ruler, Scissors, Shirt, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const metadata: Metadata = {
  title: "About the atelier",
  description: "Seamwell Tailoring: a Colombo atelier cutting suits, shirts, trousers, Nilame kits and kurtas by hand since 1998.",
};

const STEPS = [
  { icon: Ruler, title: "Measure", text: "We take 20+ measurements — or start from your size and your Virtual Try-On." },
  { icon: Scissors, title: "Cut", text: "Every pattern is cut by hand in our Colombo workroom, from cloth we choose bolt by bolt." },
  { icon: Shirt, title: "Fit", text: "A fitting on you, not on a mannequin. Hems, sleeves and waist are adjusted until they sit right." },
  { icon: Sparkles, title: "Finish", text: "Hand-finished buttonholes, pressed seams and a final check before it leaves the atelier." },
];

export default function AboutPage() {
  return (
    <div className="container-sw py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />
      <div className="mt-6 grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="eyebrow">The atelier · Since 1998</p>
          <h1 className="mt-3 text-[clamp(2.4rem,5vw,4rem)] leading-tight">Cut by hand in Colombo, fitted on real people.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone">
            Seamwell began as a two-chair tailoring room off Galle Road. Today we make suits, blazers, shirts and trousers for everyday Colombo — and the
            Nilame kits and kurtas families wear on their biggest days.
          </p>
        </div>
        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)] bg-linen">
          <Image src="/hero/suit.webp" alt="Navy suit jacket with a white shirt and dotted tie on a tailor's mannequin" fill sizes="(min-width: 1024px) 380px, 80vw" className="object-contain p-6" />
        </div>
      </div>

      <section className="mt-20" aria-labelledby="how-title">
        <h2 id="how-title" className="text-[clamp(2rem,4vw,3rem)]">How a Seamwell piece is made</h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} data-reveal className="rounded-[var(--radius-xl)] border border-line bg-paper p-6">
              <s.icon className="size-6 text-brass" aria-hidden />
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-brass-ink">Step {i + 1}</p>
              <h3 className="mt-1 font-sans text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20 grid items-center gap-10 rounded-[2rem] bg-midnight p-8 text-ivory md:grid-cols-[1fr_1.2fr] md:p-12" aria-labelledby="traditions-title">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-[16rem]">
          <Image src="/catalog/categories/nilame.webp" alt="Red velvet Nilame jacket with gold embroidery and toppi hat" fill sizes="16rem" className="object-contain" />
        </div>
        <div>
          <p className="eyebrow text-brass">Wedding & festive</p>
          <h2 id="traditions-title" className="mt-3 text-[clamp(2rem,4vw,3rem)] text-ivory">Made for the days that matter</h2>
          <p className="mt-4 leading-relaxed text-ivory/80">
            Our Kandyan Nilame kits are embroidered in gold zari on velvet and fitted for the Poruwa ceremony; our kurta sets are made for weddings, mehendi
            nights and Deepavali. Try the whole kit on yourself first, then we fit it to you.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/shop?category=nilame" className="rounded-full bg-ivory px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-brass-soft">Nilame kits</Link>
            <Link href="/shop?category=kurtas" className="rounded-full border border-ivory/30 px-5 py-3 text-sm font-medium transition-colors hover:border-ivory/70">Kurtas</Link>
          </div>
        </div>
      </section>

      <p className="mt-16 text-center text-stone">
        Come and see us — <Link href="/contact" className="font-medium text-midnight underline underline-offset-4">visit the atelier</Link>.
      </p>
    </div>
  );
}
