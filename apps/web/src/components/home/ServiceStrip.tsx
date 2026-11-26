import { Banknote, Landmark, PackageCheck, Scissors } from "lucide-react";

const ITEMS = [
  { icon: Banknote, title: "Cash on delivery", text: "Pay when your order arrives." },
  { icon: Landmark, title: "Bank transfer", text: "Transfer and we confirm within a day." },
  { icon: PackageCheck, title: "Tracked delivery", text: "Courier tracking number for every order." },
  { icon: Scissors, title: "Free alterations", text: "Hem, sleeves and waist adjusted free." },
];

export function ServiceStrip() {
  return (
    <section className="container-sw">
      <div className="grid gap-px overflow-hidden rounded-[var(--radius-xl)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((it) => (
          <div key={it.title} data-reveal="fade" className="flex gap-4 bg-paper p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-linen text-midnight">
              <it.icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-sans text-[0.95rem] font-medium text-ink">{it.title}</h3>
              <p className="mt-1 text-sm text-stone">{it.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
