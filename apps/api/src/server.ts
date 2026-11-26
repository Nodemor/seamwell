import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { pool } from "./db/client.js";
import { logger } from "./lib/logger.js";

const app = createApp();
// Listen on localhost only — Nginx is the public entry point on the VPS.
const server = app.listen(env.PORT, "127.0.0.1", () => {
  logger.info(`🧵 Seamwell API listening on http://127.0.0.1:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
