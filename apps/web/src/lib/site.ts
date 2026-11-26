/**
 * The shop's public contact details — the ONE place phone / WhatsApp / email / address links are built from
 * (never from user input). Set the NEXT_PUBLIC_SHOP_* variables for the real shop; the defaults are obvious
 * placeholders for the "Seamwell" sample brand.
 */
const env = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);
const digits = (v: string) => v.replace(/\D/g, "");

export const SITE = {
  name: "Seamwell Tailoring",
  /** Shown to people, e.g. "+94 77 000 0000". */
  phone: env(process.env.NEXT_PUBLIC_SHOP_PHONE, "+94 77 000 0000"),
  /** WhatsApp number in international format (digits only are used for the link). */
  whatsapp: env(process.env.NEXT_PUBLIC_SHOP_WHATSAPP, "+94 77 000 0000"),
  email: env(process.env.NEXT_PUBLIC_SHOP_EMAIL, "hello@seamwell.example"),
  address: env(process.env.NEXT_PUBLIC_SHOP_ADDRESS, "Atelier address — set NEXT_PUBLIC_SHOP_ADDRESS, Colombo"),
  /** A Google Maps link to the atelier. */
  mapUrl: env(process.env.NEXT_PUBLIC_SHOP_MAP_URL, "https://maps.google.com/?q=Colombo%2C+Sri+Lanka"),
  hours: [
    { days: "Monday – Friday", time: "9.30 am – 7.00 pm" },
    { days: "Saturday", time: "9.30 am – 5.00 pm" },
    { days: "Sunday & poya days", time: "Closed" },
  ],
} as const;

/** tel: link for the shop phone. */
export const telHref = () => `tel:+${digits(SITE.phone)}`;

/** WhatsApp click-to-chat link with an optional pre-filled message (encoded). */
export const whatsappHref = (message?: string) => `https://wa.me/${digits(SITE.whatsapp)}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

export const mailHref = (subject?: string) => `mailto:${SITE.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;

/** Only allow the map link to point at Google Maps (it comes from configuration, but be strict anyway). */
export const safeMapUrl = () => (/^https:\/\/(www\.)?(maps\.google\.com|google\.com\/maps|maps\.app\.goo\.gl)\//.test(SITE.mapUrl) ? SITE.mapUrl : "https://maps.google.com/?q=Colombo%2C+Sri+Lanka");
