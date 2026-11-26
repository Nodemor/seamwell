/**
 * End-to-end smoke test of the API against a real PostgreSQL database (38 + 18 phase-3 checks):
 * catalogue, guest COD + bank-transfer checkout, tracking, accounts, refresh-token rotation,
 * admin MFA, order status + courier tracking, verified reviews, rate limiting, audit log,
 * bag quotes, idempotent checkout (concurrent double-submit), sold-out handling, saved-address ownership,
 * phase 4: email verification + guest-order linking, forgot/reset password, change password, sessions,
 * phase 5: admin dashboard, order processing + Mark paid, courier templates, CSV export, products, variants, photo uploads,
 * phase 6: reviewable items, guest review with fit + photo, email match, star breakdown.
 *
 * DEVELOPMENT DATABASE ONLY — it creates test users/orders and promotes a per-run owner+<run>@seamwell.lk to admin.
 *   1. npm run db:migrate && npm run db:seed
 *   2. npm run dev:api            (in another terminal)
 *   3. npm run test:e2e -w @seamwell/api
 * Safe to re-run: every account email carries a unique run id, and review/rating checks compare before/after.
 */
import { createHash, randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run the e2e smoke test against production.");
  process.exit(1);
}
const BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:4000/api";
const RUN = Date.now().toString(36); // unique per run → re-runnable on the same dev database
const email = (name, domain = "example.com") => `${name}+${RUN}@${domain}`;
const OWNER = email("owner", "seamwell.lk");
const KASUN = email("kasun");
const ADDR_A = email("addr-a");
const ADDR_B = email("addr-b");
const results = [];
const ok = (name, cond, extra = "") => { results.push([cond ? "PASS" : "FAIL", name, extra]); };

