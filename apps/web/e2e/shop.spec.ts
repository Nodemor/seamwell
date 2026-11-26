import { expect, test } from "@playwright/test";
import { customer, watchConsole } from "./helpers";

/** A plain "buy" product from the seed catalogue. */
const PRODUCT = "/product/men-grey-tweed-blazer";

test.describe("security headers", () => {
  test("every page gets a fresh CSP nonce, and every script carries it", async ({ page }) => {
    const watch = watchConsole(page);
    const nonces: string[] = [];
    for (const path of ["/", "/shop", PRODUCT]) {
      const res = await page.goto(path);
      const headers = res!.headers();
      const csp = headers["content-security-policy"] ?? "";
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
      expect(nonce, `nonce in CSP for ${path}`).toBeTruthy();
      expect(csp).toContain("'strict-dynamic'");
      expect(csp, "no unsafe-inline for scripts").not.toMatch(/script-src[^;]*unsafe-inline/);
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      if (!process.env.E2E_BASE_URL) expect(csp, "no eval in production").not.toContain("'unsafe-eval'");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBe("DENY");
      nonces.push(nonce!);

      // Executable scripts in the HTML: all carry this request's nonce (JSON-LD data blocks don't run).
      const html = await res!.text();
      const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]!).filter((a) => !/type="application\/ld\+json"/.test(a));
      expect(scripts.length).toBeGreaterThan(0);
      for (const attrs of scripts) expect(attrs, `script on ${path}`).toContain(`nonce="${nonce}"`);
    }
    expect(new Set(nonces).size, "nonce changes per request").toBe(nonces.length);
    watch.expectClean();
  });

  test("the API refuses a state-changing request without the CSRF header", async ({ request }) => {
    const res = await request.post("/api/orders/track", { data: { orderNumber: "SW-AAAAAA", email: "x@example.com" } });
    expect(res.status(), "state-changing request without the CSRF header is refused").toBe(403);
  });
});

test("guest buys with cash on delivery, then tracks the order", async ({ page }) => {
  const watch = watchConsole(page);
  const c = customer();
  const continueIfStepped = async (name: string) => {
    const btn = page.getByRole("button", { name });
    if (await btn.isVisible()) await btn.click();
  };

  // Browse → product
  await page.goto("/shop");
  await page.locator('main a[href^="/product/"]').first().click();
  await page.waitForURL(/\/product\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto(PRODUCT);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Size → bag
  const sizes = page.getByRole("radiogroup", { name: /size/i });
  await sizes.getByRole("radio").and(page.locator(":not([disabled]):not([aria-disabled=true])")).first().click();
  await page.getByRole("button", { name: /^Add to bag$/ }).filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: /Added/ }).filter({ visible: true }).first()).toBeVisible();

  // Checkout as a guest
  await page.goto("/checkout");
  await page.getByLabel("Full name").fill(c.name);
  await page.getByLabel("Email").fill(c.email);
  await page.getByLabel("Mobile number").fill(c.phone);
  await continueIfStepped("Continue to delivery"); // phones: one step at a time
  await page.getByLabel("Address", { exact: true }).fill("12 Galle Road");
  await page.getByLabel("City / town").fill("Colombo 03");
  await page.getByLabel("District").selectOption("Colombo");
  await continueIfStepped("Continue to payment");
  await expect(page.getByRole("radio", { name: /Cash on delivery/ })).toBeChecked();
  await page.getByRole("button", { name: /Place order/ }).filter({ visible: true }).first().click();

  await page.waitForURL(/\/order\/SW-[A-Z0-9]+\/thank-you/, { timeout: 30_000 });
  const orderNumber = /\/order\/(SW-[A-Z0-9]+)\//.exec(page.url())![1]!;
  await expect(page.getByText(orderNumber).first()).toBeVisible();

  // Track it
  await page.goto("/track-order");
  await page.getByLabel("Order number").fill(orderNumber);
  await page.getByLabel("Email").fill(c.email);
  await page.getByLabel("Email").press("Enter");
  await expect(page.getByText("Order placed").first()).toBeVisible();
  await expect(page.getByText(/Cash on delivery/).first()).toBeVisible();

  // Wrong email → same "not found" answer (no hint the order exists)
  await page.getByLabel("Email").fill(`other+${c.n}@example.com`);
  await page.getByLabel("Email").press("Enter");
  await expect(page.getByText(/couldn.t find an order/i)).toBeVisible();

  watch.expectClean();
});

test("try-on photo check loads MediaPipe under the CSP", async ({ page }) => {
  test.skip(!!process.env.E2E_SKIP_NETWORK, "needs internet (cdn.jsdelivr.net + storage.googleapis.com)");
  const watch = watchConsole(page);
  await page.goto("/try-on");
  const wasm = page.waitForResponse((r) => /tasks-vision.*\.wasm$/.test(r.url()) && r.ok(), { timeout: 60_000 });
  const model = page.waitForResponse((r) => /pose_landmarker_lite\.task$/.test(r.url()) && r.ok(), { timeout: 60_000 });
  await page.getByRole("button", { name: /Use our sample model/ }).click();
  await Promise.all([wasm, model]);
  await expect(page.getByText("Checking your photo…").first()).toBeHidden({ timeout: 60_000 });
  watch.expectClean();
});
