# Seamwell Tailoring - e-commerce with Virtual Try-On

A single-shop online store for a tailoring business (suits, blazers, shirts, trousers for men and women) with:

- ✨ **Free AI Virtual Try-On** - customers upload a photo and see the outfit on themselves (runs on each customer's own free Hugging Face quota)
- 🛍️ **Guest checkout** (accounts optional) with **Cash on Delivery** or **Bank Transfer** (card gateway such as PayHere planned for later)
- 📦 **Order tracking** - the shop updates status; when shipped, the customer gets the courier name, tracking number and tracking link
- ⭐ **Verified-purchase reviews** with admin moderation
- 🔐 **Security built in** - JWT in httpOnly cookies, refresh-token rotation, TOTP two-factor auth (required for admins), argon2id, CSRF protection, rate limiting, Zod validation, parameterised SQL, audit log
- 🎬 **GSAP animations** - split-text hero, DrawSVG "stitched" blazer, pinned scroll story, scroll-velocity marquee, magnetic try-on button; fully responsive and reduced-motion friendly

> "Seamwell Tailoring" and its logo are **sample branding** — replace them with the real shop's name, logo and details.

## Quick start

```bash
npm install
npm run db:up                          # PostgreSQL in Docker (or install PostgreSQL natively — see docs/00-START-HERE.md)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate && npm run db:seed  # tables + 12 sample products
npm run dev                            # web → http://localhost:3000   api → http://localhost:4000
```

Full step-by-step setup (VS Code, Claude Code, Windows without Docker): **[docs/00-START-HERE.md](docs/00-START-HERE.md)**

## Project map

```
seamwell/
├── CLAUDE.md                 ← rules & context Claude Code reads automatically
├── .claude/commands/         ← /next-phase, /security-review, /ui-polish, /add-component
├── docs/
│   ├── 00-START-HERE.md      ← setup in VS Code + Claude Code
│   ├── 01-architecture.md    02-security.md   03-design-system.md
│   ├── 04-database.md        05-api.md        06-virtual-try-on.md
│   ├── 07-deployment-vps.md  ← Hostinger KVM 2 (Nginx, PM2, Postgres, SSL)
│   ├── phases/               ← build plan: one prompt file per phase
│   └── reference/tryon-prototype.html  ← the tested single-file try-on prototype
├── apps/
│   ├── web/                  ← Next.js 16 + Tailwind v4 + GSAP storefront
│   └── api/                  ← Express 5 + Drizzle + PostgreSQL API
└── packages/shared/          ← Zod schemas, enums & types used by both
```

## What's already built vs. next

| Area | Status |
|---|---|
| Monorepo, configs, design tokens, logo | ✅ |
| Home page (hero, marquee, shop-by-piece, new arrivals, try-on story, craft, services, CTA) | ✅ |
| Navbar with Virtual Try-On, mobile menu, footer | ✅ |
| Shop list + filters, product page, bag, guest checkout (COD / bank transfer), order tracking | ✅ |
| Virtual Try-On studio (photo check → outfit → AI result) | ✅ working starter — polished in phase 7 |
| API: products, orders, tracking, admin order status + courier tracking, reviews + moderation, auth + MFA | ✅ tested (15 unit + 38 end-to-end checks) |
| Login / register / account / MFA screens | ⏭️ phase 4 (API ready) |
| Admin dashboard UI, product CRUD + photo upload, emails | ⏭️ phase 5 |
| Review form UI | ⏭️ phase 6 |
| Payment gateway (PayHere) | ⏭️ later phase |

Open the project in VS Code, start Claude Code, and type **`/next-phase`**.
