"use client";

import Image from "next/image";
import { useId, useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

/** Silhouette "slabs" stacked behind the photo → a visible edge (thickness) when the suit turns. */
const DEPTH_SLABS = [3, 6, 9, 12, 15, 18];

/** Words on the halo ring (repeated to fill the circle; textLength spreads them evenly). */
const HALO_TEXT = "TAILORED TO YOU ✦ SEEN ON YOU FIRST ✦ COLOMBO ATELIER ✦ VIRTUAL TRY-ON ✦ ";
const HALO_CIRCUMFERENCE = Math.round(2 * Math.PI * 170);

/**
 * Hero suit with a 2.5D / 3D look, built from one transparent photo + GSAP (no WebGL, no extra deps).
 *
 * Nesting — each layer is driven by exactly ONE animation so tweens never fight:
 *   [data-hero] perspective  →  scene (scroll scrub)  →  intro (turntable entrance)
 *   →  float (idle drift)  →  tilt (pointer, desktop)  →  photo + light/scan/edge layers; a flat halo (rings + circling words) sits behind
 *
 * Reduced motion: none of this runs; the photo and halo are shown statically.
 */
export function HeroSuit3D() {
  const root = useRef<HTMLDivElement>(null);
  const haloPathId = `halo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        // Un-hide our [data-hero] wrapper FIRST (hidden pre-paint by .js-motion). Child effects run before the
        // parent Hero's, and GSAP would otherwise read inherited visibility:hidden as autoAlpha 0 for start values.
        // The circle of words is NOT hidden pre-paint: it's the page's largest element, so showing it with the HTML
        // (no JS needed) keeps LCP fast on slow phones. Everything else here waits for the intro.
        gsap.set("[data-hero]", { autoAlpha: 1 });

        // ── Entrance: halo rings draw themselves, the words fade in, suit swings round on a turntable ──
        const tl = gsap.timeline({ delay: 0.25, defaults: { ease: "power3.out" } });
        tl.from("[data-halo-ring]", { drawSVG: "0%", duration: 1.6, stagger: 0.15, ease: "power2.inOut" })
          .from("[data-suit-glow]", { autoAlpha: 0, scale: 0.6, duration: 1.4 }, 0.2)
          .from("[data-suit-shadow]", { autoAlpha: 0, scaleX: 0.3, duration: 1.2 }, 0.45)
          .from(
            "[data-suit-intro]",
            { rotationY: -78, rotationX: 6, y: 70, z: -220, autoAlpha: 0, duration: 2, ease: "expo.out" },
            0.35,
          )
          // A band of light sweeps across the cloth once it faces us
          .fromTo("[data-suit-sweep]", { xPercent: -120, autoAlpha: 1 }, { xPercent: 320, duration: 1.4, ease: "power2.inOut" }, 1.35)
          .to("[data-suit-sweep]", { autoAlpha: 0, duration: 0.2 });

        // ── Halo: the ring of words turns slowly, forever ──
        gsap.to("[data-halo-text]", { rotation: 360, svgOrigin: "200 200", duration: 48, ease: "none", repeat: -1 });

        // ── AI scan line: passes down the jacket every few seconds (masked to the suit) ──
        gsap.fromTo(
          "[data-suit-scan]",
          { yPercent: -10, autoAlpha: 0 },
          {
            keyframes: [
              { autoAlpha: 1, duration: 0.3 },
              { yPercent: 1000, duration: 2.6, ease: "sine.inOut" },
              { autoAlpha: 0, duration: 0.3 },
            ],
            repeat: -1,
            repeatDelay: 3.2,
            delay: 3,
          },
        );

        // ── Idle: the suit breathes — slow float + slight turn ──
        gsap.to("[data-suit-float]", { y: -12, rotationY: 5, rotationX: -1.5, duration: 4.2, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 2.4 });
        gsap.to("[data-suit-shadow]", { scaleX: 0.88, autoAlpha: 0.75, duration: 4.2, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 2.4 });

        // ── Scroll: the suit turns away and lifts as you leave the hero; the halo widens and fades behind it ──
        // The hero section is OUTSIDE this component's scope, so pass the element (a scoped selector wouldn't find it)
        const st = { trigger: root.current!.closest("[data-hero-section]") ?? root.current, start: "top top", end: "bottom top", scrub: 0.6 };
        gsap.to("[data-suit-scene]", { rotationY: -24, rotationX: 7, yPercent: -9, scale: 0.9, ease: "none", scrollTrigger: st });
        gsap.to("[data-suit-halo]", { scale: 1.12, yPercent: -4, autoAlpha: 0.35, ease: "none", scrollTrigger: st });
        gsap.to("[data-suit-shadow]", { yPercent: -60, ease: "none", scrollTrigger: st });
      });

      // ── Pointer: real-time 3D tilt + a light that follows the cursor (desktop with a mouse) ──
      mm.add(`${MOTION_OK} and (pointer: fine) and (min-width: 1024px)`, () => {
        const tilt = root.current!.querySelector<HTMLElement>("[data-suit-tilt]")!;
        const light = root.current!.querySelector<HTMLElement>("[data-suit-light]")!;
        const shade = root.current!.querySelector<HTMLElement>("[data-suit-shade]")!;
        const rotY = gsap.quickTo(tilt, "rotationY", { duration: 1.1, ease: "power3.out" });
        const rotX = gsap.quickTo(tilt, "rotationX", { duration: 1.1, ease: "power3.out" });
        const lx = gsap.quickTo(light, "xPercent", { duration: 0.9, ease: "power3.out" });
        const ly = gsap.quickTo(light, "yPercent", { duration: 0.9, ease: "power3.out" });
        const sx = gsap.quickTo(shade, "xPercent", { duration: 0.9, ease: "power3.out" });
        const sy = gsap.quickTo(shade, "yPercent", { duration: 0.9, ease: "power3.out" });

        const onMove = (e: PointerEvent) => {
          const nx = (e.clientX / window.innerWidth) * 2 - 1; // -1 … 1
          const ny = (e.clientY / window.innerHeight) * 2 - 1;
          rotY(nx * 16);
          rotX(-ny * 9);
          lx(nx * 28);
          ly(ny * 22);
          sx(-nx * 28);
          sy(-ny * 22);
        };
        const onLeave = () => {
          rotY(0);
          rotX(0);
          lx(0);
          ly(0);
          sx(0);
          sy(0);
        };
        window.addEventListener("pointermove", onMove);
        document.documentElement.addEventListener("pointerleave", onLeave);
        return () => {
          window.removeEventListener("pointermove", onMove);
          document.documentElement.removeEventListener("pointerleave", onLeave);
        };
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative mx-auto w-full max-w-[380px] [perspective:1600px] sm:max-w-[430px] lg:max-w-[500px]">
      {/* Flat backdrop (halo, glow, floor shadow). Kept OUT of the 3D scene so the turning suit never intersects it. */}
      {/* Halo: a soft disc of light, thin brass rings and a ring of words circling slowly behind the suit */}
      <div data-suit-halo className="pointer-events-none absolute left-1/2 top-[45%] aspect-square w-[122%] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <div data-hero data-suit-glow className="absolute inset-[9%] rounded-full bg-[radial-gradient(closest-side,rgb(233_220_196/.95),rgb(241_235_225/.55)_62%,rgb(241_235_225/0))]" />
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <path id={haloPathId} d="M200,200 m-170,0 a170,170 0 1,1 340,0 a170,170 0 1,1 -340,0" />
          </defs>
          <circle data-hero data-halo-ring cx="200" cy="200" r="190" fill="none" stroke="var(--sw-brass)" strokeOpacity=".55" strokeWidth="1" />
          <circle data-hero data-halo-ring cx="200" cy="200" r="150" fill="none" stroke="var(--sw-brass)" strokeOpacity=".28" strokeWidth="1" strokeDasharray="2 6" />
          <g data-halo-text>
            <text fill="var(--sw-brass-ink)" fontSize="12.5" fontWeight="600" letterSpacing="4.2" style={{ fontFamily: "var(--font-sans)" }}>
              <textPath href={`#${haloPathId}`} textLength={HALO_CIRCUMFERENCE} lengthAdjust="spacing">
                {HALO_TEXT}
              </textPath>
            </text>
          </g>
        </svg>
      </div>

      {/* Contact shadow on the "floor" */}
      <div data-hero data-suit-shadow className="pointer-events-none absolute bottom-[1%] left-1/2 h-7 w-[64%] -translate-x-1/2 rounded-[50%] bg-midnight/30 blur-xl" aria-hidden />

      <div data-hero data-suit-scene className="relative [transform-style:preserve-3d]">
        <div data-suit-intro className="relative [transform-style:preserve-3d]">
          <div data-suit-float className="relative [transform-style:preserve-3d]">
            <div data-suit-tilt className="relative px-[4%] pt-[2%] pb-[7%] [transform-style:preserve-3d]">
              <div className="relative [transform-style:preserve-3d]">
                {/* Thickness: dark silhouettes stacked behind the photo */}
                {DEPTH_SLABS.map((z, i) => (
                  <span
                    key={z}
                    aria-hidden
                    className="sw-suit-mask absolute inset-0"
                    style={{ transform: `translateZ(${-z}px)`, background: i < 2 ? "#141b2e" : "#0b1020", opacity: 1 - i * 0.08 }}
                  />
                ))}

                <Image
                  src="/hero/suit.webp"
                  width={1191}
                  height={1600}
                  priority
                  sizes="(min-width: 1024px) 480px, (min-width: 640px) 410px, 360px"
                  alt="Navy two-button suit jacket with a white shirt and dotted navy tie on a tailor's mannequin"
                  className="relative block h-auto w-full select-none drop-shadow-[0_30px_40px_rgb(31_42_68/0.28)]"
                  draggable={false}
                />

                {/* Lighting, clipped to the suit: highlight follows the cursor, shade sits opposite */}
                <div className="sw-suit-mask pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                  <div className="absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/.10)_0%,rgb(255_255_255/0)_38%,rgb(8_12_24/0)_62%,rgb(8_12_24/.22)_100%)]" />
                  <div data-suit-light className="absolute left-[5%] top-[2%] h-[70%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/.22),rgb(255_255_255/0))]" />
                  <div data-suit-shade className="absolute bottom-[0%] right-[0%] h-[75%] w-[75%] rounded-full bg-[radial-gradient(closest-side,rgb(6_9_20/.28),rgb(6_9_20/0))]" />
                  <div data-suit-sweep className="invisible absolute inset-y-0 left-0 w-[45%] -skew-x-12 bg-[linear-gradient(90deg,rgb(233_220_196/0),rgb(233_220_196/.42),rgb(233_220_196/0))]" />
                  <div data-suit-scan className="invisible absolute inset-x-0 top-0 h-[9%]">
                    <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-[linear-gradient(90deg,rgb(176_141_87/0),rgb(233_220_196/1),rgb(176_141_87/0))]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(176_141_87/0),rgb(176_141_87/.25),rgb(176_141_87/0))]" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
