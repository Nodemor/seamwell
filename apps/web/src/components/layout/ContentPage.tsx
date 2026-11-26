import { Breadcrumbs, type Crumb } from "@/components/layout/Breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * Layout for the content pages (help, about, contact, terms, privacy): breadcrumbs, eyebrow, title, intro and a
 * readable column of text styled by `.sw-prose` (globals.css). Server component — no animation beyond the global
 * `data-reveal` system.
 */
export function ContentPage({ eyebrow, title, intro, crumbs, children, wide = false }: { eyebrow: string; title: string; intro?: React.ReactNode; crumbs: Crumb[]; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="container-sw py-10 sm:py-14">
      <Breadcrumbs items={crumbs} />
      <header className="mt-6 max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-[clamp(2.4rem,5vw,3.6rem)] leading-tight">{title}</h1>
        {intro && <p className="mt-4 text-lg leading-relaxed text-stone">{intro}</p>}
      </header>
      <div className={cn("sw-prose mt-10", wide ? "max-w-5xl" : "max-w-3xl")}>{children}</div>
    </div>
  );
}

/** A highlighted card inside a content page (e.g. the try-on privacy box, "how to start a return"). */
export function ContentCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[var(--radius-xl)] border border-line bg-paper p-6", className)}>{children}</div>;
}
