import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const COLS = [
  { title: "Shop", links: [["Men", "/shop?gender=men"], ["Women", "/shop?gender=women"], ["Suits", "/shop?category=suits"], ["Nilame kits", "/shop?category=nilame"], ["Kurtas", "/shop?category=kurtas"], ["Sarees", "/shop?category=sarees"], ["Salwar kits", "/shop?category=salwar"], ["Virtual Try-On", "/try-on"]] },
  { title: "Help", links: [["Track your order", "/track-order"], ["Delivery & payment", "/help/delivery"], ["Size guide", "/help/sizes"], ["Returns & alterations", "/help/returns"], ["Contact & visit", "/contact"]] },
  { title: "Seamwell", links: [["About the atelier", "/about"], ["Sign in", "/login"], ["Create account", "/register"], ["My orders", "/account"]] },
] as const;

export function Footer() {
  return (
    <footer className="mt-24 bg-midnight text-ivory/80">
      <div className="container-sw grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Logo tone="light" />
          <p className="mt-5 text-sm leading-relaxed text-ivory/65">
            Made-to-measure suits, shirts and trousers from our Colombo atelier. Try any look on yourself before you buy.
          </p>
          <p className="mt-6 text-sm text-ivory/65">
            Cash on delivery · Bank transfer
            <br />
            Island-wide tracked delivery
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-brass">{c.title}</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="transition-colors hover:text-ivory">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-sw flex flex-col justify-between gap-3 py-6 text-xs text-ivory/65 sm:flex-row">
          <p>© {new Date().getFullYear()} Seamwell Tailoring. Sample brand — replace with the shop&apos;s details.</p>
          <p>
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-ivory sm:min-h-0">Privacy</Link> · <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-ivory sm:min-h-0">Terms</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
