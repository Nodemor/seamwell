# 03 · Design system, animation & UI libraries

## Brand (sample — replace with the shop's)
- **Name:** Seamwell Tailoring · **Tagline:** "Tailored to you. Seen on you first."
- **Logo:** monogram "S" in a midnight circle with a brass stitched ring and needle (`components/brand/Logo.tsx`, `public/brand/seamwell-logo.svg`, favicon `app/icon.svg`).
- **Voice:** warm, confident, simple English. Short sentences. Talk about fit, fabric and care.

## Colour palette (light, elegant, high contrast)
| Token | Hex | Use |
|---|---|---|
| `ivory` | `#FAF7F2` | page background |
| `paper` | `#FFFFFF` | cards, inputs |
| `linen` | `#F1EBE1` | soft sections, image backgrounds |
| `ink` | `#1B1A18` | main text (contrast 16:1 on ivory) |
| `stone` | `#6F6A61` | secondary text (5.1:1 on ivory) |
| `line` | `#E5DDD0` | borders, dividers |
| `midnight` | `#1F2A44` | **primary** — buttons, dark bands, footer |
| `midnight-2` | `#2C3B5E` | primary hover |
| `brass` | `#B08D57` | **accent** — eyebrows, highlights, try-on ring, stars |
| `brass-soft` | `#E9DCC4` | accent tint |
| `brass-ink` | `#7D602D` | brass for **small text on light surfaces** (eyebrows, logo sub-line) — `brass` itself is only 2.9:1 on ivory |
| `wine` | `#7A2E3A` | sale badges, errors |
| `sage` | `#4F6B57` | success, "in stock" |

Rules: one accent (brass) per view; dark components (midnight) sit on light pages; **no dark mode**. The same colours are exposed as shadcn variables (`bg-primary`, `text-muted-foreground`, `border-border`, …) so React Bits / 21st.dev / shadcn components match automatically.

## Typography
- Display: **Cormorant Garamond** 500/600 (+ italic for emphasis words) — headings, prices on hero cards.
- Body/UI: **Inter Variable**.
- Scale: hero `clamp(2.9rem, 7vw, 5.6rem)`, section titles `clamp(2.2rem, 4.5vw, 3.6rem)`, body 15–17 px, eyebrow 0.72 rem uppercase tracking 0.22em brass.
- Fonts are self-hosted via `@fontsource` (no Google requests → faster, private, CSP-friendly).

## Layout
- Container: `.container-sw` (max 1320 px, fluid side padding).
- Radius: 14 px base (`--radius`), cards `rounded-[var(--radius-xl)]`, pills `rounded-full`.
- Breakpoints to check every time: **375, 768, 1024, 1440 px**. Touch targets ≥ 44 px.
- Texture: `.pinstripe` (suit-fabric stripes) on hero/CTA backgrounds.

## Motion system (GSAP)
- Import from `@/lib/gsap` (registers ScrollTrigger, SplitText, DrawSVG, useGSAP once).
- Always: `useGSAP(() => { gsap.matchMedia().add(MOTION_OK, () => { … }) }, { scope: ref })` → automatic cleanup + **reduced-motion visitors get static pages**.
- Easing: `power3.out` / `power4.out` for entrances, `expo.out` for big reveals, `sine.inOut` for loops, `elastic.out(1,0.4)` for magnetic hovers. Durations 0.6–1.1 s; stagger 0.04–0.12 s.
- `data-reveal="up|fade|scale|left|right"` on any block → revealed on scroll by `MotionProvider` (hidden pre-paint only when JS + motion are allowed, with a safety timeout).
- `data-hero` → hidden pre-paint, revealed by the hero timeline.

**Built examples to copy from**
| Effect | File |
|---|---|
| SplitText line-masked headline reveal | `home/Hero.tsx` |
| DrawSVG "stitching" an SVG blazer + scan line loop | `home/Hero.tsx` |
| Pointer parallax with `quickTo` + `data-depth` | `home/Hero.tsx` |
| Magnetic button + conic ring + shimmer + live dot | `tryon/TryOnButton.tsx` |
| Scroll-velocity marquee (speed & direction follow scroll) | `home/Marquee.tsx` |
| Pinned scroll story with progress line & cross-fading screens | `home/TryOnSteps.tsx` |
| Scrubbed word-by-word text reveal + count-up stats | `home/CraftStory.tsx` |
| Global batched scroll reveals | `motion/MotionProvider.tsx` |

**Pitfalls (learned while building this)**
- ⚠️ Don't put Tailwind `transition` / `transition-all` / hover `transform` on an element GSAP animates — the CSS transition fights GSAP and the element can stay invisible. Use `transition-colors` or `transition-[border-color,background-color]`, or put `data-reveal` on a wrapper.
- Use `gsap.set(..., { autoAlpha: 1 })` *before* `from()` tweens on elements hidden by CSS.
- Pinned sections add scroll space (`end: "+=200%"`) — that's expected.
- Call `ScrollTrigger.refresh()` after images/fonts change layout.

## UI component sources (free)
Install from inside `apps/web` (it already has `components.json`, `@/lib/utils` `cn()`, and shadcn colour variables).