function jar() {
  const cookies = {};
  return {
    header: () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; "),
    store(res) {
      for (const c of res.headers.getSetCookie()) {
        const [kv] = c.split(";");
        const [k, ...v] = kv.split("=");
        const val = v.join("=");
        if (!val || /Expires=Thu, 01 Jan 1970/i.test(c)) delete cookies[k]; else cookies[k] = val;
      }
    },
    cookies,
  };
}
async function call(j, method, path, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", Origin: "http://localhost:3000", ...extraHeaders };
  if (method !== "GET") headers["X-Seamwell-CSRF"] = "1";
  if (j) headers.Cookie = j.header();
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  j?.store(res);
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

// Catalogue
const list = await call(null, "GET", "/products?gender=men&pageSize=48");
ok("list men's products", list.status === 200 && list.data.items.length >= 8, `${list.data.items?.length} items`);
const suit = list.data.items.find((p) => p.slug.includes("navy-two-piece"));
const detail = await call(null, "GET", `/products/${suit.slug}`);
ok("product detail + variants (no raw stock)", detail.status === 200 && detail.data.product.variants.length === 5 && !("stock" in detail.data.product.variants[0]));
const search = await call(null, "GET", "/products?q=%25'%20OR%201=1--");
ok("SQL-ish search returns safely", search.status === 200 && search.data.items.length === 0);
const v = detail.data.product.variants.find((x) => x.inStock);

// Guest checkout with a tampered price
const guest = jar();
const order = await call(guest, "POST", "/orders", {
  customer: { name: "Nimal Perera", email: "nimal@example.com", phone: "0771234567" },
  shippingAddress: { line1: "12 Galle Road", city: "Colombo", district: "Colombo" },
  paymentMethod: "cod",
  items: [{ variantId: v.id, quantity: 1, priceCents: 1 }],
});
ok("guest COD order placed", order.status === 201 && /^SW-/.test(order.data.orderNumber), order.data.orderNumber);
ok("server-side price used (client price ignored)", order.data.totalCents === 6450000 + 0 || order.data.totalCents === 6450000, String(order.data.totalCents));
const bank = await call(null, "POST", "/orders", {
  customer: { name: "Ayesha Fernando", email: "ayesha@example.com", phone: "+94712345678" },
  shippingAddress: { line1: "5 Lake Rd", city: "Kandy", district: "Kandy" },
  paymentMethod: "bank_transfer",
  items: [{ variantId: v.id, quantity: 1 }],
});
ok("bank transfer order → awaiting_payment + bank details", bank.status === 201 && bank.data.status === "awaiting_payment" && !!bank.data.bankTransferDetails);

const track = await call(null, "POST", "/orders/track", { orderNumber: order.data.orderNumber, email: "nimal@example.com" });
ok("guest tracking works", track.status === 200 && track.data.order.status === "pending_confirmation");
const wrong = await call(null, "POST", "/orders/track", { orderNumber: order.data.orderNumber, email: "someone@else.com" });
ok("tracking with wrong email is refused", wrong.status === 404);

// ---------- Phase 3: quote, idempotency, sold-out handling, saved addresses ----------
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const stockOf = async (id) => (await db.query("select stock from product_variants where id = $1", [id])).rows[0].stock;
const unit = detail.data.product.priceCents;
// Use a well-stocked size for these checks (the first size only has 2 and the orders above bought them).
const v3 = detail.data.product.variants.at(-1);
// Every run buys from this size: top its stock up so the script stays re-runnable on the same dev database.
await db.query("update product_variants set stock = greatest(stock, 40) where id = $1", [v3.id]);

const merged = await call(null, "POST", "/orders/quote", { items: [{ variantId: v3.id, quantity: 1, unitPriceCents: 1 }, { variantId: v3.id, quantity: 1 }] });
ok("quote merges duplicate lines and prices on the server", merged.status === 200 && merged.data.quote.lines.length === 1 && merged.data.quote.lines[0].quantity === 2 && merged.data.quote.subtotalCents === unit * 2);

const p3Items = [{ variantId: v3.id, quantity: 1 }];
const p3Body = { customer: { name: "Dilini Jayasinghe", email: "dilini@example.com", phone: "0712345678" }, shippingAddress: { line1: "7 Temple Rd", city: "Galle", district: "Galle", postalCode: "80000" }, paymentMethod: "cod", items: p3Items };
const quoted = await call(null, "POST", "/orders/quote", { items: p3Items });
const stockBefore = await stockOf(v3.id);
const key = crypto.randomUUID();
const [o1, o2] = await Promise.all([call(null, "POST", "/orders", p3Body, { "Idempotency-Key": key }), call(null, "POST", "/orders", p3Body, { "Idempotency-Key": key })]);
const byKey = await db.query("select count(*)::int n from orders where idempotency_key = $1", [key]);
ok("two identical submits at once → ONE order", o1.data?.orderNumber && o1.data.orderNumber === o2.data?.orderNumber && byKey.rows[0].n === 1 && [o1.status, o2.status].sort().join() === "200,201", `${o1.status}/${o2.status} ${o1.data?.orderNumber}`);
ok("…stock decremented exactly once", (await stockOf(v3.id)) === stockBefore - 1);
ok("quoted total equals the final order total", quoted.data.quote.totalCents === o1.data.totalCents && quoted.data.quote.shippingCents === o1.data.shippingCents, `${quoted.data.quote.totalCents} vs ${o1.data.totalCents}`);
const again = await call(null, "POST", "/orders", p3Body, { "Idempotency-Key": key });
ok("a later retry with the same key returns the same order", again.status === 200 && again.data.orderNumber === o1.data.orderNumber && again.data.replayed === true);
const misuse = await call(null, "POST", "/orders", { ...p3Body, customer: { ...p3Body.customer, email: "other@example.com" } }, { "Idempotency-Key": key });
ok("same key with different details is refused", misuse.status === 409);
const badKey = await call(null, "POST", "/orders", p3Body, { "Idempotency-Key": "123" });
ok("malformed Idempotency-Key → 400", badKey.status === 400);
const badDistrict = await call(null, "POST", "/orders", { ...p3Body, shippingAddress: { ...p3Body.shippingAddress, district: "Atlantis" } });
ok("unknown district rejected", badDistrict.status === 400);

// Sold out / not enough stock: clear message, nothing decremented, no order, no stock counts leaked
const scarce = detail.data.product.variants.find((x) => x.id !== v.id && x.id !== v3.id);
const scarceStock = await stockOf(scarce.id);
await db.query("update product_variants set stock = 0 where id = $1", [scarce.id]);
const soldQuote = await call(null, "POST", "/orders/quote", { items: [{ variantId: scarce.id, quantity: 1 }, ...p3Items] });
ok("quote flags a sold-out line and prices the rest", soldQuote.data.quote.unavailable[0]?.reason === "sold_out" && soldQuote.data.quote.lines.length === 1);
const ordersBefore = (await db.query("select count(*)::int n from orders")).rows[0].n;
const soldOrder = await call(null, "POST", "/orders", { ...p3Body, items: [{ variantId: scarce.id, quantity: 1 }, ...p3Items] }, { "Idempotency-Key": crypto.randomUUID() });
ok("ordering a sold-out item → 409 with a clear message", soldOrder.status === 409 && /sold out/i.test(soldOrder.data.error.message));
ok("…no order created and no stock taken", (await db.query("select count(*)::int n from orders")).rows[0].n === ordersBefore && (await stockOf(v3.id)) === stockBefore - 1);
await db.query("update product_variants set stock = 1 where id = $1", [scarce.id]);
const shortQuote = await call(null, "POST", "/orders/quote", { items: [{ variantId: scarce.id, quantity: 2 }] });
ok("not-enough-stock reported without revealing counts", shortQuote.data.quote.unavailable[0]?.reason === "not_enough_stock" && !/"stock"/.test(JSON.stringify(shortQuote.data)));
await db.query("update product_variants set stock = $2 where id = $1", [scarce.id, scarceStock]);

// Saved addresses: ownership enforced on every read / update / delete (two users)
const ua = jar();
const ub = jar();
await call(ua, "POST", "/auth/register", { name: "Amaya Perera", email: ADDR_A, password: "TailorMade2026" });
await call(ub, "POST", "/auth/register", { name: "Bimal Silva", email: ADDR_B, password: "TailorMade2026" });
const a1 = await call(ua, "POST", "/account/addresses", { label: "Home", line1: "1 Lake Drive", city: "Kandy", district: "Kandy" });
ok("first saved address becomes the default", a1.status === 201 && a1.data.address.isDefault === true);
const a2 = await call(ua, "POST", "/account/addresses", { label: "Office", line1: "40 Duplication Rd", city: "Colombo 04", district: "Colombo", isDefault: true });
const listA = await call(ua, "GET", "/account/addresses");
ok("new default replaces the old one (one default)", a2.status === 201 && listA.data.addresses.filter((x) => x.isDefault).length === 1 && listA.data.addresses[0].id === a2.data.address.id);
const bList = await call(ub, "GET", "/account/addresses");
const bPatch = await call(ub, "PATCH", `/account/addresses/${a1.data.address.id}`, { label: "Hacked" });
const bDel = await call(ub, "DELETE", `/account/addresses/${a1.data.address.id}`);
const listA2 = await call(ua, "GET", "/account/addresses");
ok("another user can't list, edit or delete them (404)", bList.data.addresses.length === 0 && bPatch.status === 404 && bDel.status === 404 && listA2.data.addresses.length === 2 && listA2.data.addresses.every((x) => x.label !== "Hacked"));
const injected = await call(ua, "PATCH", `/account/addresses/${a1.data.address.id}`, { label: "Home 2", userId: "00000000-0000-0000-0000-000000000000" });
const ownerCheck = await db.query("select u.email from addresses a join users u on u.id = a.user_id where a.id = $1", [a1.data.address.id]);
ok("userId in the body is ignored (can't re-assign ownership)", injected.status === 200 && ownerCheck.rows[0].email === ADDR_A);
await call(ua, "DELETE", `/account/addresses/${a2.data.address.id}`);
const listA3 = await call(ua, "GET", "/account/addresses");
ok("deleting the default promotes another address", listA3.data.addresses.length === 1 && listA3.data.addresses[0].isDefault === true);
const signedIn = await call(ua, "POST", "/orders", { ...p3Body, customer: { ...p3Body.customer, email: ADDR_A } }, { "Idempotency-Key": crypto.randomUUID() });
const mine = await call(ua, "GET", "/orders/mine");
ok("signed-in order appears in the customer's own orders", signedIn.status === 201 && mine.data.orders.some((o) => o.orderNumber === signedIn.data.orderNumber));

// Customer account
const cust = jar();
const reg = await call(cust, "POST", "/auth/register", { name: "Kasun Silva", email: KASUN, password: "TailorMade2026" });
ok("register sets httpOnly cookies", reg.status === 201 && !!cust.cookies.sw_at && !!cust.cookies.sw_rt);
const me = await call(cust, "GET", "/auth/me");
ok("me works with cookie", me.status === 200 && me.data.user.email === KASUN);
const dup = await call(null, "POST", "/auth/register", { name: "X", email: KASUN, password: "TailorMade2026" });
ok("duplicate email blocked", dup.status === 409);
const custAdmin = await call(cust, "GET", "/admin/orders");
ok("customer can't access admin", custAdmin.status === 403);
// IDOR: another customer's order number gives the same 404 as a made-up one
const othersOrder = await call(cust, "GET", `/orders/mine/${signedIn.data.orderNumber}`);
const madeUp = await call(cust, "GET", "/orders/mine/SW-ZZZZZZ");
ok("customer can't read another customer's order (404, same as unknown)", othersOrder.status === 404 && madeUp.status === 404 && othersOrder.data.error.message === madeUp.data.error.message);
const othersMine = await call(cust, "GET", "/orders/mine");
ok("own order list never includes other customers' orders", othersMine.status === 200 && !othersMine.data.orders.some((o) => o.orderNumber === signedIn.data.orderNumber));

// Refresh rotation + reuse detection
const oldRt = cust.cookies.sw_rt;
const r1 = await call(cust, "POST", "/auth/refresh");
ok("refresh rotates the token", r1.status === 200 && cust.cookies.sw_rt !== oldRt);
const thief = jar(); thief.cookies.sw_rt = oldRt;
const reuse = await call(thief, "POST", "/auth/refresh");
ok("reusing an old refresh token is rejected", reuse.status === 401);
const r2 = await call(cust, "POST", "/auth/refresh");
ok("…and the whole session family is revoked", r2.status === 401);

// Admin with MFA
const adminJ = jar();
await call(adminJ, "POST", "/auth/register", { name: "Shop Owner", email: OWNER, password: "OwnerPass2026" });
await db.query("update users set role='admin' where email=$1", [OWNER]);
await call(adminJ, "POST", "/auth/logout");
const l1 = await call(adminJ, "POST", "/auth/login", { email: OWNER, password: "OwnerPass2026" });
ok("admin login without MFA", l1.status === 200 && l1.data.mfaRequired === false);
const noMfa = await call(adminJ, "GET", "/admin/orders");
ok("admin blocked until MFA is on", noMfa.status === 403 && /two-factor/i.test(noMfa.data.error.message));
ok("…and gets no admin address before two-factor", (await call(adminJ, "GET", "/auth/session")).data.user.adminPath === undefined);
const setup = await call(adminJ, "POST", "/auth/mfa/setup");
const secret = new URL(setup.data.otpauthUri).searchParams.get("secret");
ok("MFA setup returns QR", setup.status === 200 && setup.data.qrDataUrl.startsWith("data:image/png"));
const totp = new TOTP({ secret: Secret.fromBase32(secret) });
const en = await call(adminJ, "POST", "/auth/mfa/enable", { code: totp.generate() });
ok("MFA enabled + 10 recovery codes", en.status === 200 && en.data.recoveryCodes.length === 10);
const enc = await db.query("select mfa_secret_enc from users where email=$1", [OWNER]);
ok("TOTP secret encrypted at rest", !enc.rows[0].mfa_secret_enc.includes(secret));

const fresh = jar();
const l2 = await call(fresh, "POST", "/auth/login", { email: OWNER, password: "OwnerPass2026" });
ok("login now asks for MFA", l2.status === 200 && l2.data.mfaRequired === true && !fresh.cookies.sw_at);
const badCode = await call(fresh, "POST", "/auth/mfa/verify", { mfaToken: l2.data.mfaToken, code: "000000" });
ok("wrong MFA code rejected", badCode.status === 401);
const l3 = await call(fresh, "POST", "/auth/login", { email: OWNER, password: "OwnerPass2026" });
const rc = await call(fresh, "POST", "/auth/mfa/verify", { mfaToken: l3.data.mfaToken, code: en.data.recoveryCodes[0] });
ok("recovery code works once", rc.status === 200);
ok("secret admin address only for an admin who passed two-factor", typeof rc.data.user.adminPath === "string" && typeof (await call(fresh, "GET", "/auth/session")).data.user.adminPath === "string");
const l4 = await call(jar(), "POST", "/auth/login", { email: OWNER, password: "OwnerPass2026" });
const rc2 = await call(jar(), "POST", "/auth/mfa/verify", { mfaToken: l4.data.mfaToken, code: en.data.recoveryCodes[0] });
ok("…and not twice", rc2.status === 401);

const orders = await call(fresh, "GET", "/admin/orders");
ok("admin (with MFA) lists orders", orders.status === 200 && orders.data.orders.length >= 2);
const n = order.data.orderNumber;
const badJump = await call(fresh, "PATCH", `/admin/orders/${n}/status`, { status: "delivered" });
ok("invalid status jump blocked", badJump.status === 400);
for (const s of ["confirmed", "processing", "ready_to_ship"]) await call(fresh, "PATCH", `/admin/orders/${n}/status`, { status: s });
const noTrack = await call(fresh, "PATCH", `/admin/orders/${n}/status`, { status: "shipped" });
ok("shipping requires tracking number", noTrack.status === 400);
const shipped = await call(fresh, "PATCH", `/admin/orders/${n}/status`, { status: "shipped", courierName: "Domex", trackingNumber: "DX-883421", trackingUrl: "https://www.domex.lk/track" });
ok("marked shipped with courier + tracking", shipped.status === 200 && shipped.data.order.trackingNumber === "DX-883421");
const t2 = await call(null, "POST", "/orders/track", { orderNumber: n, email: "nimal@example.com" });
ok("customer sees tracking number + courier link", t2.data.order.status === "shipped" && t2.data.order.trackingUrl === "https://www.domex.lk/track");
const del = await call(fresh, "PATCH", `/admin/orders/${n}/status`, { status: "delivered", note: "Signed by customer" });
ok("delivered (COD marked paid)", del.status === 200 && del.data.order.paymentStatus === "paid");

// Reviews (relative checks so the script can run again on the same database)
const pub0 = await call(null, "GET", `/reviews/product/${suit.id}`);
const ratingBefore = (await call(null, "GET", `/products/${suit.slug}`)).data.product.ratingCount;
const early = await call(null, "POST", "/reviews", { productId: suit.id, rating: 5, body: "Not delivered yet but great", orderNumber: bank.data.orderNumber, email: "ayesha@example.com" });
ok("can't review an undelivered order", early.status === 403);
const rev = await call(null, "POST", "/reviews", { productId: suit.id, rating: 5, title: "Perfect fit", body: "Fits beautifully and the alterations were free. <script>alert(1)</script>", orderNumber: n, email: "nimal@example.com" });
ok("verified guest review accepted as pending", rev.status === 201 && rev.data.status === "pending");
const dupRev = await call(null, "POST", "/reviews", { productId: suit.id, rating: 4, body: "Second review attempt here", orderNumber: n, email: "nimal@example.com" });
ok("one review per product per order", dupRev.status === 409);
const pub1 = await call(null, "GET", `/reviews/product/${suit.id}`);
ok("pending review not public yet", pub1.data.reviews.length === pub0.data.reviews.length);
const pend = await call(fresh, "GET", "/admin/reviews");
const mineRev = pend.data.reviews.find((r) => r.id === rev.data.id) ?? pend.data.reviews.find((r) => /Fits beautifully/.test(r.body ?? ""));
await call(fresh, "PATCH", `/admin/reviews/${mineRev.id}`, { status: "approved" });
const pub2 = await call(null, "GET", `/reviews/product/${suit.id}`);
ok("approved review is public with privacy-safe name", pub2.data.total === pub0.data.total + 1 && pub2.data.reviews.some((r) => r.authorName === "Nimal P."));
const d2 = await call(null, "GET", `/products/${suit.slug}`);
ok("product rating updated", d2.data.product.ratingCount === ratingBefore + 1 && (ratingBefore > 0 || d2.data.product.ratingAvgX100 === 500));

// ---------- Phase 8: home-page testimonials + public shop facts ----------
const recent = await call(null, "GET", "/reviews/recent?limit=20");
ok("recent reviews: approved 4–5★ only, verified, no emails or order ids", recent.status === 200 && recent.data.reviews.length > 0 && recent.data.reviews.every((r) => r.rating >= 4 && r.verified && r.productSlug && !("email" in r) && !("orderId" in r)));
ok("recent reviews include the newly approved one", recent.data.reviews.some((r) => r.id === mineRev.id));
const info = await call(null, "GET", "/shop/info");
ok("shop info: fee + free-delivery threshold, no bank details", info.status === 200 && Number.isInteger(info.data.shippingFeeCents) && Number.isInteger(info.data.freeShippingThresholdCents) && !JSON.stringify(info.data).toLowerCase().includes("account"));

// ---------- Rentals (event-date bookings, deposits, returns) + scheduled sale prices ----------
{
  const nil = (await call(null, "GET", "/products/men-royal-red-nilame-kit")).data.product;
  ok("rentable product shows rent terms, never piece counts", nil.rent?.priceCents > 0 && nil.rent.depositCents >= 0 && nil.variants.every((v) => "rentable" in v && !("rentStock" in v) && !("stock" in v)));
  const rv = nil.variants.find((v) => v.size === "46") ?? nil.variants.at(-1);
  // One rental piece of this size for the test (restored at the end), so availability is deterministic.
  const prevRentStock = (await db.query("select rent_stock from product_variants where id = $1", [rv.id])).rows[0].rent_stock;
  await db.query("update product_variants set rent_stock = 1, stock = greatest(stock, 20) where id = $1", [rv.id]);
  // Release bookings left by earlier runs of THIS script (its own test emails only) so the dates stay free.
  await db.query("update rental_bookings set status = 'released' where variant_id = $1 and order_id in (select id from orders where email in ('rent@example.com', 'race1@example.com', 'race2@example.com'))", [rv.id]);
  const iso = (d) => d.toISOString().slice(0, 10);
  const plus = (s, n) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * 86_400_000));
  const cal0 = (await call(null, "GET", `/products/men-royal-red-nilame-kit/rent-calendar?variantId=${rv.id}`)).data;
  ok("rent calendar: first bookable day is 3 days ahead", cal0.rentable === true && cal0.first === plus(iso(new Date(Date.now() + 5.5 * 3_600_000)), 3));
  // A free stretch for this run (earlier runs leave bookings behind on the dev database)
  let E = plus(cal0.first, 30);
  while ([...Array(40).keys()].some((k) => cal0.unavailable.includes(plus(E, k - 10)))) E = plus(E, 41);
  // Each checkout from its own forwarded IP so the per-IP checkout rate limit doesn't trip mid-test.
  let ipN = 0;
  const ip = () => ({ "Idempotency-Key": crypto.randomUUID(), "X-Forwarded-For": `10.77.${Math.floor(Math.random() * 200)}.${++ipN}` });
  const rentBody = (items, email = "rent@example.com") => ({ customer: { name: "Kasun Bandara", email, phone: "0771234567" }, shippingAddress: { line1: "12 Temple Rd", city: "Kandy", district: "Kandy", postalCode: "20000" }, paymentMethod: "cod", items });

  const q = await call(null, "POST", "/orders/quote", { items: [{ variantId: rv.id, quantity: 1, mode: "rent", eventDate: E }] });
  const ql = q.data.quote.lines[0];
  ok("rental quote: rent price + deposit + delivery/collection dates", q.status === 200 && ql.mode === "rent" && ql.unitPriceCents === nil.rent.priceCents && ql.depositCents === nil.rent.depositCents && ql.deliverOn === plus(E, -2) && ql.returnOn === plus(E, nil.rent.days - 3));
  ok("deposit is added to the total (and doesn't count toward free delivery)", q.data.quote.depositCents === nil.rent.depositCents && q.data.quote.totalCents === q.data.quote.subtotalCents + q.data.quote.shippingCents + q.data.quote.depositCents);
  const spoofed = await call(null, "POST", "/orders/quote", { items: [{ variantId: rv.id, quantity: 1, mode: "rent", eventDate: E, unitPriceCents: 1, depositCents: 0 }] });
  ok("client can't set rent price or deposit", spoofed.data.quote.lines[0].unitPriceCents === nil.rent.priceCents && spoofed.data.quote.lines[0].depositCents === nil.rent.depositCents);

  const tooSoon = await call(null, "POST", "/orders", rentBody([{ variantId: rv.id, quantity: 1, mode: "rent", eventDate: plus(cal0.first, -2) }]), ip());
  ok("event date needs 3 days' notice", tooSoon.status === 400 && /notice/.test(tooSoon.data.error.message));
  const noDate = await call(null, "POST", "/orders/quote", { items: [{ variantId: rv.id, quantity: 1, mode: "rent" }] });
  ok("rental without an event date → 400", noDate.status === 400);
  const tweed = (await call(null, "GET", "/products/men-grey-tweed-blazer")).data.product;
  const notRentable = await call(null, "POST", "/orders", rentBody([{ variantId: tweed.variants[0].id, quantity: 1, mode: "rent", eventDate: E }]), ip());
  ok("renting a product that isn't for rent → 409", notRentable.status === 409 && /can't be rented/.test(notRentable.data.error.message));

  const buyStockBefore = (await db.query("select stock from product_variants where id = $1", [rv.id])).rows[0].stock;
  const A = await call(null, "POST", "/orders", rentBody([{ variantId: rv.id, quantity: 1, mode: "rent", eventDate: E }]), ip());
  if (A.status !== 201) console.log("RENTAL ORDER FAILED:", A.status, JSON.stringify(A.data).slice(0, 400));
  ok("rental order placed (deposit held)", A.status === 201 && A.data.depositCents === nil.rent.depositCents && A.data.items[0].mode === "rent" && A.data.items[0].eventDate === E);
  const booking = (await db.query("select b.start_date::text s, b.end_date::text e, b.status from rental_bookings b join orders o on o.id = b.order_id where o.order_number = $1", [A.data.orderNumber])).rows[0];
  ok("booking covers delivery → collection + 2 cleaning days", booking && booking.s === plus(E, -2) && booking.e === plus(E, nil.rent.days - 3 + 2) && booking.status === "active");
  ok("renting doesn't touch stock for sale", (await db.query("select stock from product_variants where id = $1", [rv.id])).rows[0].stock === buyStockBefore);
  const cal1 = (await call(null, "GET", `/products/men-royal-red-nilame-kit/rent-calendar?variantId=${rv.id}`)).data;
  ok("calendar now blocks the booked dates (and nearby event dates)", cal1.unavailable.includes(E) && cal1.unavailable.includes(plus(E, 3)) && !cal1.unavailable.includes(plus(E, 12)));
  const overlap = await call(null, "POST", "/orders", rentBody([{ variantId: rv.id, quantity: 1, mode: "rent", eventDate: plus(E, 3) }]), ip());
  ok("overlapping rental refused (409, no booking counts revealed)", overlap.status === 409 && /already booked/.test(overlap.data.error.message) && !/\d+ (left|pieces)/.test(overlap.data.error.message));
  const buyIt = await call(null, "POST", "/orders/quote", { items: [{ variantId: rv.id, quantity: 1 }] });
  ok("the same size can still be bought", buyIt.data.quote.lines.length === 1 && buyIt.data.quote.lines[0].mode === "buy");

  // Two checkouts racing for the last free piece on another date: exactly one wins
  const F = plus(E, 20);
  const race = await Promise.all([1, 2].map((i) => call(null, "POST", "/orders", rentBody([{ variantId: rv.id, quantity: 1, mode: "rent", eventDate: F }], `race${i}@example.com`), ip())));
  ok("simultaneous rentals of the last piece: one 201, one 409", race.map((r) => r.status).sort().join(",") === "201,409");
  if (!race.some((r) => r.status === 201)) console.log("RACE:", race.map((r) => r.status + " " + JSON.stringify(r.data).slice(0, 200)).join(" | "));
  const winner = race.find((r) => r.status === 201)?.data.orderNumber;
  await call(fresh, "PATCH", `/admin/orders/${winner}/status`, { status: "cancelled", note: "test" });
  const cal2 = (await call(null, "GET", `/products/men-royal-red-nilame-kit/rent-calendar?variantId=${rv.id}`)).data;
  ok("cancelling a rental frees its dates", !cal2.unavailable.includes(F) && (await db.query("select b.status from rental_bookings b join orders o on o.id = b.order_id where o.order_number = $1", [winner])).rows[0].status === "released");

  // Admin: rentals board + returning the outfit
  const board = await call(fresh, "GET", "/admin/rentals?view=all");
  ok("admin rentals board lists the rental", board.status === 200 && board.data.rentals.some((r) => r.orderNumber === A.data.orderNumber && r.eventDate === E) && typeof board.data.counts.overdue === "number");
  ok("rentals board is admin-only", (await call(null, "GET", "/admin/rentals")).status === 401 && [401, 403].includes((await call(cust, "GET", "/admin/rentals")).status));
  const an = A.data.orderNumber;
  ok("can't jump straight to returned", (await call(fresh, "PATCH", `/admin/orders/${an}/status`, { status: "returned", depositStatus: "refunded" })).status === 400);
  for (const s of ["confirmed", "processing", "ready_to_ship"]) await call(fresh, "PATCH", `/admin/orders/${an}/status`, { status: s });
  await call(fresh, "PATCH", `/admin/orders/${an}/status`, { status: "shipped", courierName: "Pronto Lanka", trackingNumber: "RENT123" });
  await call(fresh, "PATCH", `/admin/orders/${an}/status`, { status: "delivered" });
  const noDeposit = await call(fresh, "PATCH", `/admin/orders/${an}/status`, { status: "returned" });
  ok("returning needs the deposit outcome", noDeposit.status === 400 && /deposit/i.test(noDeposit.data.error.message));
  const ret = await call(fresh, "PATCH", `/admin/orders/${an}/status`, { status: "returned", depositStatus: "refunded" });
  ok("marked returned with deposit refunded", ret.status === 200 && ret.data.order.status === "returned" && ret.data.order.depositStatus === "refunded" && !!ret.data.order.returnedAt);
  const after = (await db.query("select b.end_date::text e, b.status from rental_bookings b join orders o on o.id = b.order_id where o.order_number = $1", [an])).rows[0];
  ok("returned piece is free again after cleaning (from today) — or released if returned before its dates", after.status === "released" || after.e === plus(iso(new Date(Date.now() + 5.5 * 3_600_000)), 2));
  const audited = await db.query("select meta from audit_logs where action = 'order.status_changed' and meta->>'orderNumber' = $1 and meta->>'to' = 'returned'", [an]);
  ok("return + deposit outcome audited", audited.rows[0]?.meta?.deposit === "refunded");
  // A purchase-only order can't be "returned"
  const buyOnly = await call(null, "POST", "/orders", { ...rentBody([{ variantId: v3.id, quantity: 1 }]) }, ip());
  const bn = buyOnly.data.orderNumber;
  for (const s of ["confirmed", "processing", "ready_to_ship"]) await call(fresh, "PATCH", `/admin/orders/${bn}/status`, { status: s });
  await call(fresh, "PATCH", `/admin/orders/${bn}/status`, { status: "shipped", courierName: "Pronto Lanka", trackingNumber: "BUY123" });
  await call(fresh, "PATCH", `/admin/orders/${bn}/status`, { status: "delivered" });
  const badReturn = await call(fresh, "PATCH", `/admin/orders/${bn}/status`, { status: "returned", depositStatus: "refunded" });
  ok("only orders with rentals can be marked returned", badReturn.status === 400 && /rented/.test(badReturn.data.error.message));
  await db.query("update product_variants set rent_stock = $2 where id = $1", [rv.id, prevRentStock]);

  // Scheduled sale price: charged while the sale runs, normal price after it ends
  const tv = tweed.variants.find((v) => v.priceOverrideCents == null) ?? tweed.variants[0];
  await db.query("update product_variants set stock = greatest(stock, 20) where id = $1", [tv.id]);
  const sale = await db.query("select price_cents, sale_price_cents, sale_starts_at, sale_ends_at from products where slug = 'men-grey-tweed-blazer'");
  const sp = sale.rows[0];
  await db.query("update products set sale_price_cents = $2, sale_starts_at = now() - interval '1 day', sale_ends_at = now() + interval '1 day' where slug = $1", ["men-grey-tweed-blazer", sp.price_cents - 500000]);
  const onSale = await call(null, "POST", "/orders/quote", { items: [{ variantId: tv.id, quantity: 1 }] });
  const pub = (await call(null, "GET", "/products/men-grey-tweed-blazer")).data.product;
  ok("sale price charged while the sale runs (normal price shown crossed out)", onSale.data.quote.lines[0].unitPriceCents === sp.price_cents - 500000 && pub.onSale === true && pub.compareAtCents === sp.price_cents && !("salePriceCents" in pub));
  await db.query("update products set sale_ends_at = now() - interval '1 minute' where slug = $1", ["men-grey-tweed-blazer"]);
  const ended = await call(null, "POST", "/orders/quote", { items: [{ variantId: tv.id, quantity: 1 }] });
  ok("normal price again once the sale has ended", ended.data.quote.lines[0].unitPriceCents === sp.price_cents && (await call(null, "GET", "/products/men-grey-tweed-blazer")).data.product.onSale === false);
  await db.query("update products set sale_price_cents = $2, sale_starts_at = $3, sale_ends_at = $4 where slug = $1", ["men-grey-tweed-blazer", sp.sale_price_cents, sp.sale_starts_at, sp.sale_ends_at]);
  const rentFilter = await call(null, "GET", "/products?rent=1&pageSize=48");
  ok("'available to rent' filter", rentFilter.status === 200 && rentFilter.data.items.length > 0 && rentFilter.data.items.every((p) => p.rent));
}

