import { cn } from "@/lib/utils";

/** Sample logo: a monogram "S" inside a stitched ring (needle-and-thread), plus the wordmark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-9 w-9", className)} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="var(--sw-midnight)" />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="var(--sw-brass)" strokeWidth="1.2" strokeDasharray="2.4 2.2" />
      <text x="24" y="31.5" textAnchor="middle" fontFamily="Cormorant Garamond, Georgia, serif" fontSize="25" fontStyle="italic" fill="var(--sw-ivory)">
        S
      </text>
      {/* needle */}
      <path d="M36.5 9.5 L30 16" stroke="var(--sw-brass)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="37.2" cy="8.8" r="1.3" fill="none" stroke="var(--sw-brass)" strokeWidth="0.9" />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className={cn("block font-display text-[1.55rem] tracking-tight", tone === "dark" ? "text-ink" : "text-ivory")}>Seamwell</span>
        <span className={cn("block text-[0.58rem] font-semibold uppercase tracking-[0.32em]", tone === "dark" ? "text-brass-ink" : "text-brass-soft")}>
          Tailoring
        </span>
      </span>
    </span>
  );
}
