import Image from "next/image";

type AuthShellProps = {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Small print under the form (switch to register / sign in…). */
  footer?: React.ReactNode;
};

/**
 * Layout for sign-in / register / recovery pages: the form on the right, a midnight panel with the
 * atelier suit on the left (desktop only — phones get the form straight away).
 */
export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <div className="container-sw grid gap-10 py-10 md:py-14 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
      <div aria-hidden className="relative hidden h-full max-h-[720px] min-h-[560px] overflow-hidden rounded-[2rem] bg-midnight lg:block" data-reveal="fade">
        <div className="absolute left-1/2 top-[44%] aspect-square w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brass/40" />
        <div className="absolute left-1/2 top-[44%] aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brass/25" />
        <div className="absolute left-1/2 top-[44%] aspect-square w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(233_220_196/.22),rgb(233_220_196/0))]" />
        <Image
          src="/hero/suit.webp"
          alt=""
          width={1191}
          height={1600}
          sizes="360px"
          className="absolute bottom-[12%] left-1/2 w-[58%] max-w-[360px] -translate-x-1/2 drop-shadow-[0_30px_40px_rgb(0_0_0/0.35)]"
        />
        <p className="absolute inset-x-0 bottom-8 text-center font-display text-2xl italic text-brass-soft">Tailored to you — seen on you first.</p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <p className="eyebrow" data-reveal>{eyebrow}</p>
        <h1 className="mt-3 text-[clamp(2.4rem,5vw,3.4rem)] leading-[1.05]" data-reveal>{title}</h1>
        {description && <div className="mt-3 text-stone" data-reveal>{description}</div>}
        <div className="mt-8" data-reveal>{children}</div>
        {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-stone">{footer}</div>}
      </div>
    </div>
  );
}

/** Error (role=alert, announced) or success/info (role=status) message box for forms. */
export function FormMessage({ tone = "error", children, id }: { tone?: "error" | "info"; children: React.ReactNode; id?: string }) {
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={tone === "error" ? "rounded-xl bg-wine/10 p-3 text-sm text-wine" : "rounded-xl bg-brass/10 p-3 text-sm text-ink"}
    >
      {children}
    </p>
  );
}
