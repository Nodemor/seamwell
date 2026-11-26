import { createRequire } from "node:module";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/* pg + otpauth are API dependencies — borrowed here so the web app doesn't need them. */
const apiRequire = createRequire(path.resolve(__dirname, "../../api/package.json"));

type PgClient = { connect(): Promise<void>; query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; end(): Promise<void> };

/** Direct connection to the LOCAL TEST database (never the dev one). */
export async function testDb(): Promise<PgClient> {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set");
  const { Client } = apiRequire("pg") as { Client: new (o: { connectionString: string }) => PgClient };
  const db = new Client({ connectionString: url });
  await db.connect();
  return db;
}

export function totpFor(secret: string) {
  const { TOTP, Secret } = apiRequire("otpauth") as {
    TOTP: new (o: { secret: unknown }) => { generate(): string };
    Secret: { fromBase32(s: string): unknown };
  };
  return new TOTP({ secret: Secret.fromBase32(secret) });
}

/** Call our own API from inside the page (same origin, cookies + CSRF header — exactly like lib/api.ts). */
export async function api<T = unknown>(page: Page, method: string, url: string, body?: unknown): Promise<{ status: number; data: T }> {
  return page.evaluate(
    async ({ method, url, body }) => {
      const r = await fetch(`/api${url}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Seamwell-CSRF": "1" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: r.status, data: await r.json().catch(() => null) };
    },
    { method, url, body },
  );
}

/**
 * Collect CSP violations and uncaught errors for the whole test. Call `expectClean()` at the end.
 * (React's hydration warnings about browser-extension attributes are ignored.)
 */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    const t = m.text();
    if (/Content.Security.Policy|Refused to (load|execute|connect)/i.test(t)) problems.push(`csp: ${t}`);
    else if (m.type() === "error" && !/hydrated but some attributes|Failed to load resource/.test(t)) problems.push(`console: ${t}`);
  });
  return { problems, expectClean: () => expect(problems, problems.join("\n")).toEqual([]) };
}

/** A fresh, obviously-fake customer for each run. */
export const customer = () => {
  const n = Date.now().toString(36);
  return { name: "Nimali Test", email: `e2e+${n}@example.com`, phone: "0771234567", n };
};
