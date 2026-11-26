# 02 · Security

What's implemented ✅ and what each phase must keep doing. Based on the OWASP Top 10 and OWASP ASVS basics.

## Threats → controls

| Threat | Control | Where |
|---|---|---|
| **SQL injection** | Drizzle query builder / `sql` template → values always bound as parameters (`$1`, `$2` — never pasted into the SQL text). Inputs validated by Zod first (e.g. slugs `^[a-z0-9-]+# 02 · Security

What's implemented ✅ and what each phase must keep doing. Based on the OWASP Top 10 and OWASP ASVS basics.

## Threats → controls

| Threat | Control | Where |
|---|---|---|
, audit filter `^[a-z_.]+# 02 · Security

What's implemented ✅ and what each phase must keep doing. Based on the OWASP Top 10 and OWASP ASVS basics.

## Threats → controls

| Threat | Control | Where |
|---|---|---|
, sort/status from fixed lists). `LIKE`/`ILIKE` search text has `%` `_` `` escaped (`likeEscape`). **No `sql.raw()`, no `.unsafe()`, no string-built queries anywhere** (re-audited 2026-11-26: every `sql`…`` interpolates only columns/tables or bound values). | `db/`, all services, `products.service.ts` |
| **Broken auth / credential stuffing** | argon2id (19 MiB, t=2); 10-char passwords with letters+digits; common-password block + **breached-password check** (Have I Been Pwned k-anonymity: only 5 SHA-1 characters leave the server, 2 s timeout, fails open with a warning; `HIBP_CHECK`) on register / reset / change; rate limit 10/15 min per IP+email; account lock 15 min after 5 failures; same error + same timing for unknown emails. | `lib/password.ts`, `auth.service.ts`, `rate-limit.ts` |
| **Session theft (XSS)** | Tokens only in `httpOnly` cookies; nothing in localStorage; React escapes output; strict CSP on the API; **nonce-based CSP on the site** (fresh nonce per request, `'strict-dynamic'`, no `'unsafe-inline'` for scripts). | `auth/cookies.ts`, `web/src/proxy.ts` |
| **Token replay** | Access JWT 15 min, HS256 only, issuer+audience checked. Refresh token opaque, hashed (SHA-256) in DB, **rotated on every use, reuse → whole family revoked**. Logout revokes the family. | `lib/jwt.ts`, `auth.service.ts` |
| **MFA** | TOTP (RFC 6238, ±30 s), secret **AES-256-GCM encrypted at rest**, 10 one-time recovery codes (hashed). MFA step uses a separate 5-min token with a different key. **Admins must have MFA**; admins can't disable it. | `lib/mfa.ts`, `lib/crypto.ts`, `middleware/auth.ts` |
| **Admin area discovery / brute force** | Admin pages live at a **secret address** `/<ADMIN_PATH>` (16–64 random chars, server env only — never `NEXT_PUBLIC_`, never in the repo or in any JavaScript sent to visitors). The admin pages sit in `app/[staff]`, whose server layout compares the first URL segment with `ADMIN_PATH` on every request (constant-time) and calls `notFound()` otherwise — so `/admin`, `/ADMIN`, `/%61dmin` or any guess gets the normal 404 page. No rewrite, no header to spoof. The API hands the address only to an admin whose session passed 2FA. Behind it: every `/api/admin/*` route needs role admin **and** a 2FA-verified session (`requireAdmin`), login rate limit + lockout, audit log. API refuses to start in production without `ADMIN_PATH`; `deploy.sh` checks `/admin` is 404 after every deploy. | `shared` (`isAdminSegment`), `web/src/app/[staff]/layout.tsx`, `auth.routes.ts`, `middleware/auth.ts` |
| **CSRF** | SameSite=Strict cookies **+** required `X-Seamwell-CSRF: 1` header on POST/PATCH/DELETE **+** Origin allow-list. | `middleware/security.ts`, `web/src/lib/api.ts` |
| **IDOR (seeing other people's orders)** | Orders looked up by `(orderNumber AND email)` or `(orderNumber AND userId)`. Same 404 for "wrong email" and "no order". | `orders.service.ts` |
| **Price / role tampering** | Client sends variant IDs + quantities only; prices from DB. Roles never read from the request body. Order status changes validated against `ORDER_TRANSITIONS`. | `orders.service.ts`, `shared` |
| **Overselling / race conditions** | Stock decremented with `UPDATE … WHERE stock >= qty` inside the order transaction. Refresh rotation uses a conditional update. | `orders.service.ts`, `auth.service.ts` |
| **Spam / abuse** | Rate limits: global 300/15 min, checkout 10/h, tracking 20/15 min, reviews 5/h. Reviews only for delivered orders + moderation. | `rate-limit.ts`, `reviews.routes.ts` |
| **Information leakage** | Generic 500 messages, no stack traces; pino redacts cookies, passwords, tokens, MFA secrets/codes; emails are only printed in development (production without SMTP logs the subject only); `x-powered-by` off; exact stock hidden. | `error-handler.ts`, `logger.ts`, `mailer.ts` |
| **Large / malformed payloads** | JSON limit 100 kB; simple query parser (no nested objects); Zod strips unknown keys. | `app.ts` |
| **Security headers** | API: helmet with `default-src 'none'`, HSTS in production. Site: nonce CSP, nosniff, frame-deny, COOP same-origin, referrer-policy, permissions-policy; `/.well-known/security.txt`. | `security.ts`, `next.config.ts`, `web/src/proxy.ts` |
| **Secrets** | Only in `.env` (git-ignored, blocked from Claude via `.claude/settings.json`); on the VPS in `shared/*.env*` (chmod 600). Server refuses to start in production with default secrets, `COOKIE_SECURE=false` or no `ADMIN_PATH`. GitHub deploy key is locked to `deploy.sh --from-ssh` (forced command: only `deploy <sha>` of a commit on `main`), stored as a `production` environment secret limited to `main`; the server's host key is pinned. | `config/env.ts` |
| **Audit trail** | Logins, failures, lockouts, MFA changes, refresh-reuse, admin order/review actions → `audit_logs`. | `lib/audit.ts` |
| **Try-on privacy** | Customer photos never touch the shop server; processed by the Hugging Face Space from the customer's browser. Tell customers in the privacy policy. | `lib/tryon/*` |

Verified by: `apps/api/src/**/*.test.ts` (246 unit tests), `apps/api/scripts/e2e-smoke.mjs` (162 API checks — IDOR, price tampering, refresh-token reuse, rate limits, upload validation incl. oversize + polyglot, rental double-booking) and `apps/web/e2e` (Playwright: CSP nonces, guest checkout + tracking on desktop and phone, MediaPipe under the CSP, hidden admin address → admin 2FA → ship with tracking → review → approve).

## Testing
| Command (repo root) | What it runs |
|---|---|
| `npm test` | Unit tests (no database) |
| `npm run test:e2e:api` | Migrates + seeds the **local test database**, starts a fresh API on :4100 against it, runs the 159 API checks |
| `npm run test:e2e:web` | Migrates + seeds the test database, starts API :4100 + a production build of the site on :3100, runs Playwright in your installed Chrome (desktop 1440 + phone) |
| `npm run test:all` | typecheck → lint → unit → API e2e → browser e2e |
| `npm run audit` | `npm audit --omit=dev` (run before every deploy) |

**One-time test database setup** (local PostgreSQL; the name must contain "test" and the host must be local, or the runners refuse):
```
"C:/Program Files/PostgreSQL/16/bin/psql.exe" -U postgres -h 127.0.0.1 -c "CREATE USER seamwell_test WITH PASSWORD '<choose one>';" -c "CREATE DATABASE seamwell_test OWNER seamwell_test;"
```
then add to `apps/api/.env`: `DATABASE_URL_TEST=postgresql://seamwell_test:<password>@127.0.0.1:5432/seamwell_test`.
Quick check against servers you already run: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e:web` (customer journeys only; places test orders with `e2e+…@example.com` emails).

## Rules for every phase
1. Validate input with a schema in `packages/shared` → `parse/body/query`.
2. Check **ownership** on every read/write of customer data.
3. Add a rate limit to any new endpoint that sends email, writes data or checks secrets.
4. Log admin actions with `audit()`.
5. No `dangerouslySetInnerHTML` for user content; links from users get `rel="noopener noreferrer"`; `?next=` redirects must be relative paths starting with `/`.
6. Add a test for each security-relevant behaviour.

## Still to do (scheduled)
- **Phase 4**: password reset (single-use hashed token, 30 min expiry, revoke sessions after reset), email verification, "sign out everywhere".
- **Phase 5**: secure uploads — accept JPEG/PNG/WebP only, check magic bytes (`file-type`), max 5 MB, re-encode + strip metadata with `sharp`, random file names, store outside the code folder, Nginx serves `/uploads` with `X-Content-Type-Options: nosniff` and no script execution.
- **Phase 9** ✅: nonce CSP, breached-password check, Playwright e2e, test-database runners, `npm run audit`, log review, security.txt. Still optional: OWASP ZAP baseline scan against staging (Phase 10); Redis-backed rate limits if you ever run more than one API process.
- **Deployment**: TLS (Certbot), UFW (22/80/443 only), SSH keys only + fail2ban, Postgres bound to localhost, nightly encrypted backups, unattended security upgrades.