// ---------- Phase 4: email verification, guest-order linking, password reset/change, sessions ----------
// Emailed tokens can't be read back from the DB (only hashes are stored), so the test mints its own
// token rows exactly like the API does (32 random bytes → base64url, sha256 stored) and redeems them over HTTP.
const mint = async (userId, purpose, ttlMs) => {
  const token = randomBytes(32).toString("base64url");
  await db.query("insert into auth_tokens (user_id, purpose, token_hash, expires_at) values ($1, $2, $3, $4)", [userId, purpose, createHash("sha256").update(token).digest("hex"), new Date(Date.now() + ttlMs)]);
  return token;
};
const DILANI = email("dilani");
const PW1 = "Tailored2026x";
const PW2 = "Measured2027y";
const PW3 = "Stitched2028z";
const acct1 = jar();
const reg4 = await call(acct1, "POST", "/auth/register", { name: "Dilani Fernando", email: DILANI, password: PW1 });
ok("register → signed in, email not yet verified", reg4.status === 201 && reg4.data.user.emailVerified === false);
const dilaniId = reg4.data.user.id;
const sentVerify = await db.query("select count(*)::int n from auth_tokens where user_id = $1 and purpose = 'email_verify' and used_at is null", [dilaniId]);
ok("register issues a verification token (stored hashed)", sentVerify.rows[0].n === 1);

