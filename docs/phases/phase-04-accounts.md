# Phase 4 · Accounts: sign in, register, MFA, password reset

**Goal:** optional customer accounts with excellent security UX; required MFA for admins.
**Read first:** `docs/02-security.md`, `apps/api/src/modules/auth/*`, `apps/web/src/lib/api.ts`, `docs/05-api.md` (auth).

## Prompt to paste into Claude Code
```
Phase 4 (accounts) of Seamwell. Read CLAUDE.md, docs/02-security.md and the auth module first. The auth API (register, login, MFA verify, refresh rotation, logout, MFA setup/enable/disable) already exists and is tested — build the UI and the missing flows on top of it, don't weaken anything.

API additions:
- Password reset: POST /auth/password/forgot {email} → always 200 (no enumeration); create single-use token (32 random bytes, store sha256, expires 30 min), email a link. POST /auth/password/reset {token, password} → verify, update hash, mark token used, revokeAllSessions, audit. Rate limit both.
- Email verification: token emailed on register; GET-free flow: POST /auth/email/verify {token}. Show a banner until verified.
- POST /auth/password/change (signed in): current password + new password; revoke other sessions.
- GET /auth/sessions + POST /auth/sessions/revoke-all ("sign out everywhere").
- Attach guest orders to a new account automatically ONLY after the email is verified (orders where email matches and userId is null).

Web:
- /login (email + password → if mfaRequired show 6-digit code step with "use a recovery code" option), /register, /forgot-password, /reset-password?token=, /verify-email?token=.
- `?next=` support: only allow relative paths starting with "/" (reject "//" and absolute URLs).
- AuthProvider (client) using /auth/me; navbar shows the account menu when signed in.
- /account: tabs Orders (list + detail with status timeline and courier tracking link), Addresses, Security (enable MFA: show QR + manual key, verify code, show 10 recovery codes once with Copy/Download; disable MFA; change password; sign out everywhere).
- Admins without MFA are sent to Account → Security with a message.
- Nice GSAP touches: code inputs auto-advance, success checkmark DrawSVG.
Tests: reset token single-use + expiry, no user enumeration on forgot, next= redirect validation. Run typecheck, lint, tests.
```

## Acceptance criteria
- [ ] Full flows work: register → verify email → sign in → enable MFA → sign out → sign in with code → sign in with a recovery code
- [ ] Forgot/reset works and old sessions are signed out
- [ ] Guest orders appear in the account after email verification
- [ ] All forms accessible (labels, errors announced, autocomplete attributes incl. `one-time-code`)

## Security checklist
- [ ] Same response for existing/non-existing emails on forgot-password
- [ ] Reset & verify tokens hashed in DB, single use, short expiry
- [ ] `next` redirect cannot leave the site
- [ ] No tokens in localStorage / URLs other than the one-time emailed token
- [ ] Rate limits on every new auth endpoint
