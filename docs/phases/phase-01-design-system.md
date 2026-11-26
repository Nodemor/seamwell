# Phase 1 · Design system & UI kit

**Goal:** a small, consistent set of reusable UI components in the brand style, so every later page is fast to build.
**Read first:** `CLAUDE.md`, `docs/03-design-system.md`, `apps/web/src/app/globals.css`, `components/tryon/TryOnButton.tsx`.

## Prompt to paste into Claude Code
```
We're doing Phase 1 (design system & UI kit) of the Seamwell project. Read CLAUDE.md and docs/03-design-system.md first.

In apps/web:
1. Install shadcn/ui primitives with the existing components.json:
   npx shadcn@latest add button input label textarea select dialog sheet sonner tabs accordion badge skeleton
   Restyle them to our tokens (midnight primary, brass accent, ivory/paper surfaces, rounded-full buttons, 14px radius inputs). No dark-mode classes.
2. Create components/ui/Price.tsx (LKR formatting, sale price), components/ui/SectionHeading.tsx (eyebrow + serif title + optional link), components/ui/EmptyState.tsx, components/ui/FormField.tsx (label, input, error text, aria-describedby).
3. Replace hand-written buttons/inputs in cart, checkout, track-order and try-on pages with these components. Keep behaviour identical.
4. Add a Sonner toaster in layout.tsx and show a toast when something is added to the bag.
5. Add a mobile "bag" Sheet: clicking the bag icon on mobile opens a slide-in bag with checkout button (desktop keeps the /cart page).
6. Install two React Bits components and use them tastefully:
   npx shadcn@latest add @react-bits/SpotlightCard-TS-TW   → use on the 4 "Shop by piece" tiles
   npx shadcn@latest add @react-bits/ClickSpark-TS-TW      → brass sparks on the "Add to bag" button
   If an install name doesn't resolve, open the component page on reactbits.dev and use the command shown there. Prefer GSAP-based variants; ask me before adding framer-motion.
7. Create /styleguide (noindex) showing every component, colours and type scale.
Respect: reduced motion, focus states, 44px touch targets. Run typecheck + lint.
```

## Acceptance criteria
- [ ] `/styleguide` shows buttons (primary/secondary/ghost/destructive, sizes, loading), inputs with errors, dialog, sheet, toast, tabs, accordion, badges, skeletons
- [ ] Cart/checkout/track-order/try-on use the shared components; nothing visually broken at 375/768/1440 px
- [ ] Toast on add-to-bag; mobile bag sheet works with keyboard and screen reader (focus trap, Esc closes)
- [ ] No Tailwind `transition` on GSAP-animated elements
- [ ] typecheck + lint + tests pass

## Security checklist
- [ ] No `dangerouslySetInnerHTML` introduced
- [ ] `/styleguide` has `robots: { index: false }` metadata
