# Phase 6 · Reviews UI

**Goal:** customers who received their clothes can review them; everyone sees approved, verified reviews.
**Read first:** `apps/api/src/modules/reviews/reviews.routes.ts`, `components/product/Reviews.tsx`, `docs/05-api.md` (reviews).

## Prompt to paste into Claude Code
```
Phase 6 (reviews) of Seamwell. Read CLAUDE.md and the reviews module first. The API already enforces: delivered orders only, one review per product per order, pending → admin approval, privacy-safe author names, rate limit.

API:
- GET /api/reviews/product/:productId → add pagination and a rating breakdown (count per star).
- GET /api/orders/mine/:orderNumber and the guest tracking response: include `reviewable` items (delivered, not yet reviewed) with productId.
- Optional photo on a review (1 image, same secure upload pipeline as phase 5), shown only after approval.
- "Fit" field: runs small / true to size / runs large (enum in shared + migration) → show aggregated fit hint on the product page.

Web:
- Write-review dialog: star rating (keyboard accessible radio group), title, text (10–1500 chars, live counter), fit, optional photo. Open it from: account order detail, guest tracking page (after a successful lookup the order number + email are reused), and the "delivered" email link (/review?order=…&product=…, which asks for the email again).
- Product page: rating summary with bar breakdown, fit hint ("Most say: true to size"), paginated reviews, "Verified purchase" badge. GSAP: bars grow on scroll.
- After submitting: friendly "thanks — it will appear after a quick check" state.
Tests: cannot review undelivered order, cannot review twice, guest needs matching email. Run typecheck, lint, tests.
```

## Acceptance criteria
- [ ] Customer and guest flows both work; admin approves → appears on product page; rating updates
- [ ] Star input works with keyboard and screen reader

## Security checklist
- [ ] Review text rendered as plain text; photo through the secure upload pipeline
- [ ] Guest review requires order number + email match (no enumeration of orders)
