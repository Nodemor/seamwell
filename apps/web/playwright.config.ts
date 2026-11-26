import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";
import { E2E_ADMIN_PATH } from "./e2e/admin-path";

/**
 * Browser end-to-end tests (Phase 9) — run with `npm run test:e2e:web` from the repo root.
 *
 * Default: starts its own API (:4100) and a production build of the site (:3100) against the LOCAL TEST
 * database (DATABASE_URL_TEST in apps/api/.env), migrates + seeds it first. The dev database is never touched.
 *
 * E2E_BASE_URL=http://localhost:3000: test servers you already started instead (customer journeys only;
 * the admin journey needs the test database and is skipped).
 *
 * Uses the Chrome installed on this PC (channel "chrome") — no browser download.
 */
const API_DIR = path.resolve(__dirname, "../api");
const apiEnv = (() => {
  try {
    return parseEnv(readFileSync(path.join(API_DIR, ".env"), "utf8"));
  } catch {
    return {} as Record<string, string>;
  }
})();

export const EXTERNAL = process.env.E2E_BASE_URL;
const TEST_DB = process.env.DATABASE_URL_TEST ?? apiEnv.DATABASE_URL_TEST;
if (!EXTERNAL && !TEST_DB) {
  throw new Error(
    "DATABASE_URL_TEST is not set. Create the local test database (docs/02-security.md → Testing) and add DATABASE_URL_TEST to apps/api/.env — or set E2E_BASE_URL to test running dev servers.",
  );
}
if (TEST_DB) process.env.DATABASE_URL_TEST = TEST_DB; // for global-setup and the admin journey (same process tree)

const WEB_PORT = 3100;
const API_PORT = 4100;
const BASE_URL = EXTERNAL ?? `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // one shared database; journeys create orders
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  outputDir: "e2e/results",
  globalSetup: EXTERNAL ? undefined : "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testIgnore: /admin\.spec/ },
  ],
  webServer: EXTERNAL
    ? undefined
    : [
        {
          // API on the test database. tsx's --env-file doesn't override the variables set here.
          command: "npx tsx --env-file=.env src/server.ts",
          cwd: API_DIR,
          url: `http://127.0.0.1:${API_PORT}/api/health`,
          timeout: 120_000,
          reuseExistingServer: false,
          env: {
            NODE_ENV: "development",
            PORT: String(API_PORT),
            DATABASE_URL: TEST_DB!,
            WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
            SMTP_URL: "", // never send real email from tests (dev mailer just logs)
            HIBP_CHECK: "false", // deterministic; the breach check has its own unit tests
            ADMIN_PATH: E2E_ADMIN_PATH, // hidden admin address, like production
            UPLOAD_DIR: path.resolve(__dirname, "e2e/.uploads"),
          },
        },
        {
          command: `npx next build && npx next start --port ${WEB_PORT} --hostname 127.0.0.1`,
          cwd: __dirname,
          url: BASE_URL,
          timeout: 600_000,
          reuseExistingServer: false,
          env: {
            API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
            NEXT_PUBLIC_SITE_URL: BASE_URL,
            ADMIN_PATH: E2E_ADMIN_PATH,
          },
        },
      ],
});