// A guest order placed earlier with the same email (inserted directly: the checkout limiter is spent above)
const guestNo = `SW-${RUN.slice(-6).toUpperCase().padStart(6, "Q")}`;
await db.query(
  `insert into orders (order_number, email, customer_name, phone, address_line1, city, district, payment_method, subtotal_cents, shipping_cents, total_cents)
   values ($1, $2, 'Dilani Fernando', '0771234567', '5 Flower Road', 'Colombo 07', 'Colombo', 'cod', 1000000, 45000, 1045000)`,
  [guestNo, DILANI],
);
const mineBefore = await call(acct1, "GET", "/orders/mine");
ok("unverified account does NOT see guest orders", mineBefore.status === 200 && !mineBefore.data.orders.some((o) => o.orderNumber === guestNo));

const expiredVerify = await mint(dilaniId, "email_verify", -60_000);
ok("expired verification link is refused", (await call(null, "POST", "/auth/email/verify", { token: expiredVerify })).status === 400);
const wrongPurpose = await mint(dilaniId, "password_reset", 30 * 60_000);
ok("a reset token can't verify an email", (await call(null, "POST", "/auth/email/verify", { token: wrongPurpose })).status === 400);
const verifyTok = await mint(dilaniId, "email_verify", 60_000);
const ver = await call(null, "POST", "/auth/email/verify", { token: verifyTok }); // from another browser — the link alone is enough
ok("verification link works (guest order attached)", ver.status === 200 && ver.data.attachedOrders === 1, JSON.stringify(ver.data));
ok("verification link is single-use", (await call(null, "POST", "/auth/email/verify", { token: verifyTok })).status === 400);
const mineAfter = await call(acct1, "GET", "/orders/mine");
ok("guest order appears in the account after verification", mineAfter.data.orders.some((o) => o.orderNumber === guestNo));
const myGuest = await call(acct1, "GET", `/orders/mine/${guestNo}`);
ok("…and opens with its status timeline", myGuest.status === 200 && Array.isArray(myGuest.data.order.history));
ok("session reports the email as verified", (await call(acct1, "GET", "/auth/session")).data.user.emailVerified === true);
ok("customers never get the admin address", !("adminPath" in (await call(acct1, "GET", "/auth/session")).data.user));

