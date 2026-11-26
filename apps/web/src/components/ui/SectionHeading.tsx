import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: React.ReactNode;
  /** Short supporting sentence under (or beside, on wide screens) the title. */
  description?: React.ReactNode;
  link?: { href: string; label: string };
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  className?: string;
  /** Adds data-reveal to the text blocks so MotionProvider reveals them on scroll. */
  reveal?: boolean;
};

/** Eyebrow + serif title + optional description / "see all" link — used at the top of every section. */
export function SectionHeading({ eyebrow, title, description, link, as: H = "h2", align = "left", className, reveal = false }: SectionHeadingProps) {
  const r = reveal ? { "data-reveal": "up" } : {};
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-10 gap-y-5", align === "center" && "flex-col items-center text-center", className)}>
      <div {...r} className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <H className={cn("leading-[1.05]", eyebrow && "mt-3", H === "h1" ? "text-[clamp(2.4rem,5vw,4rem)]" : "text-[clamp(2.2rem,4.5vw,3.6rem)]")}>{title}</H>
        {description && align === "center" && <p className="mt-4 text-stone">{description}</p>}
      </div>
      {(description && align === "left") || link ? (
        <div {...r} className="flex max-w-sm flex-col items-start gap-3">
          {description && align === "left" && <p className="text-stone">{description}</p>}
          {link && (
            <Link href={link.href} className="group inline-flex min-h-11 items-center gap-2 text-sm font-medium text-midnight">
              <span className="underline-offset-4 group-hover:underline">{link.label}</span>
              <ArrowRight className="size-4 text-brass" aria-hidden />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
