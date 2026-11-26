/**
 * Structured data (schema.org JSON-LD).
 * Built ONLY with JSON.stringify from our own data, with every "<" written as the JSON escape
 * backslash-u003c, so no value can ever close the script tag. This is the one sanctioned use of
 * dangerouslySetInnerHTML (see docs/02-security.md and the phase 2 security checklist).
 */
const BS = String.fromCharCode(92); // backslash — built at runtime so no tool or formatter can unescape it
const ESCAPES: [string, string][] = [
  ["<", `${BS}u003c`],
  [">", `${BS}u003e`],
  ["&", `${BS}u0026`],
  [String.fromCharCode(0x2028), `${BS}u2028`],
  [String.fromCharCode(0x2029), `${BS}u2029`],
];

/** JSON safe to embed inside a script element (still valid JSON for parsers). */
export function safeJson(data: unknown) {
  return ESCAPES.reduce((s, [from, to]) => s.replaceAll(from, to), JSON.stringify(data));
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(data) }} />;
}

/** Absolute URL on our site (JSON-LD / Open Graph need absolute URLs). */
export const siteUrl = (path = "/") => new URL(path, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString();