// Forgot password: identical answer for real and unknown emails
const fpReal = await call(null, "POST", "/auth/password/forgot", { email: DILANI });
const fpFake = await call(null, "POST", "/auth/password/forgot", { email: email("nobody") });
ok("forgot-password: same response for existing and unknown emails", fpReal.status === 200 && fpFake.status === 200 && JSON.stringify(fpReal.data) === JSON.stringify(fpFake.data));
await new Promise((r) => setTimeout(r, 1500)); // the reset email is sent after the response
const issued = await db.query("select count(*)::int n from auth_tokens where user_id = $1 and purpose = 'password_reset' and used_at is null", [dilaniId]);
ok("forgot-password issued one live reset link (older links revoked)", issued.rows[0].n === 1);

// Reset password
const acct2 = jar(); // a second device, signed in
ok("second device signs in", (await call(acct2, "POST", "/auth/login", { email: DILANI, password: PW1 })).status === 200);
const expiredReset = await mint(dilaniId, "password_reset", -1000);
ok("expired reset link is refused", (await call(null, "POST", "/auth/password/reset", { token: expiredReset, password: PW2 })).status === 400);
const resetTok = await mint(dilaniId, "password_reset", 30 * 60_000);
const weak = await call(null, "POST", "/auth/password/reset", { token: resetTok, password: "password1234" });
ok("reset rejects a common password without burning the link", weak.status === 400);
const reset = await call(null, "POST", "/auth/password/reset", { token: resetTok, password: PW2 });
ok("reset link sets the new password", reset.status === 200);
ok("reset link is single-use", (await call(null, "POST", "/auth/password/reset", { token: resetTok, password: PW3 })).status === 400);
ok("reset signs out every existing session", (await call(acct1, "POST", "/auth/refresh")).status === 401 && (await call(acct2, "POST", "/auth/refresh")).status === 401);
ok("old password no longer works", (await call(jar(), "POST", "/auth/login", { email: DILANI, password: PW1 })).status === 401);

