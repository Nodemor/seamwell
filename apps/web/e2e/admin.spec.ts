import { expect, test, type Page } from "@playwright/test";
import { ADMIN } from "./admin-path";
import { api, customer, testDb, totpFor, watchConsole } from "./helpers";

/**
 * Admin journey on the LOCAL TEST database: an admin with two-factor signs in, takes a guest order through to
 * "shipped" with a courier + tracking number, the customer sees the tracking number, reviews the delivered
 * item, and the admin approves the review so it appears on the product page. Desktop only.
 */
test.skip(!!process.env.E2E_BASE_URL, "admin journey needs the local test database (run without E2E_BASE_URL)");
test.setTimeout(240_000);

const SLUG = "men-grey-tweed-blazer";

/** Wait until the authenticator shows a code we haven't used yet (the API refuses a code twice). */
async function freshCode(totp: ReturnType<typeof totpFor>, used: Set<string>) {
  for (;;) {
    const code = totp.generate();
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function placeGuestOrder(page: Page, email: string) {
  const { data } = await api<{ product: { variants: { id: string; inStock?: boolean; available?: boolean }[] } }>(page, "GET", `/products/${SLUG}`);
  const variant = data.product.variants[0]!;
  const res = await api<{ orderNumber: string }>(page, "POST", "/orders", {
    customer: { name: "Kasun Review", email, phone: "0712345678" },
    shippingAddress: { line1: "45 Temple Road", city: "Kandy", district: "Kandy" },
    paymentMethod: "cod",
    items: [{ variantId: variant.id, quantity: 1 }],
  });
  expect(res.status, JSON.stringify(res.data)).toBe(201);
  return res.data.orderNumber;
}

test("admin with 2FA ships an order with tracking; customer reviews; admin approves", async ({ page }) => {
  const watch = watchConsole(page);
  const db = await testDb();
  try {
    const c = customer();
    await page.goto("/");
    const orderNumber = await placeGuestOrder(page, c.email);

    /* --- An admin with two-factor turned on (role set directly in the TEST database) --- */
    const admin = { name: "E2E Owner", email: `owner+${c.n}@example.com`, password: `Tailor-${c.n}-Shears-9!` }; // fixed digit: the base-36 suffix may have none
    const reg = await api(page, "POST", "/auth/register", admin);
    expect(reg.status, JSON.stringify(reg.data)).toBe(201);
    await db.query("update users set role = 'admin' where email = $1", [admin.email]);
    await api(page, "POST", "/auth/logout");
    await api(page, "POST", "/auth/login", { email: admin.email, password: admin.password });
    const setup = await api<{ otpauthUri: string }>(page, "POST", "/auth/mfa/setup");
    const totp = totpFor(new URL(setup.data.otpauthUri).searchParams.get("secret")!);
    const used = new Set<string>();
    expect((await api(page, "POST", "/auth/mfa/enable", { code: await freshCode(totp, used) })).status).toBe(200);
    await api(page, "POST", "/auth/logout");

    // Admin pages refuse a signed-out visitor
    expect((await api(page, "GET", "/admin/orders")).status).toBe(401);

    /* --- Hidden admin address: /admin looks like any missing page; the secret path is in no public HTML --- */
    for (const guess of ["/admin", "/admin/orders", "/ADMIN", "/%61dmin/settings"]) {
      expect((await page.goto(guess))?.status(), guess).toBe(404);
    }
    const titleOf = async (p: string) => (await page.goto(p), await page.title());
    expect(await titleOf("/admin/orders"), "a guessed admin page looks like any missing page").toBe(await titleOf("/no-such-page-here"));
    const headersOf = async (p: string) => {
      const r = await page.request.get(p);
      return { status: r.status(), cache: r.headers()["cache-control"], robots: r.headers()["x-robots-tag"] };
    };
    expect(await headersOf("/admin"), "same headers as any missing page").toEqual(await headersOf("/no-such-page-here"));
    expect(await (await page.request.get("/robots.txt")).text()).not.toMatch(/admin/i);
    const home = await (await page.goto("/"))!.text();
    expect(home).not.toContain(ADMIN.slice(1));
    // A guest who somehow has the secret address is sent to sign in, not shown anything
    await page.goto(ADMIN);
    await page.waitForURL(/\/login\?next=/);

    /* --- Sign in through the UI: password, then the 6-digit code --- */
    await page.goto(`/login?next=${ADMIN}`);
    await page.getByLabel("Email").fill(admin.email);
    await page.getByLabel("Password", { exact: true }).fill(admin.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.getByLabel("Digit 1 of 6").click();
    await page.keyboard.type(await freshCode(totp, used));
    await page.waitForURL((u) => u.pathname.startsWith(ADMIN), { timeout: 30_000 });
    // The account menu links to the secret address now (the API only tells two-factor admins)
    expect((await api<{ user: { adminPath?: string } }>(page, "GET", "/auth/session")).data.user.adminPath).toBe(ADMIN.slice(1));

    /* --- Take the order through to shipped --- */
    await page.goto(`${ADMIN}/orders?order=${orderNumber}`);
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText(orderNumber).first()).toBeVisible();
    const steps = drawer.getByRole("region", { name: "Next steps" });
    for (const label of ["Confirm order", "Mark being tailored", "Mark ready to ship"]) {
      await steps.getByRole("button", { name: label }).click();
      await expect(steps.getByRole("button", { name: label })).toBeHidden();
    }
    await steps.getByRole("button", { name: /Ship/ }).click();
    const ship = page.getByRole("dialog", { name: "Ship order" });
    // Shipping without a tracking number is refused
    await ship.getByRole("button", { name: /Mark shipped/ }).click();
    await expect(ship.getByText(/tracking number/i).nth(1)).toBeVisible();
    await ship.getByLabel("Tracking number").fill(`PL${c.n.toUpperCase()}`);
    await ship.getByRole("button", { name: /Mark shipped/ }).click();
    await expect(ship).toBeHidden();

    const [row] = (await db.query<{ status: string; tracking_number: string }>("select status, tracking_number from orders where order_number = $1", [orderNumber])).rows;
    expect(row).toEqual({ status: "shipped", tracking_number: `PL${c.n.toUpperCase()}` });
    const audits = await db.query("select action from audit_logs a join users u on u.id = a.actor_id where u.email = $1", [admin.email]);
    expect(audits.rows.length, "admin actions are audited").toBeGreaterThanOrEqual(4);

    await page.goto(`${ADMIN}/orders?order=${orderNumber}`);
    await page.getByRole("dialog").getByRole("region", { name: "Next steps" }).getByRole("button", { name: "Mark delivered" }).click();
    await expect.poll(async () => (await db.query<{ status: string }>("select status from orders where order_number = $1", [orderNumber])).rows[0]?.status).toBe("delivered");
    await api(page, "POST", "/auth/logout");

    /* --- Customer: sees the tracking number, then reviews the delivered item --- */
    await page.goto("/track-order");
    await page.getByLabel("Order number").fill(orderNumber);
    await page.getByLabel("Email").fill(c.email);
    await page.getByLabel("Email").press("Enter");
    await expect(page.getByText(`PL${c.n.toUpperCase()}`).first()).toBeVisible();

    const reviewText = `Sharp fit across the shoulders, review ${c.n}.`;
    await page.goto(`/review?order=${orderNumber}&product=${SLUG}`);
    await page.getByLabel("The email you ordered with").fill(c.email);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator("label").filter({ hasText: /^5 stars/ }).click(); // the star label, like a real tap
    await expect(page.getByRole("radio", { name: /^5 stars/ })).toBeChecked();
    await page.getByLabel("Your review").fill(reviewText);
    await page.getByRole("button", { name: "Send review" }).click();
    await expect(page.getByText(/thank/i).first()).toBeVisible();

    // Not visible to shoppers until approved
    const pending = await api<{ reviews?: { body: string }[]; items?: { body: string }[] }>(page, "GET", `/products/${SLUG}`);
    expect(JSON.stringify(pending.data)).not.toContain(reviewText);

    /* --- Admin approves it --- */
    await page.goto(`/login?next=${ADMIN}/reviews`);
    await page.getByLabel("Email").fill(admin.email);
    await page.getByLabel("Password", { exact: true }).fill(admin.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.getByLabel("Digit 1 of 6").click();
    await page.keyboard.type(await freshCode(totp, used));
    await page.waitForURL((u) => u.pathname.startsWith(ADMIN), { timeout: 30_000 });
    await page.goto(`${ADMIN}/reviews`);
    const card = page.locator("li, article").filter({ hasText: reviewText }).first();
    await card.getByRole("button", { name: /Approve/ }).click();
    await expect.poll(async () => (await db.query<{ status: string }>("select status from reviews where body = $1", [reviewText])).rows[0]?.status).toBe("approved");

    watch.expectClean();
  } finally {
    await db.end();
  }
});
