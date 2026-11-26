# CLAUDE.md — Seamwell Tailoring

Project memory for Claude Code. Read this first in every session, then the doc for the task at hand.

## What this is
A **single-shop e-commerce site for a tailoring shop** (suits, blazers, shirts, trousers — men & women)
with a free **AI Virtual Try-On**, guest checkout, **Cash on Delivery / Bank Transfer**, admin order
tracking (courier + tracking number), and verified-purchase reviews. Sample brand: **Seamwell Tailoring**.

## Stack (do not change without asking)
- `apps/web` — **Next.js 16** (App Router, TypeScript), **Tailwind CSS v4**, **GSAP 3** (+ `@gsap/react`, SplitText, ScrollTrigger, DrawSVG — all free), zustand, lucide-react. shadcn-compatible (`components.json`) so **React Bits** and **21st.dev** components install cleanly.
- `apps/api` — **Node.js 22 + Express 5** (TypeScript), **PostgreSQL** via **Drizzle ORM**, Zod validation, argon2id, jose (JWT), otpauth (TOTP MFA), helmet, express-rate-limit, pino.
- `packages/shared` — Zod schemas, enums, types shared by web + API. **Every API input is validated with a schema from here.**
- Hosting target: **Hostinger KVM 2 VPS** (Ubuntu, Nginx, PM2, PostgreSQL). Supabase Postgres is a drop-in alternative (`DATABASE_URL`).

## Commands (run from repo root)
| Task | Command |
|---|---|
| Install | `npm install` |
| Start Postgres (Docker) | `npm run db:up` |
| Migrate / seed | `npm run db:migrate` · `npm run db:seed` |
| New migration after editing `schema.ts` | `cd apps/api && npx drizzle-kit generate --name=<change>` then `npm run db:migrate` |
| Dev (web :3000 + api :4000) | `npm run dev` |
| Typecheck / lint / unit tests | `npm run typecheck` · `npm run lint` · `npm test` |
| API end-to-end smoke test (dev DB, API running) | `npm run test:e2e -w @seamwell/api` |
| API e2e on the local test DB (`DATABASE_URL_TEST`) | `npm run test:e2e:api` |
| Browser e2e (Playwright, installed Chrome, test DB) | `npm run test:e2e:web` |
| Everything (typecheck, lint, unit, API + browser e2e) | `npm run test:all` |
| Dependency audit (before deploying) | `npm run audit` |
| Create admin | `npm run admin:create -- owner@shop.lk "Owner Name"` |
| Production build | `npm run build` |

**Definition of done for any change:** `npm run typecheck && npm run lint && npm test` pass, and the page works at 375px, 768px and 1440px wide.

## Architecture rules
- Browser → same-origin `/api/*` (Next rewrite in dev, Nginx in prod) → Express. Never call the API cross-origin from the browser.
- Server Components fetch public data (catalogue) directly from `API_INTERNAL_URL`. Client components use `lib/api.ts`.
- Money = **integer cents (LKR)**. Prices are **always computed on the server**; the client only sends variant IDs + quantities.
- Order status changes only through `ORDER_TRANSITIONS` (packages/shared). `shipped` requires courier + tracking number.
- Modules live in `apps/api/src/modules/<name>/` (`*.routes.ts` + `*.service.ts`). Keep routes thin.
- Payment gateway (e.g. PayHere) is a **later phase** — add it behind a `PaymentProvider` interface; don't hard-code into checkout.

## Security rules (non-negotiable — see docs/02-security.md)
1. **No string-built SQL.** Use Drizzle query builder or the `sql` tagged template (parameters bound). Never `sql.raw()` with user input.
2. Validate every body/query/param with Zod (`parse`/`body`/`query` helpers). Unknown keys are stripped.
3. Tokens only in **httpOnly, SameSite=Strict** cookies. Never store tokens in localStorage. Never return password hashes, MFA secrets or raw stock counts.
4. State-changing requests require the `X-Seamwell-CSRF: 1` header (`lib/api.ts` adds it).
5. Admin routes: `requireAdmin` (role admin **and** MFA-verified session). Log admin actions with `audit()`.
   Admin **pages** live at the secret `/<ADMIN_PATH>` (server env only, never `NEXT_PUBLIC_`); `/admin` is a 404. Inside the admin
   build links with `useAdminBase()` — never hard-code `/admin` in a page link.
6. Rate-limit every auth, checkout, tracking and review endpoint.
7. Render user content as text (React escapes it). **Never** `dangerouslySetInnerHTML` with user data.
8. Secrets only in `.env` (never committed, never read into chat/logs). Don't add a Hugging Face token to the website — the try-on runs on the customer's own free quota.
9. Uploads (phase 5): check magic bytes (file-type), re-encode with sharp, size limit, random filenames, serve from a non-executable path.
10. Run `npm audit --omit=dev` before deploying.

## UI & animation rules (see docs/03-design-system.md)
- Light, elegant palette: ivory background, ink text, **midnight navy** primary, **brass** accent. Dark components (navy bands/cards) on light pages. **No dark mode.**
- Fonts: Cormorant Garamond (display) + Inter (body), self-hosted via @fontsource.
- Import GSAP only from `@/lib/gsap` (plugins registered once). Use `useGSAP` with a `scope`, and wrap animations in `gsap.matchMedia().add(MOTION_OK, …)` so **reduced-motion users get no animation**.
- Scroll reveals: add `data-reveal` (`up|fade|scale|left|right`) — handled globally by `MotionProvider`.
- ⚠️ **Never put Tailwind `transition`/`transition-all` (or hover transforms) on an element GSAP animates** — CSS transitions fight GSAP and leave elements stuck invisible. Use `transition-colors` / `transition-[border-color,…]`, or put `data-reveal` on a wrapper.
- Every interactive element: keyboard focus visible, ≥44px touch target on mobile, `aria-*` labels on icon buttons.
- New UI pieces: prefer React Bits / 21st.dev components (install commands in docs/03), then restyle with brand tokens.

## Virtual Try-On (see docs/06-virtual-try-on.md)
- Runs **in the customer's browser** via `@gradio/client` → Hugging Face Space `fashn-ai/fashn-vton-1.5` (endpoint `/try_on`). Each visitor uses their own free GPU quota.
- Defaults that were tested: `segmentation_free=true` (volume mode), steps 50, guidance 1.5. Order of passes: trousers → shirt → blazer (or one pass for a full kit).
- Photo check (MediaPipe, in browser) blocks photos with a cut-off face/head, hidden hands, no person or several people — those made the model draw the person from behind.
- Code: `apps/web/src/lib/tryon/*`, UI `components/tryon/TryOnStudio.tsx`. Prototype: `docs/reference/tryon-prototype.html`.

## How to work in this repo
- Work **phase by phase** — `docs/phases/`. Use `/next-phase` to start the next one. Finish a phase (tests + checklist) before starting another.
- Before writing code: read the phase file + linked docs, then propose a short plan. Keep changes small and commit per step.
- After UI work: run the dev server and check the page at mobile and desktop widths.
- Ask before adding a new dependency; prefer what's already installed.
