import { CalendarCheck, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { SITE, telHref, whatsappHref } from "@/lib/site";

/** "Book a fitting" band: WhatsApp / call / visit — every link built from lib/site.ts configuration. */
export function FittingBand() {
  const open = SITE.hours.filter((h) => h.time !== "Closed").map((h) => `${h.days} ${h.time}`).join(" · ");
  return (
    <section className="container-sw pt-24" aria-labelledby="fitting-title">
      <div data-reveal className="grid gap-8 rounded-[2rem] border border-line bg-paper p-8 md:grid-cols-[1.2fr_1fr] md:items-center md:p-12">
        <div>
          <p className="eyebrow flex items-center gap-2"><CalendarCheck className="size-4" aria-hidden /> Book a fitting</p>
          <h2 id="fitting-title" className="mt-3 text-[clamp(2rem,4vw,3.2rem)] leading-tight">Come in, try it on, leave with the right fit.</h2>
          <p className="mt-4 max-w-lg text-stone">Fittings are free. Send us a message with the day that suits you — for weddings, book your Nilame or kurta fitting 3–4 weeks ahead.</p>
          <p className="mt-4 text-sm text-stone">{open}</p>
        </div>
        <div className="flex flex-col gap-3">
          <a href={whatsappHref("Hello Seamwell, I'd like to book a fitting.")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-midnight px-6 font-medium text-ivory transition-colors hover:bg-midnight-2">
            <MessageCircle className="size-5" aria-hidden /> Book on WhatsApp<span className="sr-only"> (opens WhatsApp)</span>
          </a>
          <a href={telHref()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line px-6 font-medium transition-colors hover:border-ink/40">
            <Phone className="size-5 text-brass" aria-hidden /> Call {SITE.phone}
          </a>
          <Link href="/contact" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm text-stone underline-offset-4 transition-colors hover:text-ink hover:underline">
            <MapPin className="size-4" aria-hidden /> Address & opening hours
          </Link>
        </div>
      </div>
    </section>
  );
}
