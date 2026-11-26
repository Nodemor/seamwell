"use client";

import { usePathname } from "next/navigation";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "@/lib/gsap";

/**
 * Site-wide scroll reveals. Add `data-reveal` to any element and it fades/slides in
 * when it scrolls into view. Variants: data-reveal="up" (default) | "fade" | "scale" | "left" | "right".
 * Elements are hidden by CSS only when JS + motion are allowed (see layout.tsx + globals.css),
 * so content is never lost for no-JS or reduced-motion visitors.
 */
export function MotionProvider() {
  const pathname = usePathname();

  useGSAP(
    () => {
      (window as unknown as { __swMotion?: boolean }).__swMotion = true;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const from: Record<string, gsap.TweenVars> = {
          up: { y: 48 },
          fade: {},
          scale: { scale: 0.94 },
          left: { x: -56 },
          right: { x: 56 },
        };
        const seen = new WeakSet<Element>();
        const triggers: ScrollTrigger[] = [];

        // Register any [data-reveal] element not handled yet (initial page + content added later,
        // e.g. shop filter results or "Load more" — those arrive without a route change).
        const register = () => {
          const fresh = gsap.utils.toArray<HTMLElement>("[data-reveal]").filter((el) => !seen.has(el));
          if (!fresh.length) return;
          fresh.forEach((el) => seen.add(el));
          triggers.push(
            ...ScrollTrigger.batch(fresh, {
              start: "top 88%",
              once: true,
              onEnter: (els) => {
                els.forEach((el, i) => {
                  const v = (el as HTMLElement).dataset.reveal || "up";
                  gsap.fromTo(el, { autoAlpha: 0, ...(from[v] ?? from.up) }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 1, delay: i * 0.08, ease: "power3.out", overwrite: true });
                });
              },
            }),
          );
          ScrollTrigger.refresh();
        };
        register();

        let raf = 0;
        const observer = new MutationObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(register);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        requestAnimationFrame(() => ScrollTrigger.refresh());

        return () => {
          observer.disconnect();
          cancelAnimationFrame(raf);
          triggers.forEach((t) => t.kill());
        };
      });
      return () => mm.revert();
    },
    { dependencies: [pathname], revertOnUpdate: true },
  );

  return null;
}

/** Inline (pre-paint) script: enables the hide-until-revealed CSS, with a safety timeout. */
export const motionBootScript = `(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document.documentElement;d.classList.add('js-motion');setTimeout(function(){if(!window.__swMotion)d.classList.remove('js-motion')},3500)}catch(e){}})();`;
