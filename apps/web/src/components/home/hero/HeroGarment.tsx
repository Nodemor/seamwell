"use client";

import Image from "next/image";
import { useRef } from "react";
import { Rangoli, Toran } from "@/components/home/hero/FestiveDecor";
import { LotusMedallion } from "@/components/home/hero/KandyanDecor";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

type Props = {
  look: "nilame" | "kurta";
  src: string;
  width: number;
  height: number;
  alt: string;
  active: boolean;
  /** Load the photo only once it's needed soon (keeps the suit the page's first, fastest image). */
  load: boolean;
};

/**
 * The garment for a traditional look: the cut-out photo floating in front of a Kandyan lotus medallion (Nilame)
 * or a rangoli under a marigold toran (kurta), with a warm glow and a floor shadow.
 */
export function HeroGarment({ look, src, width, height, alt, active, load }: Props) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!active) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.to("[data-g-float]", { y: -12, rotation: look === "nilame" ? 0.6 : -0.6, duration: 4.4, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 1.2 });
        gsap.to("[data-g-shadow]", { scaleX: 0.86, autoAlpha: 0.7, duration: 4.4, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 1.2 });
      });
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  );

  return (
    <div ref={root} className="relative mx-auto w-full max-w-[330px] sm:max-w-[390px] lg:max-w-[450px]">
      <div className="pointer-events-none absolute left-1/2 top-[47%] aspect-square w-[124%] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <div
          className="absolute inset-[12%] rounded-full"
          style={{
            background:
              look === "nilame"
                ? "radial-gradient(closest-side, rgb(242 194 91 / .30), rgb(242 194 91 / .08) 60%, rgb(242 194 91 / 0))"
                : "radial-gradient(closest-side, rgb(255 179 71 / .30), rgb(255 179 71 / .08) 60%, rgb(255 179 71 / 0))",
          }}
        />
        {look === "nilame" ? <LotusMedallion active={active} className="absolute inset-0 h-full w-full" /> : <Rangoli active={active} className="absolute inset-0 h-full w-full" />}
      </div>

      {look === "kurta" && <Toran active={active} className="absolute -top-[3%] left-1/2 z-10 w-[108%] -translate-x-1/2" />}

      <div data-g-shadow className="pointer-events-none absolute bottom-[2%] left-1/2 h-7 w-[58%] -translate-x-1/2 rounded-[50%] bg-black/40 blur-xl" aria-hidden />
      <div data-g-float className="relative px-[9%] pb-[8%] pt-[7%]">
        {load ? (
          <Image src={src} width={width} height={height} alt={alt} loading="eager" sizes="(min-width: 1024px) 400px, (min-width: 640px) 340px, 290px" className="relative block h-auto w-full select-none drop-shadow-[0_30px_40px_rgb(0_0_0/0.45)]" draggable={false} />
        ) : (
          <div style={{ aspectRatio: `${width} / ${height}` }} />
        )}
      </div>
    </div>
  );
}
