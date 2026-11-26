import type { Metadata } from "next";
import Link from "next/link";
import { MeasureDiagram } from "@/components/help/MeasureDiagram";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

const LINKS = [
  { href: "/shop", label: "Shop the collection" },
  { href: "/try-on", label: "Virtual Try-On" },
  { href: "/track-order", label: "Track your order" },
  { href: "/contact", label: "Contact us" },
];

export default function NotFound() {
  return (
    <div className="container-sw grid max-w-4xl items-center gap-10 py-20 md:grid-cols-[1fr_12rem]">
      <div className="text-center md:text-left">
        <p className="eyebrow">404 · Page not found</p>
        <h1 className="mt-3 text-[clamp(2.4rem,5vw,3.6rem)] leading-tight">This page went for a fitting.</h1>
        <p className="mt-4 text-stone">We couldn&apos;t find what you were looking for — it may have moved, or the link has a typo.</p>
        <ul className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
          {LINKS.map((l, i) => (
            <li key={l.href}>
              <Link href={l.href} className={i === 0 ? "inline-flex min-h-11 items-center rounded-full bg-midnight px-6 text-sm font-medium text-ivory transition-colors hover:bg-midnight-2" : "inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-5 text-sm transition-colors hover:border-ink/35"}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <MeasureDiagram className="mx-auto hidden h-auto w-40 opacity-70 md:block" />
    </div>
  );
}
