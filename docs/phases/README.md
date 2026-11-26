# Build phases

Work through these in order with Claude Code. In VS Code's Claude Code panel type **`/next-phase`** (or `/next-phase 4` for a specific one).
Each file has: goal, what to read, **a prompt to paste**, acceptance criteria, and a security checklist.
One phase per conversation · commit after each phase · keep `npm run typecheck && npm run lint && npm test` green.

| # | Phase | Status |
|---|---|---|
| 0 | Foundation: monorepo, API core, security, schema, home page, shop, product, bag, checkout, tracking, try-on starter | ✅ Done |
| 1 | [Design system & UI kit](phase-01-design-system.md) | ✅ Done |
| 2 | [Catalogue polish (filters, search, gallery, SEO)](phase-02-catalogue.md) | ✅ Done (Lighthouse mobile: perf 85–87, a11y/BP/SEO 100) |
| 3 | [Bag & checkout polish](phase-03-checkout.md) | ✅ Done (85 unit + 56 e2e checks) |
| 4 | [Accounts: sign in, register, MFA, password reset](phase-04-accounts.md) | ✅ Done (127 unit + 83 e2e checks; UI flow verified at 375/768/1440) |
| 5 | [Admin dashboard: orders & tracking, products & photos, emails](phase-05-admin.md) | ✅ Done (185 unit + 115 e2e checks; admin UI verified at 375/768/1440) |
| 6 | [Reviews UI](phase-06-reviews.md) | ✅ Done (201 unit + 125 e2e checks; flows verified at 375/1440) |
| 7 | [Virtual Try-On polish](phase-07-virtual-try-on.md) | ✅ Done (209 unit + 125 e2e; UI verified at 375/768/1440 in Chrome + Edge; real AI pass via backup Space failover; open: real hands-in-pockets photo test) |
| 8 | [Animations, content & accessibility polish](phase-08-polish.md) | 🟡 Done except one target — Lighthouse mobile perf: home 85–86 (target ≥ 90); a11y/BP/SEO 100 on every page; no horizontal scroll at 375–1888; 215 unit + 128 e2e |
| 9 | [Security hardening & testing](phase-09-security-testing.md) | ✅ Done — nonce CSP, breached-password check, `npm run test:all` green on the local test DB (2026-11-26): typecheck + lint, 246 unit, 162 API e2e, 9 Playwright (customer on desktop + phone; hidden admin address → admin 2FA → ship → review → approve), audit 0 vulnerabilities |
| 10 | [Deploy to Hostinger VPS](phase-10-deploy.md) | 🟡 Code on GitHub (`Nodemor/seamwell`, public) with CI; auto-deploy on merge to `main` (locked SSH key → `deploy/deploy.sh`: zero-downtime release folders, auto-rollback); hidden admin address (`ADMIN_PATH`). Waiting for the VPS setup (docs/07 §1–8) |
| 11 | [Payment gateway (PayHere) — later](phase-11-payment-gateway.md) | 💤 Later |