// Change password (signed in) + sessions
const acct3 = jar();
const acct4 = jar();
ok("new password works", (await call(acct3, "POST", "/auth/login", { email: DILANI, password: PW2 })).status === 200);
await call(acct4, "POST", "/auth/login", { email: DILANI, password: PW2 });
const sess = await call(acct3, "GET", "/auth/sessions");
ok("sessions list shows this device and the other one", sess.status === 200 && sess.data.sessions.length >= 2 && sess.data.sessions.filter((s) => s.current).length === 1 && !("tokenHash" in sess.data.sessions[0]));
const badChange = await call(acct3, "POST", "/auth/password/change", { currentPassword: "not-my-password-1", newPassword: PW3 });
ok("change password needs the current password", badChange.status === 400 && badChange.data.error.details?.[0]?.path === "currentPassword");
const change = await call(acct3, "POST", "/auth/password/change", { currentPassword: PW2, newPassword: PW3 });
ok("change password works", change.status === 200);
ok("…signs out the other device", (await call(acct4, "POST", "/auth/refresh")).status === 401);
ok("…and keeps this device signed in", (await call(acct3, "POST", "/auth/refresh")).status === 200);
const revoke = await call(acct3, "POST", "/auth/sessions/revoke-all");
ok("sign out everywhere", revoke.status === 204 && (await call(acct3, "POST", "/auth/refresh")).status === 401);
const audit4 = await db.query("select action from audit_logs where actor_id = $1", [dilaniId]);
const acts = new Set(audit4.rows.map((r) => r.action));
ok("account events are audited", ["auth.email_verified", "orders.guest_attached", "auth.password_reset", "auth.password_changed", "auth.signed_out_everywhere"].every((a) => acts.has(a)), [...acts].join(","));

// ---------- Phase 5: admin dashboard, order processing, couriers, CSV, products & photos ----------
const sharp = (await import("sharp")).default;
const ORIGIN = BASE.replace(/\/api$/, "");
async function upload(j, path, buffer, filename, contentType, extra = {}) {
  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: contentType }), filename);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const res = await fetch(BASE + path, { method: "POST", headers: { Origin: "http://localhost:3000", "X-Seamwell-CSRF": "1", Cookie: j.header() }, body: fd });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
