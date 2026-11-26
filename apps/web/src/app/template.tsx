"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

/** The very first page load is never faded (keeps LCP fast); only later route changes are. */
let firstPaint = true;

/**
 * Page transition: Next re-mounts this template on every navigation, so each new page fades in softly.
 * Opacity only — a transform here would break position:fixed pins (the lookbook) and sticky bars underneath.
 * Reduced motion: no fade.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (firstPaint) {
        firstPaint = false;
        return;
      }
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out", clearProps: "opacity" });
      });
    },
    { scope: root },
  );
  return <div ref={root}>{children}</div>;
}
