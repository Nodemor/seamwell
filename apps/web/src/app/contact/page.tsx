import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { mailHref, safeMapUrl, SITE, telHref, whatsappHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact & visit",
  description: "Visit the Seamwell atelier in Colombo, book a fitting, or message us on WhatsApp — opening hours, phone and email.",
};

/** Contact details all come from lib/site.ts (configuration), never from user input. */
export default function ContactPage() {
  const ways = [
    { icon: MessageCircle, label: "WhatsApp", value: SITE.whatsapp, href: whatsappHref("Hello Seamwell, I'd like to book a fitting."), external: true, note: "Fastest — we usually reply within the hour" },
    { icon: Phone, label: "Call us", value: SITE.phone, href: telHref(), external: false, note: "During opening hours" },
    { icon: Mail, label: "Email", value: SITE.email, href: mailHref("Hello Seamwell"), external: false, note: "We reply within one working day" },
  ];
  return (
    <div className="container-sw py-10 sm:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
      <header className="mt-6 max-w-3xl">
        <p className="eyebrow">Contact & visit</p>
        <h1 className="mt-3 text-[clamp(2.4rem,5vw,3.6rem)] leading-tight">Come in for a fitting</h1>
        <p className="mt-4 text-lg leading-relaxed text-stone">Book a time on WhatsApp and we&apos;ll have your size, cloth and try-on look ready when you arrive.</p>
      </header>

      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {ways.map((w) => (
          <li key={w.label}>
            <a
              href={w.href}
              {...(w.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex h-full flex-col rounded-[var(--radius-xl)] border border-line bg-paper p-6 outline-none transition-[border-color,box-shadow] hover:border-brass focus-visible:ring-4 focus-visible:ring-brass/35"
            >
              <w.icon className="size-6 text-brass" aria-hidden />
              <span className="mt-4 text-sm text-stone">{w.label}</span>
              <span className="mt-1 break-words text-lg font-medium text-ink group-hover:underline group-hover:underline-offset-4">{w.value}</span>
              <span className="mt-2 text-xs text-stone">{w.note}</span>
              {w.external && <span className="sr-only">(opens WhatsApp)</span>}
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-[var(--radius-xl)] border border-line bg-paper p-6" aria-labelledby="visit-title">
          <MapPin className="size-6 text-brass" aria-hidden />
          <h2 id="visit-title" className="mt-4 font-sans text-lg font-medium">The atelier</h2>
          <p className="mt-1 text-stone">{SITE.address}</p>
          <a href={safeMapUrl()} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-midnight px-5 text-sm font-medium text-ivory transition-colors hover:bg-midnight-2">
            Open in Google Maps<span className="sr-only"> (opens a new tab)</span>
          </a>
        </section>
        <section className="rounded-[var(--radius-xl)] border border-line bg-paper p-6" aria-labelledby="hours-title">
          <Clock className="size-6 text-brass" aria-hidden />
          <h2 id="hours-title" className="mt-4 font-sans text-lg font-medium">Opening hours</h2>
          <dl className="mt-2 divide-y divide-line text-sm">
            {SITE.hours.map((h) => (
              <div key={h.days} className="flex justify-between gap-4 py-2">
                <dt className="text-stone">{h.days}</dt>
                <dd className="text-right text-ink">{h.time}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
