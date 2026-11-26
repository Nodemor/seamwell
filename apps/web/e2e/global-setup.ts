import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Before the browser tests: bring the LOCAL TEST database up to date and load the sample catalogue.
 * Refuses anything that doesn't look like a local test database, so a typo can never seed production.
 */
export default function globalSetup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set");
  const { hostname, pathname } = new URL(url);
  if (!["127.0.0.1", "localhost", "::1"].includes(hostname) || !/test/i.test(pathname)) {
    throw new Error("DATABASE_URL_TEST must point at a local database whose name contains 'test'.");
  }
  const cwd = path.resolve(__dirname, "../../api");
  const env = { ...process.env, DATABASE_URL: url };
  // Output is not echoed: drizzle-kit prints connection details.
  execSync("npx drizzle-kit migrate", { cwd, env, stdio: "pipe" });
  execSync("npx tsx --env-file=.env src/db/seed.ts", { cwd, env, stdio: "pipe" });
}
