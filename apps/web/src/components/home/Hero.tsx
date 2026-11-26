"use client";

import { ArrowRight, Check, Pause, Play, Star } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Magnet from "@/components/bits/Magnet";
import ShinyText from "@/components/bits/ShinyText";
import { HeroSuit3D } from "@/components/home/HeroSuit3D";
import { TryOnButton } from "@/components/tryon/TryOnButton";
import { gsap, MOTION_OK, SplitText, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

// The Nilame / kurta artwork and garment panels are only built seconds after load (see `mounted`), so their code is
// split out of the first-load bundle too. (ssr: false — they're never part of the server-rendered first view.)
const HeroGarment = dynamic(() => import("@/components/home/hero/HeroGarment").then((m) => m.HeroGarment), { ssr: false });
const KandyanBorder = dynamic(() => import("@/components/home/hero/KandyanDecor").then((m) => m.KandyanBorder), { ssr: false });
const KandyanRoundel = dynamic(() => import("@/components/home/hero/KandyanDecor").then((m) => m.KandyanRoundel), { ssr: false });
const DiyaRow = dynamic(() => import("@/components/home/hero/FestiveDecor").then((m) => m.DiyaRow), { ssr: false });
const MehendiPaisley = dynamic(() => import("@/components/home/hero/FestiveDecor").then((m) => m.MehendiPaisley), { ssr: false });

/** Seconds each look stays before the hero moves to the next one. */
const LOOK_SECONDS = 7;

const LOOKS = [
  {
    id: "suit",
    label: "Suits",
    eyebrow: "Colombo atelier · Since 1998",
    shine: { color: "#7D602D", shineColor: "#C9A66B" },
    copy: "Suits, blazers, shirts and trousers cut with care — and with our free Virtual Try-On you can see the whole look on yourself before you order.",
    cta: { href: "/shop", label: "Shop the collection" },
  },
  {
    id: "nilame",
    label: "Nilame",
    eyebrow: "Kandyan wedding attire",
    shine: { color: "#F2C25B", shineColor: "#FFF1C9" },
    copy: "Hand-embroidered Nilame kits in velvet and gold zari — jacket, pleated wrap and toppi, fitted for your Poruwa ceremony. See the whole kit on yourself first.",
    cta: { href: "/shop?category=nilame", label: "Shop Nilame kits" },
  },
  {
    id: "kurta",
    label: "Kurta",
    eyebrow: "Weddings · Mehendi · Deepavali",
    shine: { color: "#FFB347", shineColor: "#FFF0C2" },
    copy: "Embroidered kurta sets in silk and brocade for weddings, mehendi nights and Deepavali — try the full look on yourself before you order.",
    cta: { href: "/shop?category=kurtas", label: "Shop kurtas" },
  },
] as const;

/**
 * Hero: SplitText headline reveal, animated try-on button, React Bits Magnet CTA — and three rotating looks
 * (suit → Red Nilame → Blue Kurta, every 7 s, looping). Each look recolours the hero (background, text, accents
 * via CSS variables set by [data-hero-look] in globals.css) and brings its own decorations: ivory pinstripe for the
 * suit, a Kandyan walakulu bamma border and lotus for the Nilame, a toran, rangoli, diyas and mehendi for the kurta.
 *
 * Accessibility: look buttons + a pause button (WCAG 2.2.2); hovering or focusing the controls pauses too.
 * Reduced motion: no automatic changes and no animation — the buttons switch looks instantly.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  /** Which looks are built. Only the suit at first — each look's artwork (hundreds of SVG shapes + its photo) is
   *  added shortly before it's shown, keeping the first load light. */
  const [mounted, setMounted] = useState<boolean[]>(() => LOOKS.map((_, i) => i === 0));
  const mount = (i: number) => setMounted((m) => (m[i] ? m : m.map((v, j) => v || j === i)));
  const reduced = useReducedMotion();
  const timer = useRef<gsap.core.Tween | null>(null);
  const firstLook = useRef(true);
  const look = LOOKS[active]!;


  // ── Intro: headline reveal (unchanged) ──
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.set("[data-hero]", { autoAlpha: 1 }); // un-hide (hidden pre-paint by .js-motion CSS)
        const split = SplitText.create("[data-hero-title]", { type: "lines,words", mask: "lines", linesClass: "pb-1" });
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

        tl.from("[data-hero-eyebrow]", { y: 16, autoAlpha: 0, duration: 0.7 })
          .from(split.words, { yPercent: 115, duration: 1.1, stagger: 0.045 }, "-=0.35")
          .from("[data-hero-copy]", { y: 20, autoAlpha: 0, duration: 0.8 }, "-=0.7")
          .from("[data-hero-cta] > *", { y: 22, autoAlpha: 0, stagger: 0.12, duration: 0.8 }, "-=0.55")
          .from("[data-hero-trust] > *, [data-hero-controls]", { y: 12, autoAlpha: 0, stagger: 0.08, duration: 0.6 }, "-=0.5");

        // Scroll: the copy drifts up and fades as you leave the hero (the suit has its own scroll scene)
        gsap.to("[data-hero-text]", { yPercent: -12, autoAlpha: 0.2, ease: "none", scrollTrigger: { trigger: root.current, start: "35% top", end: "bottom top", scrub: true } });

        return () => split.revert();
      });
    },
    { scope: root },
  );

  // ── The 7-second timer: fills the active look's progress line, then moves on. Rebuilt for every look. ──
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        timer.current = gsap.fromTo(
          `[data-look-progress="${active}"]`,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: LOOK_SECONDS,
            ease: "none",
            // ~4 s in, build the next look so it's ready (photo loaded, artwork in place) when the change comes
            onUpdate() {
              if (this.progress() > 0.55) mount((active + 1) % LOOKS.length);
            },
            onComplete: () => setActive((a) => (a + 1) % LOOKS.length),
          },
        );
        return () => {
          timer.current = null;
        };
      });
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );

  // Pause while the visitor asked to, or is hovering / focusing the look controls. (A hidden tab pauses by itself.)
  useEffect(() => {
    timer.current?.paused(paused || holding);
  }, [paused, holding, active]);

  // ── Look change: the outgoing garment turns away, the new one swings in; the copy fades across ──
  useGSAP(
    () => {
      const panels = gsap.utils.toArray<HTMLElement>("[data-look-garment]");
      if (firstLook.current) {
        firstLook.current = false;
        // The suit has its own entrance; the others are hidden by CSS until active. An inline GSAP state on the
        // visible panel lets it fade OUT later (inline styles win over the CSS that hides inactive panels).
        gsap.matchMedia().add(MOTION_OK, () => void gsap.set(panels[active]!, { autoAlpha: 1 }));
        return;
      }
      gsap.matchMedia().add(MOTION_OK, () => {
        panels.forEach((el, i) => {
          if (i === active) {
            gsap.fromTo(el, { autoAlpha: 0, y: 36, rotationY: 26, scale: 0.94 }, { autoAlpha: 1, y: 0, rotationY: 0, scale: 1, duration: 1.2, delay: 0.25, ease: "expo.out", overwrite: true });
          } else {
            gsap.to(el, { autoAlpha: 0, y: -18, rotationY: -22, scale: 0.96, duration: 0.55, ease: "power2.in", overwrite: true });
          }
        });
        gsap.from("[data-look-text]", { y: 12, autoAlpha: 0, duration: 0.7, stagger: 0.08, ease: "power3.out", delay: 0.2 });
      });
    },
    { scope: root, dependencies: [active] },
  );

  const select = (i: number) => {
    mount(i);
    setActive(i);
  };

  return (
    <section ref={root} data-hero-section data-hero-look={look.id} className="relative overflow-hidden bg-ivory">
      {/* ── Backdrops (one per look, cross-faded with CSS opacity — GSAP only animates the decorations inside) ── */}
      <div aria-hidden className={cn("pinstripe absolute inset-0 bg-ivory transition-opacity duration-1000", active === 0 ? "opacity-100" : "opacity-0")} />

      <div aria-hidden className={cn("pointer-events-none absolute inset-0 transition-opacity duration-1000", active === 1 ? "opacity-100" : "opacity-0")}>
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_72%_42%,#8E2430_0%,#741A23_50%,#5A1119_100%)]" />
        {mounted[1] && (
          <>
            <KandyanRoundel active={active === 1} className="absolute right-[4%] top-[5%] hidden size-16 opacity-90 lg:block" />
            <KandyanBorder active={active === 1} className="absolute inset-x-0 bottom-0 h-[76px] sm:h-[96px] lg:h-[112px]" />
          </>
        )}
      </div>

      <div aria-hidden className={cn("pointer-events-none absolute inset-0 transition-opacity duration-1000", active === 2 ? "opacity-100" : "opacity-0")}>
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_72%_42%,#2B3A86_0%,#1A2357_52%,#10163A_100%)]" />
        {mounted[2] && (
          <>
        <MehendiPaisley active={active === 2} className="absolute right-[1%] bottom-[96px] hidden w-36 opacity-35 lg:bottom-[112px] lg:block lg:w-44" />
        <MehendiPaisley active={active === 2} className="absolute -right-4 top-2 hidden w-40 -scale-x-100 rotate-180 opacity-30 lg:block" />
        <DiyaRow active={active === 2} className="absolute inset-x-0 bottom-0 h-[72px] sm:h-[88px] lg:h-[104px]" />
          </>
        )}
      </div>

      <div className="container-sw relative grid items-center gap-10 pb-28 pt-6 sm:pb-32 md:pt-10 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-32 lg:pt-6">
        {/* Left: copy + animated try-on button */}
        <div data-hero-text className="relative z-10 max-w-xl">
          <p data-hero data-hero-eyebrow className="eyebrow">
            <span key={look.id} data-look-text className="inline-block">
              {/* React Bits ShinyText: a slow sheen in the look's accent (static for reduced-motion visitors) */}
              <ShinyText color={look.shine.color} shineColor={look.shine.shineColor} speed={2.6} delay={3.5} shineWidth={30}>
                {look.eyebrow}
              </ShinyText>
            </span>
          </p>
          <h1 data-hero data-hero-title className="mt-5 text-[clamp(2.9rem,7vw,5.6rem)] leading-[0.98] text-[color:var(--hero-ink)] transition-colors duration-700">
            Tailored to you.
            <br />
            <em className="text-[color:var(--hero-em)] transition-colors duration-700">Seen on you</em> first.
          </h1>
          <p data-hero data-hero-copy className="mt-6 min-h-[5.25em] max-w-md text-[1.05rem] leading-relaxed text-[color:var(--hero-muted)] transition-colors duration-700">
            <span key={look.id} data-look-text className="block">{look.copy}</span>
          </p>

          <div data-hero data-hero-cta className="mt-9 flex flex-wrap items-center gap-4">
            <TryOnButton />
            {/* React Bits Magnet: the button leans toward the cursor (mouse only, off for reduced motion) */}
            <Magnet padding={60} magnetStrength={4} maxOffset={14}>
              <Link
                href={look.cta.href}
                className="group inline-flex min-h-12 items-center gap-2 rounded-full border border-ink/15 bg-paper/80 px-6 py-3.5 text-[0.95rem] font-medium text-ink backdrop-blur transition-[border-color,background-color] duration-300 hover:border-ink/40 hover:bg-paper"
              >
                {look.cta.label}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>
            </Magnet>
          </div>

          <ul data-hero data-hero-trust className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[color:var(--hero-muted)] transition-colors duration-700">
            <li className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-brass text-brass" aria-hidden /> 4.9 from 1,200+ clients
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[color:var(--hero-accent)]" aria-hidden /> Free alterations
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[color:var(--hero-accent)]" aria-hidden /> Cash on delivery
            </li>
          </ul>

          {/* Look controls: pick a look, see the 7 s progress, pause. Hover/focus here pauses the loop. */}
          <div
            data-hero
            data-hero-controls
            className="mt-8 flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Featured looks"
            onPointerEnter={() => setHolding(true)}
            onPointerLeave={() => setHolding(false)}
            onFocus={() => setHolding(true)}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHolding(false)}
          >
            {LOOKS.map((l, i) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={i === active}
                onClick={() => select(i)}
                className={cn(
                  "relative h-11 overflow-hidden rounded-full border px-4 text-sm outline-none transition-colors duration-500 focus-visible:ring-4 focus-visible:ring-brass/45 sm:h-9",
                  i === active ? "border-[color:var(--hero-accent)] bg-[color:var(--hero-chip)] text-[color:var(--hero-ink)]" : "border-[color:var(--hero-line)] text-[color:var(--hero-muted)] hover:text-[color:var(--hero-ink)]",
                )}
              >
                <span className="sr-only">Show the </span>
                {l.label}
                <span className="sr-only"> look</span>
                {/* 7-second progress (GSAP scaleX; no CSS transition on this element) */}
                <span aria-hidden data-look-progress={i} className="absolute inset-x-3 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-[color:var(--hero-accent)]" />
              </button>
            ))}
            {!reduced && (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Play the looks" : "Pause the looks"}
                className="grid size-11 place-items-center rounded-full border border-[color:var(--hero-line)] text-[color:var(--hero-muted)] outline-none transition-colors duration-500 hover:text-[color:var(--hero-ink)] focus-visible:ring-4 focus-visible:ring-brass/45 sm:size-9"
              >
                {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              </button>
            )}
          </div>
        </div>

        {/* Right: one garment per look, stacked and cross-faded */}
        <div className="relative grid place-items-center [perspective:1600px] [&>*]:[grid-area:1/1]">
          <div data-look-garment data-active={active === 0 ? "" : undefined} aria-hidden={active !== 0} className="w-full">
            <HeroSuit3D />
          </div>
          <div data-look-garment data-active={active === 1 ? "" : undefined} aria-hidden={active !== 1} className="w-full">
            {mounted[1] && <HeroGarment look="nilame" active={active === 1} load src="/hero/nilame.webp" width={763} height={969} alt="Red velvet Nilame jacket with gold zari embroidery, frilled white shirt and jewelled toppi hat" />}
          </div>
          <div data-look-garment data-active={active === 2 ? "" : undefined} aria-hidden={active !== 2} className="w-full">
            {mounted[2] && <HeroGarment look="kurta" active={active === 2} load src="/hero/kurta.webp" width={746} height={921} alt="Navy silk kurta with gold paisley embroidery on the placket, collar and cuffs" />}
          </div>
        </div>
      </div>
    </section>
  );
}
