/**
 * Run the API end-to-end smoke test against the LOCAL TEST database — never the dev or production one.
 *   npm run test:e2e:testdb -w @seamwell/api        (or `npm run test:e2e:api` from the repo root)
 *
 * 1. reads DATABASE_URL_TEST from apps/api/.env (must be a local database whose name contains "test")
 * 2. migrates + seeds it
 * 3. starts a fresh API on :4100 against it (fresh = clean in-memory rate limits)
 * 4. runs scripts/e2e-smoke.mjs, then stops the API
 * Connection strings are never printed.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4100;
const fileEnv = existsSync(path.join(API_DIR, ".env")) ? parseEnv(readFileSync(path.join(API_DIR, ".env"), "utf8")) : {};
const TEST_DB = process.env.DATABASE_URL_TEST ?? fileEnv.DATABASE_URL_TEST;

if (!TEST_DB) {
  console.error("DATABASE_URL_TEST is not set in apps/api/.env — create the local test database first (docs/02-security.md → Testing).");
  process.exit(1);
}
const { hostname, pathname } = new URL(TEST_DB);
if (!["127.0.0.1", "localhost", "::1"].includes(hostname) || !/test/i.test(pathname)) {
  console.error("DATABASE_URL_TEST must point at a local database whose name contains 'test'. Refusing to run.");
  process.exit(1);
}

const uploads = mkdtempSync(path.join(tmpdir(), "seamwell-e2e-uploads-"));
const env = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: TEST_DB,
  PORT: String(PORT),
  WEB_ORIGIN: "http://localhost:3000",
  SMTP_URL: "",
  HIBP_CHECK: "false",
  UPLOAD_DIR: uploads,
};
const shell = process.platform === "win32";
const step = (label, cmd) => {
  process.stdout.write(`• ${label}… `);
  const r = spawnSync(cmd, { cwd: API_DIR, env, shell: true, stdio: "pipe", encoding: "utf8" });
  if (r.status !== 0) {
    console.log("failed");
    console.error((r.stderr || r.stdout || "").replace(/postgres(ql)?:\/\/\S+/g, "[redacted-url]").slice(-2000));
    process.exit(1);
  }
  console.log("ok");
};

step("migrating the test database", "npx drizzle-kit migrate");
step("seeding the sample catalogue", "npx tsx --env-file=.env src/db/seed.ts");

process.stdout.write(`• starting a fresh API on :${PORT}… `);
const api = spawn("npx tsx --env-file=.env src/server.ts", { cwd: API_DIR, env, shell: true, stdio: "ignore" });
const stopApi = () => {
  if (api.exitCode !== null) return;
  if (shell) spawnSync("taskkill", ["/pid", String(api.pid), "/T", "/F"], { stdio: "ignore" });
  else api.kill("SIGTERM");
};
process.on("exit", () => {
  stopApi();
  rmSync(uploads, { recursive: true, force: true });
});

let up = false;
for (let i = 0; i < 120 && !up; i++) {
  try {
    up = (await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!up) {
  console.log("failed (no answer from /api/health within 60 s)");
  process.exit(1);
}
console.log("ok\n");

const smoke = spawnSync(process.execPath, ["--env-file=.env", "scripts/e2e-smoke.mjs"], {
  cwd: API_DIR,
  env: { ...env, E2E_API_URL: `http://127.0.0.1:${PORT}/api` },
  stdio: "inherit",
});
process.exit(smoke.status ?? 1);
