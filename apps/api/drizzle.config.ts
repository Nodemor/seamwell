import { defineConfig } from "drizzle-kit";

// Load apps/api/.env for drizzle-kit commands (Node 22 built-in, no dotenv needed).
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file — fall back to the environment / default below */
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://seamwell:seamwell_dev_password@127.0.0.1:5432/seamwell" },
  strict: true,
  verbose: true,
});
