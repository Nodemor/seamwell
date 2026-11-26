# 05 · API reference

Base URL: `/api` (same origin). JSON in/out. Errors: `{ "error": { "code", "message", "details?" } }`.
State-changing requests must send header **`X-Seamwell-CSRF: 1`** (the web `api()` helper does this).
Auth = httpOnly cookies set by the auth endpoints.

## Health
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ ok: true }` |

## Auth (`/auth`) — rate-limited
| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/register` | `{name, email, phone?, password}` | 201 `{user}` + cookies |
| POST | `/login` | `{email, password}` | `{mfaRequired:false, user}` + cookies **or** `{mfaRequired:true, mfaToken}` |
| POST | `/mfa/verify` | `{mfaToken, code}` (TOTP or recovery code) | `{user}` + cookies |
| POST | `/refresh` | — (refresh cookie) | `{user}` + rotated cookies |
| POST | `/logout` | — | 204, session family revoked |
| GET | `/me` | — | `{user}` |
| GET | `/session` | — | always 200: `{user \| null, refreshable}` — quiet "am I signed in?" probe (no 401 for guests) |
| POST | `/mfa/setup` | — | `{otpauthUri, qrDataUrl}` |
| POST | `/mfa/enable` | `{code}` | `{recoveryCodes[10]}` (show once) |
| POST | `/mfa/disable` | `{password, code}` | 204 (not allowed for admins) |
| POST | `/password/forgot` | `{email}` | always 200, same body (no enumeration); emails a 30-min single-use link. 5/h per IP+email |
| POST | `/password/reset` | `{token, password}` | 200; signs out every session; counts as email verification. 10/15 min per IP |
| POST | `/password/change` | `{currentPassword, newPassword}` (signed in) | 200 + fresh cookies; other devices signed out |
| POST | `/email/verify` | `{token}` | `{attachedOrders}` — guest orders with this email join the account |
| POST | `/email/resend` | — (signed in) | `{alreadyVerified}`. 5/h |
| GET | `/sessions` | — (signed in) | `{sessions: [{id, lastActiveAt, userAgent, ip, mfaVerified, current}]}` |
| POST | `/sessions/revoke-all` | — (signed in) | 204, every session (this one too) signed out |

Emailed tokens: 32 random bytes (base64url), only the sha256 is stored (`auth_tokens`), single use, a new link revokes older unused ones. `?next=` after sign-in goes through `safeNextPath` (shared) — same-site paths only.

## Catalogue (`/products`) — public, cached 60 s
| Method | Path | Query / notes |
|---|---|---|
| GET | `/` | `gender=men|women`, `category=<slug>`, `q` (≤80, LIKE-escaped), `size=<SIZES>` (in-stock variant only), `fabric`, `minPrice`/`maxPrice` (LKR cents, 0–100,000,000, min ≤ max), `sort=new|price_asc|price_desc`, `page≤500`, `pageSize≤48`, `facets=1` → `{items, page, pageSize, total, facets?: {sizes[], fabrics[], price: {min,max}|null}}`. Facets cover the gender/category/search scope, ignoring size/fabric/price so options don't vanish once picked. |
| GET | `/categories` | all categories |
| GET | `/:slug` | product + images + variants (`inStock`, `lowStock` — never raw stock) |
| GET | `/:slug/rent-calendar?variantId=` | `{rentable, first, last, unavailable:[YYYY-MM-DD]}` — event dates a size can't be rented for (dates only, never counts). `no-store`. |
| GET | `/:slug/related` | `{items}` — up to 4: same category & gender first, then other pieces for the same gender ("Complete the look"). Cached 5 min. |

## Orders (`/orders`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/quote` | public | `{items:[{variantId, quantity, mode?: buy|rent, eventDate?: YYYY-MM-DD}]}` (rentals need an event date ≥ 3 days ahead, ≤ 1 year; max 3 per line) → lines also carry `mode`, `depositCents`, rentals `eventDate/deliverOn/returnOn`; totals add `depositCents` (refundable, included in total, not counted toward free delivery); extra unavailable reasons `not_rentable|not_available_dates|invalid_date`. Original: `{items:[{variantId, quantity}]}` → `{quote: {lines, unavailable:[{variantId, reason: sold_out\|not_enough_stock\|not_found}], subtotalCents, shippingCents, totalCents, freeShippingThresholdCents}}` — same pricing code as the real order; never returns stock counts · 30/15 min per IP |
| POST | `/` | guest or user | checkout `{customer, shippingAddress (district ∈ 25 districts), paymentMethod: cod\|bank_transfer, notes?, items:[{variantId, quantity}]}` + header **`Idempotency-Key: <uuid>`** → 201 `{orderNumber, status, subtotalCents, shippingCents, totalCents, email, items, paymentMethod, bankTransferDetails?, replayed:false}`; the same key again → **200 with the same order** (`replayed:true`), same key + different email → 409 · 10/h per IP |
| POST | `/track` | public | `{orderNumber, email}` → `{order}` with items, history, courier, tracking number/url · 20/15 min |
| GET | `/mine` | user | my orders |
| GET | `/mine/:orderNumber` | user | one of my orders |

## Account (`/account`) — signed-in customers only; every query scoped to the session user
| Method | Path | Notes |
|---|---|---|
| GET | `/addresses` | own saved addresses (default first) |
| POST | `/addresses` | `{label, line1, line2?, city, district, postalCode?, isDefault?}` → 201; first address becomes default; max 10 |
| PATCH | `/addresses/:id` | partial update; `isDefault:true` moves the default; someone else's id → 404 |
| DELETE | `/addresses/:id` | 204; deleting the default promotes the oldest remaining one; someone else's id → 404 |

