import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import SpotlightCard from "@/components/bits/SpotlightCard";
import Image from "next/image";

/** Category cards — photos from /public/catalog/categories (the shop's own sample shots). */
const PIECES = [
  { slug: "suits", label: "Suits", note: "Tuxedos, two & three-piece", alt: "Black tuxedo with waistcoat and bow tie" },
  { slug: "blazers", label: "Blazers", note: "Wool, tweed, summer white", alt: "Grey tweed blazer" },
  { slug: "shirts", label: "Shirts", note: "Oxford, poplin, sateen", alt: "White long-sleeve dress shirt" },
  { slug: "trousers", label: "Trousers", note: "Tailored, check & chinos", alt: "Black tailored trousers with a belt" },
  { slug: "nilame", label: "Nilame kits", note: "Kandyan wedding attire", alt: "Red velvet Nilame jacket with gold embroidery and toppi hat" },
  { slug: "kurtas", label: "Kurtas", note: "Weddings, Deepavali & parties", alt: "Ivory silk kurta with gold embroidery and stole" },
  { slug: "sarees", label: "Sarees", note: "Kandyan osariya & Banarasi silk", alt: "Ivory and gold Kandyan osariya saree with gold jewellery" },
  { slug: "salwar", label: "Salwar kits", note: "Patiala sets with dupatta", alt: "Royal blue embroidered kameez with Patiala salwar and net dupatta" },
  { slug: "frocks", label: "Frocks", note: "Velvet party frocks", alt: "Black sleeveless velvet party frock" },
] as const;

export function ShopByPiece() {
  return (
    <section className="container-sw py-24">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div data-reveal>
          <p className="eyebrow">The wardrobe</p>
          <h2 className="mt-3 text-[clamp(2.2rem,4.5vw,3.6rem)] leading-tight">Shop by piece</h2>
        </div>
        <p data-reveal className="max-w-sm text-stone">Mix any blazer with any shirt and trousers, or choose a full Nilame, kurta, saree or salwar set — then try the whole look on yourself.</p>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
        {PIECES.map((p) => (
          <div key={p.label} data-reveal="scale">
          {/* React Bits SpotlightCard: brass light follows the pointer / keyboard focus. GSAP animates the wrapper, not this. */}
          <SpotlightCard
            theme="light"
            spotlightColor="#B08D57"
            intensity={0.55}
            borderGlow={1}
            spotlightSize={260}
            className="h-full rounded-[var(--radius-xl)]! p-0! transition-transform duration-500 ease-[var(--ease-tailor)] hover:-translate-y-1"
            style={{ "--spotlight-card-surface": "var(--sw-paper)", "--spotlight-card-border": "var(--sw-line)", "--spotlight-card-shadow": "none" } as React.CSSProperties}
          >
          <Link
            href={`/shop?category=${p.slug}`}
            className="group relative flex aspect-[3/4] h-full flex-col justify-between rounded-[inherit] p-5 outline-offset-[-3px] md:p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl md:text-3xl">{p.label}</h3>
                <p className="mt-1 text-xs text-stone md:text-sm">{p.note}</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full border border-line transition-[rotate,background-color,border-color,color] duration-500 group-hover:rotate-45 group-hover:border-brass group-hover:bg-brass group-hover:text-ink">
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="relative mx-auto h-[68%] w-[86%] transition-transform duration-700 ease-[var(--ease-tailor)] group-hover:-translate-y-2 group-hover:scale-105">
              <Image src={`/catalog/categories/${p.slug}.webp`} alt={p.alt} fill sizes="(min-width: 768px) 28vw, 42vw" className="object-contain drop-shadow-[0_18px_24px_rgb(31_42_68/0.18)]" />
            </div>
          </Link>
          </SpotlightCard>
          </div>
        ))}
      </div>
    </section>
  );
}