const adm = fresh;
await call(adm, "POST", "/auth/refresh"); // fresh access token, still MFA-verified
const custOnly = jar();
await call(custOnly, "POST", "/auth/register", { name: "Plain Customer", email: email("plain"), password: "Tailored2026x" });
ok("customers can't open the admin API", (await call(custOnly, "GET", "/admin/dashboard")).status === 403);

const dash = await call(adm, "GET", "/admin/dashboard");
ok("dashboard numbers", dash.status === 200 && typeof dash.data.toShip === "number" && Array.isArray(dash.data.lowStock) && typeof dash.data.today.orders === "number");

// A bank-transfer order to process end-to-end (inserted: the checkout limiter is spent above)
const bankNo = `SW-B${RUN.slice(-5).toUpperCase().padStart(5, "Z")}`;
const bankEmail = email("bankflow");
const ins = await db.query(
  `insert into orders (order_number, email, customer_name, phone, address_line1, city, district, payment_method, status, subtotal_cents, shipping_cents, total_cents)
   values ($1, $2, '=HYPERLINK("http://evil")', '0779876543', '22 Temple Road', 'Kandy', 'Kandy', 'bank_transfer', 'awaiting_payment', 6450000, 0, 6450000) returning id`,
  [bankNo, bankEmail],
);
await db.query("insert into order_items (order_id, product_id, variant_id, product_name, size, unit_price_cents, quantity) values ($1, $2, $3, $4, '40', 6450000, 1)", [ins.rows[0].id, suit.id, v3.id, suit.name]);
const found = await call(adm, "GET", `/admin/orders?q=${bankNo.slice(-5)}`);
ok("orders board search by order number", found.status === 200 && found.data.orders.some((o) => o.orderNumber === bankNo));
const byPhone = await call(adm, "GET", "/admin/orders?q=077%20987%206543");
ok("orders board search by phone", byPhone.data.orders.some((o) => o.orderNumber === bankNo));
const full = await call(adm, "GET", `/admin/orders/${bankNo}`);
ok("order detail has contact + address", full.status === 200 && full.data.order.customer.phone === "0779876543" && full.data.order.address.district === "Kandy");
ok("can't confirm a bank transfer before it's paid", (await call(adm, "PATCH", `/admin/orders/${bankNo}/status`, { status: "confirmed" })).status === 400);
ok("invalid transition rejected (awaiting payment → shipped)", (await call(adm, "PATCH", `/admin/orders/${bankNo}/status`, { status: "shipped", courierName: "Domex", trackingNumber: "X1" })).status === 400);
const paid = await call(adm, "PATCH", `/admin/orders/${bankNo}/status`, { status: "confirmed", paymentStatus: "paid", note: "Transfer received" });
ok("Mark paid: awaiting_payment → confirmed + paid", paid.status === 200 && paid.data.order.status === "confirmed" && paid.data.order.paymentStatus === "paid");

// Couriers: a template fills in the tracking link when shipping
ok("courier template must be https with {tracking}", (await call(adm, "PUT", "/admin/settings/couriers", { templates: { pronto: "http://pronto.lk/{tracking}" } })).status === 400);
const savedCouriers = await call(adm, "PUT", "/admin/settings/couriers", { templates: { pronto: "https://track.pronto.example/?no={tracking}" } });
ok("courier settings saved", savedCouriers.status === 200 && savedCouriers.data.templates.pronto.includes("{tracking}") && savedCouriers.data.templates.domex === "");
for (const s of ["processing", "ready_to_ship"]) await call(adm, "PATCH", `/admin/orders/${bankNo}/status`, { status: s });
const ship2 = await call(adm, "PATCH", `/admin/orders/${bankNo}/status`, { status: "shipped", courierName: "Pronto", trackingNumber: "PR-5501" });
ok("shipping auto-fills the tracking link from the courier template", ship2.status === 200 && ship2.data.order.trackingUrl === "https://track.pronto.example/?no=PR-5501", ship2.data.order?.trackingUrl);
const trackBank = await call(null, "POST", "/orders/track", { orderNumber: bankNo, email: bankEmail });
ok("customer tracking shows every step", trackBank.data.order.history.map((h) => h.status).join(">") === "confirmed>processing>ready_to_ship>shipped");
const deliv = await call(adm, "PATCH", `/admin/orders/${bankNo}/status`, { status: "delivered" });
ok("delivered", deliv.status === 200 && deliv.data.order.status === "delivered");
ok("delivered orders can't move again", (await call(adm, "PATCH", `/admin/orders/${bankNo}/status`, { status: "cancelled" })).status === 400);

// CSV export
const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const csvRes = await fetch(`${BASE}/admin/orders/export.csv?from=${today}&to=${today}`, { headers: { Cookie: adm.header() } });
const csv = await csvRes.text();
ok("CSV export downloads", csvRes.status === 200 && /text\/csv/.test(csvRes.headers.get("content-type")) && /attachment/.test(csvRes.headers.get("content-disposition")));
ok("CSV neutralises formula cells", csv.includes(`"'=HYPERLINK(""http://evil"")"`) && !csv.includes(`,=HYPERLINK`));

// Products & photos
const cats = await call(null, "GET", "/products/categories");
const blazers = cats.data.categories.find((c) => c.slug === "blazers" && c.gender === "men");
const prodBody = { name: `E2E Linen Blazer ${RUN}`, categoryId: blazers.id, gender: "men", priceCents: 2950000, tryonSlot: "blazer", description: "Test product", isActive: true };
const created = await call(adm, "POST", "/admin/products", prodBody);
ok("create product", created.status === 201 && created.data.product.slug === `e2e-linen-blazer-${RUN}`);
const pid = created.data.product.id;
const dupe = await call(adm, "POST", "/admin/products", prodBody);
ok("same name gets a unique slug", dupe.status === 201 && dupe.data.product.slug === `e2e-linen-blazer-${RUN}-2`);
ok("'was' price below price rejected", (await call(adm, "PATCH", `/admin/products/${pid}`, { compareAtCents: 100 })).status === 400);
const sku = `E2E-${RUN}`.toUpperCase();
const va = await call(adm, "POST", `/admin/products/${pid}/variants`, { size: "40", sku, stock: 2 });
ok("add size with stock", va.status === 201);
ok("duplicate SKU rejected", (await call(adm, "POST", `/admin/products/${dupe.data.product.id}/variants`, { size: "42", sku, stock: 1 })).status === 400);
ok("update stock", (await call(adm, "PATCH", `/admin/products/${pid}/variants/${va.data.variant.id}`, { stock: 7 })).status === 200);

