# Phase 5 · Admin dashboard: orders & tracking, products & photos, emails

**Goal:** the shop owner runs everything from `/admin`: confirm orders, mark bank transfers paid, ship with courier + tracking number, manage products and photos, moderate reviews.
**Read first:** `docs/05-api.md` (admin), `apps/api/src/modules/orders/*`, `modules/reviews/*`, `docs/02-security.md` (uploads), `docs/06-virtual-try-on.md` (try-on photo).

## Prompt to paste into Claude Code
```
Phase 5 (admin) of Seamwell. Read CLAUDE.md, docs/02-security.md and docs/05-api.md first. All admin API routes must use requireAdmin (role admin + MFA session) and audit().

API:
- /api/admin/products: list (search, status), create, update, archive (soft — isActive=false), variants CRUD (size, sku, stock, price override), image upload + reorder + delete, and a separate "try-on garment photo" upload that sets products.tryon_image_url.
- Uploads: multer memory storage, max 5 MB, accept only JPEG/PNG/WebP verified with `file-type` magic bytes, re-encode with `sharp` (strip metadata, max 2000px, WebP for gallery / JPEG for try-on photo), random file names (crypto.randomUUID), save to apps/api/uploads/, return /uploads/<name>. Never trust the original filename or mimetype.
- /api/admin/dashboard: today's orders, awaiting payment, to ship, low stock (≤3), pending reviews.
- /api/admin/orders/:orderNumber (full detail incl. customer contact & address) and CSV export of a date range.
- Implement lib/mailer.ts with nodemailer + SMTP_URL; templates for: order received (with bank details when relevant), payment confirmed, shipped (courier, tracking number, link), delivered (+ "review your items" link to the product pages).
- Courier presets in packages/shared: Domex, Pronto, Citypak, Kapruka, Sri Lanka Post, Other — with optional tracking URL templates the admin can edit in settings (store in a `settings` table, validated https URLs).

Web /admin (role-gated layout, noindex, separate simple nav):
- Dashboard cards, Orders board (filter by status, search by order number/phone), order detail drawer with status buttons that only show allowed transitions (ORDER_TRANSITIONS), "Mark paid" for bank transfers, Ship dialog (courier select, tracking number, auto-filled tracking URL), status history timeline.
- Products table + editor form (react-hook-form + zod), drag-to-reorder images, try-on photo upload with a preview and tips (white background, front view).
- Reviews moderation queue (approve/reject).
- Audit log viewer (read-only, paginated).
Tests: upload rejects a .php renamed to .jpg and oversized files; non-admin and admin-without-MFA get 403; invalid transition rejected. Run typecheck, lint, tests.
```

## Acceptance criteria
- [ ] Owner can process an order end-to-end: confirm → processing → ready → ship (tracking) → delivered; customer sees each step in tracking
- [ ] Bank transfer: "Mark paid" moves awaiting_payment → confirmed
- [ ] Products and photos manageable without touching the database; try-on photo appears in /try-on
- [ ] Emails sent (or printed in dev) at each key step

## Security checklist
- [ ] Every admin route: requireAdmin + audit()
- [ ] Upload checks: magic bytes, size, re-encode, random name, served by Nginx with nosniff (see deploy/nginx-seamwell.conf)
- [ ] CSV export escapes cells starting with `= + - @` (CSV injection)
- [ ] Admin pages `noindex` and never cached publicly
