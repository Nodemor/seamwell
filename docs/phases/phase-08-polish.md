# Phase 8 · Animations, content & accessibility polish

**Goal:** the "wow" pass — refined motion, real content pages, perfect responsiveness and accessibility.
**Read first:** `docs/03-design-system.md` (motion system, pitfalls, component sources).

## Prompt to paste into Claude Code
```
Phase 8 (polish) of Seamwell. Read CLAUDE.md and docs/03-design-system.md. Use /ui-polish on each page.

- Page transitions: a subtle GSAP fade/slide between routes (template.tsx), no layout shift.
- Smooth scrolling: evaluate GSAP ScrollSmoother on the home page only (desktop), disabled on touch + reduced motion. Keep ScrollTrigger pins working.
- Home: add a "Lookbook" horizontal-scroll section (pinned, ScrollTrigger containerAnimation) with outfit cards; testimonials marquee (React Bits InfiniteScroll or our Marquee pattern); a "Book a fitting" band with WhatsApp/phone links.
- Custom cursor on desktop only (small brass dot that grows over links, hidden on touch).
- Product imagery is real photos only (GarmentArt drawings were removed); add blur placeholders to next/image and real photos for any product still showing the "photo coming soon" tile.
- Content pages: /help/delivery (districts, fees, times, COD & bank transfer explained), /help/sizes (jacket/shirt/trouser charts + how to measure with SVG diagrams), /help/returns (free alterations, returns), /privacy (incl. Virtual Try-On processing by Hugging Face/FASHN), /terms, /about (atelier story), /contact (map link, hours, WhatsApp).
- 404 and error.tsx pages in brand style; loading.tsx skeletons for shop/product.
- Accessibility audit: headings order, landmarks, focus order, colour contrast, alt texts, form errors announced, motion respects prefers-reduced-motion.
- Performance: Lighthouse mobile ≥ 90 performance on home; lazy-load below-the-fold sections; check GSAP is only imported in client components.
Check every page at 375 / 768 / 1024 / 1440 px.
```

## Acceptance criteria
- [ ] Lighthouse mobile: Performance ≥ 90 (home), Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95
- [ ] No horizontal scroll at 375 px on any page
- [ ] With reduced motion on, every page is complete and readable without animation

## Security checklist
- [ ] External links `rel="noopener noreferrer"`; WhatsApp/phone links built from config, not user input
