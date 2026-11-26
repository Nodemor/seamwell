# Phase 2 · Catalogue polish

**Goal:** a shop that's pleasant to browse on a phone: filters, search, sorting, pagination, a real product gallery, related products and SEO.
**Read first:** `docs/05-api.md` (products), `apps/api/src/modules/products/products.routes.ts`, `apps/web/src/app/shop/page.tsx`, `app/product/[slug]/page.tsx`.

## Prompt to paste into Claude Code
```
Phase 2 (catalogue) of Seamwell. Read CLAUDE.md, docs/05-api.md and the products module first.

API (apps/api):
- Extend GET /api/products: filters for size (only products with an in-stock variant of that size), price range (min/max cents), fabric; return `total` for pagination (already there) and available facet values (sizes, fabrics, price min/max) for the current gender/category. Validate every new query param in packages/shared productQuerySchema. Keep all SQL in Drizzle (no raw strings).
- GET /api/products/:slug/related → 4 products from the same category & gender (exclude itself).
- Add unit tests for the new query validation.

Web (apps/web):
- /shop: filter bar (gender, category, size chips, price range, sort) that updates the URL (shareable links); on mobile the filters open in a Sheet. Pagination or "Load more". Skeletons while loading. Empty state.
- Search: the navbar search icon opens a command-style dialog that searches as you type (debounced 250 ms) and shows product results.
- Product page: image gallery (thumbnails + swipe on mobile; GSAP crossfade), sticky add-to-bag bar on mobile, "Complete the look" related products, breadcrumbs, size guide dialog.
- Use next/image for real product photos (configure remotePatterns for our own domain /uploads).
- SEO: generateMetadata with Open Graph image, JSON-LD Product schema (price LKR, availability, aggregateRating when reviews exist), app/sitemap.ts and app/robots.ts.
Check 375/768/1440 px and reduced motion. Run typecheck, lint, tests.
```

## Acceptance criteria
- [ ] Filters/sort/search reflected in the URL and survive refresh/back
- [ ] Product gallery works with touch and keyboard
- [ ] JSON-LD validates (Google Rich Results test) · sitemap lists all active products
- [ ] Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95 on /shop and a product page

## Security checklist
- [ ] Every new query param validated by Zod (bounded numbers, enum sizes, slug regex)
- [ ] Search uses `ilike` with escaped wildcards (see `likeEscape`) — no raw SQL
- [ ] JSON-LD built with `JSON.stringify` (escape `<` as `<`) — no user HTML
