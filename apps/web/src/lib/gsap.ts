"use client";
/**
 * Single place to register GSAP plugins (all GSAP plugins are free, including SplitText & DrawSVG).
 * Import gsap from HERE in components so plugins are always registered once.
 */
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });
}

/** Run animations only when the visitor hasn't asked for reduced motion. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export { DrawSVGPlugin, gsap, ScrollTrigger, SplitText, useGSAP };
