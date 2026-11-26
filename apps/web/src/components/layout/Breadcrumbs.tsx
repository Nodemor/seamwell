import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { JsonLd, siteUrl } from "@/components/seo/JsonLd";

export type Crumb = { label: string; href?: string };

/** Visible breadcrumb trail + matching BreadcrumbList structured data. Last crumb = current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-stone">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {c.href && !last ? (
                  <Link href={c.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline sm:min-h-0">{c.label}</Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? "text-ink" : undefined}>{c.label}</span>
                )}
                {!last && <ChevronRight className="size-3.5 text-line" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, ...(c.href && { item: siteUrl(c.href) }) })),
        }}
      />
    </>
  );
}
