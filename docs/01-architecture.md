# 01 · Architecture

## Overview

```
                ┌──────────── Customer's browser ─────────────┐
                │  Next.js pages (React 19 + GSAP)             │
                │  ├─ /api/*  (same origin, httpOnly cookies)  │──┐
                │  └─ Virtual Try-On → Hugging Face Space ─────┼──┼──► fashn-ai/fashn-vton-1.5 (free GPU,
                └──────────────────────────────────────────────┘  │    customer's own daily quota)
                                                                  │
   Hostinger KVM 2 VPS ───────────────────────────────────────────┼────────────
   │  Nginx :443  (TLS, security headers, gzip, static cache)     │
   │   ├─ /api/*  ─────────────► Node API (Express)  127.0.0.1:4000 ──► PostgreSQL 127.0.0.1:5432
   │   └─ /*      ─────────────► Next.js server      127.0.0.1:3000 ──(SSR fetch)──► API
   │  PM2 keeps both Node processes alive · UFW firewall · daily DB backups
   └──────────────────────────────────────────────────────────────────────────
```

- **Same origin**: the browser only talks to `https://yourshop.lk`. Cookies are first-party, SameSite=Strict, so there's no CORS or third-party cookie trouble.
- **Server Components** fetch the public catalogue straight from the API (`API_INTERNAL_URL`) and are cached for 60 s.
- **The AI never runs on the VPS.** The KVM 2 has no GPU; the try-on runs in the customer's browser against a free Hugging Face Space.

## Monorepo

| Package | Purpose |
|---|---|
| `apps/web` | Next.js 16 App Router storefront. `src/app` routes, `src/components/{home,layout,product,tryon,orders,brand,motion}`, `src/lib` (api, gsap, catalog, tryon), `src/store` (zustand bag). |
| `apps/api` | Express 5 API. `src/modules/<feature>/{routes,service}.ts`, `src/middleware` (security, auth, rate limits, validation, errors), `src/lib` (jwt, password, mfa, crypto, audit, mailer, logger), `src/db` (schema, client, seed), `drizzle/` (SQL migrations). |
| `packages/shared` | Zod schemas + enums + helpers shared by both sides (one source of truth for validation and order statuses). |

## Key flows

**Guest checkout**
1. Bag lives in `localStorage` (zustand). Prices there are display-only.
2. `POST /api/orders` with `{customer, shippingAddress, paymentMethod, items:[{variantId, quantity}]}`.
3. API (one DB transaction): loads variants + prices, decrements stock with a conditional UPDATE (`stock >= qty`), computes shipping, inserts order + items + first status row.
4. COD → `pending_confirmation`; bank transfer → `awaiting_payment` and the bank details are returned + emailed.

**Order tracking & shipping**
- Admin moves the order through `ORDER_TRANSITIONS` (shared). Marking **shipped** requires courier name + tracking number (+ optional https tracking URL); the customer is emailed.
- Customers track with **order number + email** (`POST /api/orders/track`, rate-limited) or from their account.

**Auth**
- Register/login → short-lived JWT access cookie (15 min) + opaque refresh cookie (30 days, path `/api/auth`, stored hashed, rotated on each use; reuse of an old one revokes the whole session family).
- If MFA is on: login returns `mfaToken` → `POST /auth/mfa/verify` with a TOTP or recovery code.
- Admin endpoints require role `admin` **and** an MFA-verified session.

**Reviews**
- Only for products in a **delivered** order of the reviewer (signed-in user, or guest proving order number + email). One per product per order. Start as `pending`; admin approves → product rating recalculated.

**Virtual Try-On** — see `06-virtual-try-on.md`.

## Adding a payment gateway later
Create `apps/api/src/modules/payments/` with a `PaymentProvider` interface (`createPayment(order) → redirect/params`, `verifyNotification(req) → {orderNumber, status}`). Add `"payhere"` to `PAYMENT_METHODS` + the DB enum (migration), mark orders `paid` only from a **verified server-to-server notification** (never from the browser redirect). See `docs/phases/phase-11-payment-gateway.md`.
