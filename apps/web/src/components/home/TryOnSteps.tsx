"use client";

import { Camera, Shirt, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import Image from "next/image";
import { TryOnButton } from "@/components/tryon/TryOnButton";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/** Outfit picker preview — real product photos; the blazer is the one tried on in the result. */
const OUTFIT = [
  { src: "/catalog/midnight-navy-blazer-1.webp", alt: "Midnight Navy Blazer" },
  { src: "/catalog/crisp-white-oxford-shirt.webp", alt: "Crisp White Oxford Shirt" },
  { src: "/catalog/stone-chinos.webp", alt: "Stone Chinos" },
  { src: "/catalog/black-tuxedo-three-piece.webp", alt: "Black Tuxedo Three-Piece" },
];

const STEPS = [
  { icon: Camera, title: "Upload a full-body photo", text: "Stand straight, face the camera, arms by your sides. Your photo stays in your browser." },
  { icon: Shirt, title: "Pick your outfit", text: "Choose a suit, or build the look: blazer, shirt and trousers. We'll ask what goes with your blazer." },
  { icon: Sparkles, title: "See it on you", text: "In about 25 seconds per piece, our AI dresses your photo in the outfit you picked." },
];

/** Pinned scroll story (desktop): the steps advance as you scroll. Stacked cards on mobile. */
export function TryOnSteps() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      gsap.matchMedia().add(`${MOTION_OK} and (min-width: 1024px)`, () => {
        const screens = gsap.utils.toArray<HTMLElement>("[data-screen]");
        gsap.set(screens.slice(1), { autoAlpha: 0, yPercent: 8 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: "[data-pin]",
            start: "top top",
            end: "+=200%",
            pin: true,
            scrub: 0.6,
            onUpdate: (self) => setActive(Math.min(2, Math.floor(self.progress * 3 * 0.999))),
          },
        });
        tl.to("[data-progress]", { scaleY: 1, ease: "none", duration: 2 }, 0)
          .to(screens[0]!, { autoAlpha: 0, yPercent: -8, duration: 0.3 }, 0.55)
          .to(screens[1]!, { autoAlpha: 1, yPercent: 0, duration: 0.3 }, 0.6)
          .to(screens[1]!, { autoAlpha: 0, yPercent: -8, duration: 0.3 }, 1.25)
          .to(screens[2]!, { autoAlpha: 1, yPercent: 0, duration: 0.3 }, 1.3);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative">
      <div data-pin className="container-sw grid items-center gap-12 py-24 lg:min-h-svh lg:grid-cols-2 lg:py-0">
        <div>
          <p className="eyebrow" data-reveal>Virtual Try-On</p>
          <h2 className="mt-3 text-[clamp(2.2rem,4.5vw,3.6rem)] leading-tight" data-reveal>
            See the suit on <em>you</em> — before it&apos;s yours.
          </h2>
          <ol className="relative mt-10 space-y-7 pl-8">
            <span aria-hidden className="absolute bottom-2 left-[11px] top-2 w-px bg-line" />
            <span aria-hidden data-progress className="absolute left-[11px] top-2 hidden h-[calc(100%-1rem)] w-px origin-top scale-y-0 bg-brass lg:block" />
            {STEPS.map((s, i) => (
              <li key={s.title} data-reveal className="relative">
                <span className={cn("absolute -left-8 top-0.5 grid h-6 w-6 place-items-center rounded-full border bg-ivory text-[0.7rem] font-semibold transition-colors duration-500", active >= i ? "border-brass text-brass-ink" : "border-line text-stone")}>
                  {i + 1}
                </span>
                {/* opacity lives on an inner element so it doesn't fight the GSAP reveal on the <li> */}
                <div className={cn("transition-opacity duration-500 lg:opacity-40", active === i && "lg:opacity-100")}>
                  <h3 className="flex items-center gap-2 font-sans text-lg font-medium text-ink">
                    <s.icon className="h-4.5 w-4.5 text-brass" aria-hidden /> {s.title}
                  </h3>
                  <p className="mt-1.5 max-w-md text-stone">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10" data-reveal>
            <TryOnButton label="Start your try-on" />
          </div>
        </div>

        {/* Visual: three "screens" that cross-fade as you scroll */}
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[440px]" data-reveal="scale">
          <div className="absolute inset-0 rounded-[2rem] bg-midnight shadow-[0_40px_80px_-40px_rgb(31_42_68/.7)]" />
          <div className="absolute inset-3 overflow-hidden rounded-[1.6rem] bg-ivory">
            <Screen index={0} label="Your photo">
              <Image src="/tryon/sample-model.jpg" alt="A customer's full-body photo, facing the camera" fill sizes="(min-width: 1024px) 420px, 90vw" className="object-cover object-top" />
              <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-brass/70" />
            </Screen>
            <Screen index={1} label="Your outfit">
              <div className="grid h-full grid-cols-2 gap-3 p-6 pt-14">
                {OUTFIT.map((o, i) => (
                  <div key={o.src} className={cn("relative overflow-hidden rounded-2xl border bg-paper", i < 1 ? "border-brass ring-2 ring-brass/30" : "border-line")}>
                    <Image src={o.src} alt={o.alt} fill sizes="200px" className="object-contain p-3" />
                  </div>
                ))}
              </div>
            </Screen>
            <Screen index={2} label="On you">
              {/* A real result from the free FASHN try-on model (sample model + Midnight Navy Blazer) */}
              <Image src="/tryon/demo-result.webp" alt="The same customer wearing the Midnight Navy Blazer, generated by the virtual try-on" fill sizes="(min-width: 1024px) 420px, 90vw" className="object-cover object-top" />
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-midnight px-4 py-2 text-xs text-ivory">✦ Midnight Navy Blazer · Size 40</span>
            </Screen>
          </div>
        </div>
      </div>
    </section>
  );
}

function Screen({ index, label, children }: { index: number; label: string; children: React.ReactNode }) {
  return (
    <div data-screen className={cn("absolute inset-0", index > 0 && "max-lg:hidden")}>
      <span className="absolute left-5 top-5 z-10 rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink shadow-sm">{label}</span>
      {children}
    </div>
  );
}