## Shop (`/shop`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/info` | public | `{shippingFeeCents, freeShippingThresholdCents, paymentMethods}` from the API settings — used by /help/delivery so it always matches checkout. No bank details. |

## Reviews (`/reviews`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/recent?limit=` | public | latest approved **4–5★** reviews across the shop (1–20, default 12) → `{reviews[{id, authorName, rating, title, body, createdAt, productName, productSlug, verified}]}` — home-page testimonials (the page hides the section with < 3 distinct reviews) |
| GET | `/product/:productId?page=` | public | approved reviews, 6/page → `{reviews[{…, fit, photoUrl, verified}], total, page, pageSize, breakdown{1..5}, fit{small,true,large}}` |
| POST | `/` | user, or anyone with `orderNumber + email` | JSON `{productId, rating, title?, body (10–1500), fit?: small|true|large, orderNumber?, email?}` — or multipart: `data` (that JSON) + optional `file` (photo, same checks as admin uploads). Product must be in a **delivered** order; same 403 for wrong email / no order / not delivered; one per product per order (409); → `pending` · 5/h |

Delivered orders (tracking + `/orders/mine/:n`) include `reviewable: [{productId, productName, slug, imageUrl}]` — items not reviewed yet. The "delivered" email links to `/review?order=…&product=<slug>`, which asks for the email again. Rejecting a review deletes its photo.

## Admin (`/admin/*`) — role admin + MFA-verified session, `Cache-Control: no-store`, every change audited
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard` | `{today:{orders, revenueCents}, toConfirm, awaitingPayment, toShip, inTransit, pendingReviews, lowStock[≤3], recent[8]}` (Colombo day) |
| GET | `/admin/orders?status=&q=&page=` | `{orders, total, page, pageSize}` — `q` = order number (part) or phone digits |
| GET | `/admin/orders/:orderNumber` | full detail: items, history (with admin name), customer contact, address, notes |
| GET | `/admin/orders/export.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` | CSV (≤ 1 year, UTF-8 BOM); cells starting `= + - @` are prefixed with `'` (formula injection). Audited. |
| PATCH | `/admin/orders/:orderNumber/status` | `{status, note?, courierName?, trackingNumber?, trackingUrl? (https), paymentStatus?}` — `ORDER_TRANSITIONS` enforced; `shipped` needs courier + tracking (link auto-filled from the courier template); `awaiting_payment → confirmed` needs `paymentStatus: "paid"` ("Mark paid"); `cancelled` restores stock. Emails: payment confirmed, shipped, delivered (+ review links). |
| GET/PUT | `/admin/settings/couriers` | `{templates: {domex, pronto, citypak, kapruka, slpost, other}}` — each "" or an https URL containing `{tracking}` |
| GET | `/admin/audit?action=<prefix>&page=` | read-only audit log, 50/page |
| GET | `/admin/reviews?status=pending` | moderation queue |
| PATCH | `/admin/reviews/:id` | `{status: approved|rejected}` → product rating recalculated |
| GET | `/admin/products?q=&status=active|archived|all&page=` | list with stock totals, low sizes, try-on photo flag |
| POST | `/admin/products` | create (slug made unique from the name) |
| GET/PATCH | `/admin/products/:id` | full product incl. stock / partial update; archive = `{isActive:false}` |
| POST/PATCH/DELETE | `/admin/products/:id/variants[/:variantId]` | `{size, sku, stock, priceOverrideCents?}` — one variant per size, unique SKU |
| POST | `/admin/products/:id/images` | multipart `file` (+ `alt`) → WebP ≤ 2000 px, random name, `/uploads/<uuid>.webp`. Max 12 photos. 60/15 min |
| PUT | `/admin/products/:id/images/order` | `{ids: [...]}` — the full list, first = main photo |
| PATCH/DELETE | `/admin/products/:id/images/:imageId` | `{alt}` / remove (file deleted) |
| POST | `/admin/products/:id/tryon-image` | multipart `file` → JPEG on white, sets `tryonImageUrl` (old file deleted) |

**Uploads:** ≤ 5 MB, type read from the file bytes (`file-type`: JPEG/PNG/WebP only — name and browser mimetype ignored), decoded + re-encoded with `sharp` (metadata and trailing data dropped), saved to `UPLOAD_DIR` (default `apps/api/uploads`). Served at `/uploads/<uuid>.(webp|jpg)` with `nosniff` — by Nginx in production, by the API in dev (Next rewrites `/uploads`).

**Prices:** products show the price customers pay **now** — a scheduled sale price while a sale runs (`priceCents`, with the normal price in `compareAtCents`, `onSale`, `saleEndsAt`); sale prices apply to buying only. Rentable products include `rent: {priceCents, depositCents, days}`; variants `rentable`. `GET /products?rent=1` lists rentable products only.

**Rentals:** placing an order locks the rented sizes (`SELECT … FOR UPDATE`), re-checks availability and inserts a `rental_bookings` row in the same transaction — two checkouts can't take the last free piece. Cancelling releases the booking and restocks only bought items. `PATCH /admin/orders/:n/status {status:"returned", depositStatus:"refunded"|"kept"}` (delivered → returned, orders with rentals only; deposit outcome required when there is a deposit) frees the piece after 2 cleaning days, emails the customer and is audited. `GET /admin/rentals?view=deliver|out|due|overdue|all&page=` → `{rentals, total, counts}` (admin + MFA).

## Order status flow
```
pending_confirmation ─┬─► confirmed ─► processing ─► ready_to_ship ─► shipped ─► delivered
awaiting_payment ─────┘        (any step before shipped) ─► cancelled
rental orders only:                                                          delivered ─► returned (deposit refunded / kept)
```