| Source | How to install | Good picks for this shop |
|---|---|---|
| **React Bits** — reactbits.dev | `npx shadcn@latest add @react-bits/<Name>-TS-TW` (TypeScript + Tailwind variant) or copy from the component's Code tab | `SplitText`, `BlurText`, `ScrollReveal`, `ScrollFloat`, `Magnet`, `ClickSpark`, `SpotlightCard`, `TiltedCard`, `CircularGallery`, `InfiniteScroll`, `Dock` (mobile actions), `Stepper` (checkout) |
| **21st.dev** | Component page → copy the shadcn/`npx 21st add` command, or **Copy prompt** → paste into Claude Code | hero variants, pricing/feature cards, testimonials, product galleries, animated tabs, toasts |
| **shadcn/ui** | `npx shadcn@latest add button input label dialog sheet sonner select tabs accordion` | forms, dialogs, mobile cart sheet, toasts, size-guide accordion |
| **ThreeUI** — threeui.com | copy components; check each one's licence and dependencies first | 3D/visual accents — use sparingly (performance on mid-range phones) |
| **Layers templates** — getlayers.ai/templates | layout inspiration; recreate sections with our tokens | section structure ideas |
| **SuperDesign** — superdesign.dev | AI design agent: generate screen ideas → hand the result to Claude Code | admin dashboard, account pages |

Rules when adding components: restyle with brand tokens, keep **GSAP as the main animation library** (ask before adding `motion`/framer-motion), remove unused variants, check licence, keep accessibility (focus, aria, reduced motion).

## Inspiration (look at structure & motion, don't copy assets)
- Try-on flow: trytheclothes.com, fitroom.app, lookora.app
- Motion ideas: gsap.com/showcase, reactbits.dev demos
- Premium tailoring tone: generous white space, editorial serif headings, real fabric close-ups, model + flat-lay product shots on white

## Product photography (for real launch)
- Product grid: model or ghost-mannequin photo, 4:5, warm light.
- **Try-on garment photo** (separate field): front view, garment only, **white background**, no folds, 1024 px+, JPEG. Full suits as one "kit" image give the best try-on results.

## Hero looks (home page)
- `components/home/Hero.tsx` rotates three looks every 7 s, looping: **Suit** (ivory + pinstripe) → **Nilame** (Kandyan red) → **Kurta** (royal blue). Only the hero recolours, via CSS variables set by `[data-hero-look]` in `globals.css` (`--hero-ink`, `--hero-muted`, `--hero-em`, `--hero-accent`, …).
- Decorations are original SVG (no copied artwork): `hero/KandyanDecor.tsx` (walakulu bamma border, lotus medallion, flower roundel) and `hero/FestiveDecor.tsx` (marigold toran, rangoli, Deepavali diyas over a kolam line, mehendi paisleys). Each draws in with GSAP only while its look is active.
- Garments: `/hero/suit.webp` (+ `HeroSuit3D`), `/hero/nilame.webp`, `/hero/kurta.webp` (transparent cut-outs). The suit stays the LCP image; the other two load ~1 s after first paint.
- Accessibility: look buttons with a 7 s progress line + a pause button (WCAG 2.2.2); hovering/focusing the controls pauses. Reduced motion: no auto-rotation, no animation; the buttons switch instantly.
- Don't DrawSVG a dotted stroke (`stroke-dasharray` dots) — DrawSVG replaces the dash pattern; fade those in instead.

## Phase 8 additions
- **Page transitions:** `app/template.tsx` fades each new route in (opacity only — a transform would break the lookbook's pin and sticky bars). The first page load is never faded (keeps LCP fast). Reduced motion: none.
- **ScrollSmoother: evaluated, not used.** It wraps the page in its own scroller, which breaks the sticky navbar / sticky try-on and bag bars, fights the lookbook pin and hero scroll scenes, and adds per-frame work that costs mobile performance. Native scrolling + ScrollTrigger scrub gives the same feel.
- **Lookbook** (`home/Lookbook.tsx`): pinned horizontal scroll on desktop with a fine pointer (ScrollTrigger pin + `containerAnimation`); a swipeable scroll-snap row on touch and for reduced motion. Cards are `relative` so their `sr-only` labels can't widen the page.
- **Testimonials** (`home/Testimonials.tsx`): real approved 4–5★ reviews only (`GET /api/reviews/recent`), de-duplicated, hidden with fewer than 3 — never invented quotes. Pause button + hover/focus pause.
- **Cursor** (`motion/CursorDot.tsx`): brass dot + ring on desktop mice only; the system cursor stays.
- **Contact links:** only from `lib/site.ts` (NEXT_PUBLIC_SHOP_*), external links always `rel="noopener noreferrer"`.
- **Content pages** use `layout/ContentPage.tsx` + `.sw-prose` (globals.css).
- **Performance (Phase 8):** each hero look's artwork + photo is built only shortly before it shows (and its code is split with `next/dynamic`); the suit's circling words are visible from the first paint (not hidden pre-paint), so the largest element doesn't wait for JS; the search dialog and bag sheet load on first use (with focus returned explicitly on close); `formatLKR` comes from the zod-free `@seamwell/shared/format` entry — importing the main `@seamwell/shared` entry in a component used on every page would ship zod + every schema to every visitor.
- **Lighthouse (mobile, simulated slow 4G, Nov 2026):** home 85–86 · contact 89 · product 87 · sizes 88 · shop 75–80 (waits on the product API); accessibility, best practices and SEO 100 everywhere. The remaining gap to 90 is the shared framework baseline (~300 KB JS: React/Next, GSAP, Radix) that every page loads.
