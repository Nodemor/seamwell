import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  // TLS is configured by the URL itself (pg reads sslmode / sslrootcert from it, and URL settings override any
  // `ssl` option here). Local Postgres: no params. Supabase: ?sslmode=verify-full&sslrootcert=certs/supabase-ca.crt
});

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
