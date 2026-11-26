# Phase 3 · Bag & checkout polish

**Goal:** a smooth, trustworthy checkout for guests and signed-in customers with COD and bank transfer.
**Read first:** `apps/api/src/modules/orders/*`, `apps/web/src/app/checkout/page.tsx`, `store/cart.ts`, `docs/01-architecture.md` (checkout flow).

## Prompt to paste into Claude Code
```
Phase 3 (bag & checkout) of Seamwell. Read CLAUDE.md and the orders module first. Payment methods stay COD + bank transfer only.

API:
- POST /api/orders/quote: body {items:[{variantId, quantity}]} → server-computed lines, subtotal, shipping, total, and any unavailable items. Rate-limit it (30/15 min). Reuse the pricing logic from placeOrder (extract a shared function; placeOrder must still recompute inside its transaction).
- Idempotency: accept an `Idempotency-Key` header on POST /api/orders (UUID from the client); store it on the order (new unique column + migration) so a double-click/refresh can't create two orders — return the existing order instead.
- Sri Lankan districts: add the 25 districts to packages/shared as an enum and validate shippingAddress.district against it.
- Signed-in users: pre-fill name/email/phone; add `addresses` table (user_id, label, fields, is_default) + CRUD endpoints under /api/account/addresses (owner checks!).

Web:
- Bag page and mobile bag sheet call /orders/quote to show real prices, shipping and warnings ("price changed", "sold out") before checkout.
- Checkout: 3-step layout on mobile (Details → Delivery → Payment) using a stepper (React Bits Stepper or shadcn Tabs), district <select>, saved-address picker for signed-in users, inline validation with the shared schema, generate one Idempotency-Key per checkout attempt.
- Bank transfer: confirmation page shows bank details with a Copy button and the order number as reference.
- Order confirmation page /order/[orderNumber]/thank-you that doesn't expose data without the email (use the response state; refresh → link to tracking).
Tests: quote calculation, idempotency (two identical POSTs → one order), district validation. Run typecheck, lint, tests.
```

## Acceptance criteria
- [ ] Prices shown before ordering match the final order exactly
- [ ] Double-submitting checkout creates one order
- [ ] Sold-out item during checkout shows a clear message, nothing is charged/decremented
- [ ] Works with keyboard only; mobile layout at 375 px is comfortable

## Security checklist
- [ ] Client never sends prices; quote and order both computed server-side
- [ ] Address endpoints check `userId` ownership on every read/update/delete (test with two users)
- [ ] Idempotency key validated as UUID; unique constraint in DB