const png = await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#1f2a44" } }).png().toBuffer();
const jpg = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#b08d57" } }).jpeg().toBuffer();
ok("upload rejects a .php renamed to .jpg", (await upload(adm, `/admin/products/${pid}/images`, Buffer.from("<?php echo 1; ?>"), "shell.jpg", "image/jpeg")).status === 400);
ok("upload over 5 MB refused (413)", (await upload(adm, `/admin/products/${pid}/images`, Buffer.concat([jpg, Buffer.alloc(5 * 1024 * 1024 + 10)]), "big.jpg", "image/jpeg")).status === 413);
// Polyglot: a real JPEG with PHP appended — accepted as an image, but re-encoding throws the payload away
const poly = await upload(adm, `/admin/products/${pid}/images`, Buffer.concat([jpg, Buffer.from("<?php system($_GET['c']); ?>")]), "poly.php.jpg", "image/jpeg");
const polyBytes = poly.status === 201 ? Buffer.from(await (await fetch(ORIGIN + poly.data.image.url)).arrayBuffer()) : Buffer.alloc(0);
ok("image with a hidden PHP payload is re-encoded clean", poly.status === 201 && polyBytes.length > 0 && !polyBytes.includes("<?php") && /.webp$/.test(poly.data.image.url));
if (poly.status === 201) await call(adm, "DELETE", `/admin/products/${pid}/images/${poly.data.image.id}`);
const im1 = await upload(adm, `/admin/products/${pid}/images`, png, "front.png", "image/png", { alt: "Front view" });
const im2 = await upload(adm, `/admin/products/${pid}/images`, jpg, "back.jpg", "image/jpeg");
ok("photo uploads re-encoded to WebP with random names", im1.status === 201 && /^\/uploads\/[0-9a-f-]{36}\.webp$/.test(im1.data.image.url) && im2.status === 201, im1.data?.image?.url);
const served = await fetch(ORIGIN + im1.data.image.url);
ok("uploaded photo served with nosniff", served.status === 200 && served.headers.get("content-type") === "image/webp" && served.headers.get("x-content-type-options") === "nosniff");
ok("only our own upload names are served", (await fetch(ORIGIN + "/uploads/../.env")).status === 404 && (await fetch(ORIGIN + "/uploads/x.php")).status === 404);
ok("reorder photos", (await call(adm, "PUT", `/admin/products/${pid}/images/order`, { ids: [im2.data.image.id, im1.data.image.id] })).status === 200);
const tryUp = await upload(adm, `/admin/products/${pid}/tryon-image`, png, "garment.png", "image/png");
ok("try-on photo saved as JPEG", tryUp.status === 200 && /\.jpg$/.test(tryUp.data.tryonImageUrl));
const pub = await call(null, "GET", `/products/${created.data.product.slug}`);
ok("public product shows reordered photos + try-on photo", pub.status === 200 && pub.data.product.images[0].url === im2.data.image.url && pub.data.product.tryonImageUrl === tryUp.data.tryonImageUrl);
ok("delete photo removes the file", (await call(adm, "DELETE", `/admin/products/${pid}/images/${im1.data.image.id}`)).status === 204 && (await fetch(ORIGIN + im1.data.image.url)).status === 404);
ok("archive hides the product from the shop", (await call(adm, "PATCH", `/admin/products/${pid}`, { isActive: false })).status === 200 && (await call(null, "GET", `/products/${created.data.product.slug}`)).status === 404);
await call(adm, "PATCH", `/admin/products/${dupe.data.product.id}`, { isActive: false });
const auditP = await call(adm, "GET", "/admin/audit?action=product.");
ok("admin actions in the audit log", auditP.status === 200 && ["product.created", "product.image_added", "product.tryon_photo_set", "product.archived"].every((a) => auditP.data.entries.some((e) => e.action === a)));

// ---------- Phase 6: reviewable items, guest review with fit + photo, breakdown ----------
// (Review POSTs are limited to 5/hour per IP: the earlier review checks use 3, these use 2.)
const tr6 = await call(null, "POST", "/orders/track", { orderNumber: bankNo, email: bankEmail });
ok("delivered order lists reviewable items", tr6.data.order.reviewable.some((r) => r.productId === suit.id && r.slug === suit.slug));
const notDelivered = await call(null, "POST", "/orders/track", { orderNumber: bank.data.orderNumber, email: "ayesha@example.com" });
ok("undelivered order has nothing to review", Array.isArray(notDelivered.data.order.reviewable) && notDelivered.data.order.reviewable.length === 0);
const wrongEmail = await call(null, "POST", "/reviews", { productId: suit.id, rating: 4, body: "Lovely suit, fits well.", orderNumber: bankNo, email: "someone-else@example.com" });
ok("guest review needs the order's email", wrongEmail.status === 403);
const photo = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#4a3324" } }).jpeg().toBuffer();
const fd6 = new FormData();
fd6.append("data", JSON.stringify({ productId: suit.id, rating: 4, title: "Great for weddings", body: "Sleeves needed a small alteration, otherwise perfect.", fit: "small", orderNumber: bankNo, email: bankEmail }));
fd6.append("file", new Blob([photo], { type: "image/jpeg" }), "me.jpg");
const rv6Res = await fetch(BASE + "/reviews", { method: "POST", headers: { Origin: "http://localhost:3000", "X-Seamwell-CSRF": "1" }, body: fd6 });
const rv6 = { status: rv6Res.status, data: await rv6Res.json() };
ok("guest review with fit + photo accepted (pending)", rv6.status === 201 && rv6.data.status === "pending", JSON.stringify(rv6.data));
const tr6b = await call(null, "POST", "/orders/track", { orderNumber: bankNo, email: bankEmail });
ok("reviewed item leaves the reviewable list", !tr6b.data.order.reviewable.some((r) => r.productId === suit.id));
const before6 = await call(null, "GET", `/reviews/product/${suit.id}`);
const queued = await call(adm, "GET", "/admin/reviews");
const mine6 = queued.data.reviews.find((r) => r.id === rv6.data.id);
ok("admin queue shows fit + photo", mine6?.fit === "small" && /^\/uploads\/[0-9a-f-]{36}\.webp$/.test(mine6?.photoUrl ?? ""));
ok("pending photo not public yet", !before6.data.reviews.some((r) => r.id === rv6.data.id));
await call(adm, "PATCH", `/admin/reviews/${rv6.data.id}`, { status: "approved" });
const after6 = await call(null, "GET", `/reviews/product/${suit.id}`);
const shown = after6.data.reviews.find((r) => r.id === rv6.data.id);
ok("approved review public with photo, fit and verified badge", shown?.photoUrl === mine6.photoUrl && shown?.fit === "small" && shown?.verified === true && !shown?.authorName.includes("@"));
ok("star breakdown + fit summary", after6.data.breakdown["4"] === before6.data.breakdown["4"] + 1 && after6.data.fit.small === before6.data.fit.small + 1 && after6.data.total === before6.data.total + 1);
ok("reviews are paginated", after6.data.pageSize === 6 && after6.data.reviews.length <= 6);

// Rate limit on login
let last;
for (let i = 0; i < 12; i++) last = await call(null, "POST", "/auth/login", { email: "brute@example.com", password: "wrong" + i });
ok("login brute-force rate limited", last.status === 429);

const audit = await db.query("select action, count(*)::int n from audit_logs group by action order by action");
ok("audit log records security events", audit.rows.length >= 5, audit.rows.map((r) => `${r.action}:${r.n}`).join(", "));
await db.end();

for (const r of results) console.log(r[0], "-", r[1], r[2] ? `(${r[2]})` : "");
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
