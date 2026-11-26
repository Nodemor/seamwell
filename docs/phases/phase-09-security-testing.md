# Phase 9 · Security hardening & testing

**Goal:** prove the shop is safe before real customers use it.
**Read first:** `docs/02-security.md` ("Still to do"), `apps/api/scripts/e2e-smoke.mjs`, `apps/api/src/**/*.test.ts`.

## Prompt to paste into Claude Code
```
Phase 9 (security & testing) of Seamwell. Read CLAUDE.md and docs/02-security.md. Run /security-review on the whole repo first and fix confirmed findings.

- CSP with nonces: move the CSP from next.config.ts into apps/web/src/proxy.ts (Next 16 "proxy", formerly middleware) generating a per-request nonce; script-src 'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval' (+ cdn.jsdelivr.net for MediaPipe); pass the nonce to the inline motion boot script. Verify GSAP, Next, try-on and MediaPipe still work.
- Breached passwords: on register/reset/change, check HaveIBeenPwned's k-anonymity range API (only the first 5 SHA-1 chars leave the server; 2 s timeout; fail open with a log).
- Playwright e2e (apps/web/e2e): browse → add to bag → guest COD checkout → track order; admin ships with tracking (seed an admin with a known TOTP secret in the test DB only); customer review → admin approve; mobile viewport run. Add `npm run test:e2e:web`.
- Extend apps/api tests with supertest + a test database (DATABASE_URL_TEST): IDOR (user B can't read user A's order), price tampering, refresh-token reuse, rate limits, upload validation.
- npm audit --omit=dev and fix; add `npm run audit` to the pre-deploy checklist.
- Logging: make sure no personal data/passwords/tokens appear in logs (grep the logs after running the e2e tests).
- Add security.txt at /.well-known/security.txt with a contact email.
- Optional: run OWASP ZAP baseline against the staging site and fix High/Medium findings.
```

## Acceptance criteria
- [x] All unit, API and Playwright tests pass in one command — `npm run test:all` (2026-11-26: 242 unit · 159 API e2e · 9 browser)
- [x] CSP has no `'unsafe-inline'` for scripts; site, animations and try-on still work (Playwright checks nonces + MediaPipe)
- [x] `npm audit --omit=dev` has no high/critical issues (0 vulnerabilities)

## Security checklist
- [x] Findings from /security-review fixed, each with a test (production email bodies in logs → `mailer.test.ts`; extra log redaction paths; IDOR/oversize/polyglot upload checks added to the API e2e)
- [x] Secrets rotated if they ever appeared in chat, logs or git history (none did: `.env` is never read; no git history yet)
