import type { Metadata } from "next";
import Link from "next/link";
import { SIZE_CHARTS, type SizeChartKey } from "@seamwell/shared";
import { MEASURES, MeasureDiagram } from "@/components/help/MeasureDiagram";
import { ContentCard, ContentPage } from "@/components/layout/ContentPage";
import { whatsappHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Size guide",
  description: "Seamwell size charts for suits, blazers, shirts, trousers, kurtas and Nilame kits — and how to measure yourself at home.",
};

export default function SizesPage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Size guide"
      intro="All measurements are of your body in centimetres, not of the garment. Between two sizes? Choose the larger — our alterations are free."
      crumbs={[{ label: "Home", href: "/" }, { label: "Help" }, { label: "Size guide" }]}
      wide
    >
      <h2 id="measure">How to measure yourself</h2>
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,15rem)_1fr]">
        <MeasureDiagram className="mx-auto h-auto w-52 md:w-full" />
        <div>
          <ol>
            {MEASURES.map((m) => (
              <li key={m.n}>
                <strong>{m.name}.</strong> {m.how}
              </li>
            ))}
          </ol>
          <ContentCard className="mt-6">
            <p className="font-medium text-ink">Tips for an accurate fit</p>
            <ul className="mt-2">
              <li>Measure over a thin shirt, not over a jacket.</li>
              <li>Keep the tape snug but not tight, and level all the way round.</li>
              <li>Ask someone to help with chest and sleeve — it&apos;s hard to do alone.</li>
            </ul>
          </ContentCard>
        </div>
      </div>

      {(Object.keys(SIZE_CHARTS) as SizeChartKey[]).map((k) => {
        const c = SIZE_CHARTS[k];
        return (
          <section key={k} aria-labelledby={`chart-${k}`}>
            <h2 id={`chart-${k}`}>{c.label}</h2>
            <p>{c.note}</p>
            <div className="mt-4 overflow-x-auto rounded-[var(--radius)] border border-line outline-none focus-visible:ring-4 focus-visible:ring-brass/35" role="region" aria-label={`${c.label} size chart`} tabIndex={0}>
              <table className="min-w-[22rem]">
                <caption className="sr-only">{c.label} size chart, body measurements in cm</caption>
                <thead>
                  <tr>{c.columns.map((h) => <th key={h} scope="col">{h}{h === "Size" ? "" : " (cm)"}</th>)}</tr>
                </thead>
                <tbody>
                  {c.rows.map((r) => (
                    <tr key={r[0]}>
                      {r.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <h2>Kurtas and Nilame kits</h2>
      <ul>
        <li><strong>Kurtas</strong> follow the shirt chart (S–XL) by chest measurement; the churidar is cut to your waist.</li>
        <li><strong>Nilame kits</strong> use the jacket sizes (38–46) as a starting point and are always fitted to your measurements in the atelier before the wedding.</li>
      </ul>

      <h2>Still not sure?</h2>
      <p>
        Try the <Link href="/try-on">Virtual Try-On</Link> to see the style on you, use the size helper when you add an outfit to your bag, or{" "}
        <a href={whatsappHref("Hello Seamwell, can you help me choose a size?")} target="_blank" rel="noopener noreferrer">send us your measurements on WhatsApp</a>. Alterations to hems, sleeves and waist are free.
      </p>
    </ContentPage>
  );
}
