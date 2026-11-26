# 04 · Database (PostgreSQL + Drizzle)

Schema source of truth: `apps/api/src/db/schema.ts`. SQL migrations: `apps/api/drizzle/` (commit them).

## Tables
| Table | Purpose / key columns |
|---|---|
| `users` | email (unique, lower-case), name, phone, `password_hash` (argon2id), `role` customer/admin, `mfa_enabled`, `mfa_secret_enc` (AES-GCM), `failed_logins`, `locked_until` |
| `refresh_tokens` | `token_hash` (sha256), `family_id`, `mfa_verified`, `expires_at`, `revoked_at`, user agent, ip |
| `mfa_recovery_codes` | `code_hash`, `used_at` |
| `categories` | slug + gender unique (suits/blazers/shirts/trousers × men/women) |
| `products` | slug, name, description, category, gender, `price_cents`, `compare_at_cents`, fabric, fit, color, `color_hex`, `is_active`, **try-on:** `tryon_enabled`, `tryon_slot` (kit/blazer/shirt/trousers), `tryon_photo_type`, `tryon_image_url`; denormalised `rating_avg_x100`, `rating_count`; **renting:** `rent_enabled`, `rent_price_cents`, `rent_deposit_cents`, `rent_days` (3–14); **sale:** `sale_price_cents` (< price), `sale_starts_at`, `sale_ends_at` (null = open-ended) |
| `product_images` | url, alt, sort order |
| `product_variants` | sku (unique), size, `stock` (≥ 0 check, for sale), `rent_stock` (rental pieces, separate), optional price override |
| `orders` | `order_number` (SW-XXXXXX), optional `user_id` (null = guest), contact + address snapshot, `payment_method` cod/bank_transfer, `payment_status`, `status`, totals, **courier_name, tracking_number, tracking_url**, shipped/delivered/**returned** timestamps, **`deposit_cents`** (included in the total) + `deposit_status` none/held/refunded/kept |
| `order_items` | product/variant refs + **name, size, unit price snapshot**, quantity, `mode` buy/rent; rentals: `event_date`, `rent_start` (delivery), `rent_end` (collection), `deposit_cents` per piece |
| `rental_bookings` | one per rented line: variant, `start_date` (delivery) → `end_date` (collection **+ 2 cleaning days**), quantity, status active/released. Availability = `rent_stock` − overlapping active bookings |
| `order_status_history` | status, note, changed_by, time — shown to customers as the timeline |
| `reviews` | product, order, optional user, author display name, rating 1–5 (check), title, body, status pending/approved/rejected; unique (order, product) |
| `audit_logs` | actor, action, entity, meta (jsonb), ip, time |

Money is integer **cents (LKR)**. Timestamps are `timestamptz`.

## Workflow
```bash
# edit apps/api/src/db/schema.ts, then:
cd apps/api
npx drizzle-kit generate --name=add_wishlist   # writes drizzle/000X_add_wishlist.sql — review it!
npm run db:migrate                              # applies pending migrations
npm run db:studio                               # browse data in the browser
```
Never edit an already-applied migration file; create a new one.

## Moving to Supabase or the VPS
- **VPS (recommended):** PostgreSQL 17 on the same server, listening on `127.0.0.1` only, dedicated `seamwell` role (not superuser). `DATABASE_URL=postgres://seamwell:<long-random>@127.0.0.1:5432/seamwell`.
- **Supabase:** create a project → Database → Connection string (**Session pooler**) → `DATABASE_URL=...?sslmode=require` → `npm run db:migrate`. The code turns on TLS automatically when `sslmode=require` is present. Don't use Supabase's auto-generated REST API for this app (keep all access through our API).

## Backups (VPS)
Nightly `pg_dump` to an encrypted file, keep 14 days, copy off-server weekly. Script in `07-deployment-vps.md`. Test a restore once a month.
