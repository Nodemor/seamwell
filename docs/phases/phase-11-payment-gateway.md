# Phase 11 · Payment gateway (later) — e.g. PayHere

**Goal:** add online card payments without disturbing COD / bank transfer.
**Read first:** `docs/01-architecture.md` ("Adding a payment gateway later"), `apps/api/src/modules/orders/*`, the gateway's official developer docs (sandbox first).

## Prompt to paste into Claude Code
```
Phase 11 (payment gateway) of Seamwell. Read CLAUDE.md, docs/01-architecture.md and the orders module. Use the gateway's SANDBOX. I'll provide the merchant ID/secret via .env only.

- Create apps/api/src/modules/payments/ with a PaymentProvider interface:
  createCheckout(order) → { redirectUrl | formFields }, verifyNotification(req) → { orderNumber, status, amountCents, reference }.
- Implement the PayHere provider following its official docs (checkout form fields + server-to-server notify_url with md5sig verification using the merchant secret).
- Add "payhere" to PAYMENT_METHODS (shared) + DB enum migration + a `payments` table (order_id, provider, reference, amount_cents, status, raw verified payload, created_at).
- New order flow for card: order created as awaiting_payment → redirect to gateway → ONLY the verified notify callback may set paymentStatus=paid and status=confirmed (check amount + currency + order number; idempotent on repeated notifications). The browser "return" page just shows the current status.
- Checkout UI: enable the "Card / online" option behind a feature flag (PAYMENTS_ENABLED).
- Tests: forged notification (bad signature) rejected; amount mismatch rejected; duplicate notification handled once.
```

## Acceptance criteria
- [ ] Sandbox payment marks the order paid via the server callback only
- [ ] COD and bank transfer unchanged

## Security checklist
- [ ] Merchant secret only in `.env`; signature verified with constant-time comparison
- [ ] Never trust the redirect/query string for payment status
- [ ] Card data never touches our server (hosted checkout)
