import { BODY } from "@/components/brand/figure";

/** Where each measurement is taken, numbered to match the list on /help/sizes. */
export const MEASURES = [
  { n: 1, name: "Neck", how: "Around the base of your neck, where a shirt collar sits. Keep one finger under the tape." },
  { n: 2, name: "Chest", how: "Around the fullest part of your chest, under the arms, with the tape level across your back." },
  { n: 3, name: "Waist", how: "Around your natural waist, where your trousers sit — usually just above the hip bones." },
  { n: 4, name: "Hip", how: "Around the fullest part of your seat, feet together." },
  { n: 5, name: "Sleeve", how: "From the shoulder point, down the outside of a slightly bent arm, to the wrist bone." },
  { n: 6, name: "Inside leg", how: "From the crotch seam down the inside of your leg to the ankle bone." },
] as const;

const BRASS = "var(--sw-brass)";

function Tag({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="6.5" fill={BRASS} />
      <text y="2.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="var(--sw-ink)" style={{ fontFamily: "var(--font-sans)" }}>{n}</text>
    </g>
  );
}

/** A front-view figure with the six measuring lines (static SVG — fine for a server component). */
export function MeasureDiagram({ className }: { className?: string }) {
  return (
    <svg viewBox="-34 -6 168 272" className={className} role="img" aria-labelledby="measure-title">
      <title id="measure-title">Where to measure: 1 neck, 2 chest, 3 waist, 4 hip, 5 sleeve, 6 inside leg</title>
      <g fill="none" stroke="var(--sw-stone)" strokeOpacity=".55" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="50" cy="22" r="14" />
        <path d={BODY.down} />
      </g>
      <g fill="none" stroke={BRASS} strokeWidth="1.8" strokeLinecap="round">
        <ellipse cx="50" cy="40" rx="7.5" ry="2.4" />
        <ellipse cx="50" cy="66" rx="19.5" ry="3.6" />
        <ellipse cx="50" cy="100" rx="17" ry="3.2" />
        <ellipse cx="50" cy="138" rx="18" ry="3.6" />
        <path d="M23 51 C 17 80, 15 112, 13 142" strokeDasharray="3 3" />
        <path d="M51 156 L 54 244" strokeDasharray="3 3" />
      </g>
      <Tag n={1} x={66} y={36} />
      <Tag n={2} x={80} y={66} />
      <Tag n={3} x={77} y={100} />
      <Tag n={4} x={78} y={138} />
      <Tag n={5} x={2} y={96} />
      <Tag n={6} x={66} y={200} />
    </svg>
  );
}
