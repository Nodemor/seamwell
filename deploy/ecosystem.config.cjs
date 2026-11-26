// PM2 process file for the Hostinger VPS (docs/07-deployment-vps.md).
//   deploy/deploy.sh starts/reloads it from /var/www/seamwell/current/deploy/ecosystem.config.cjs
// Both apps listen on 127.0.0.1 only — Nginx is the only way in from the internet.
const fs = require("node:fs");
const path = require("node:path");

// Node resolves symlinks for __dirname, so inside a release this file sees releases/<name>/. Point PM2 at the
// stable `current` symlink instead: every restart then starts whatever release `current` points to.
const here = path.resolve(__dirname, "..");
const current = path.resolve(here, "../../current");
const ROOT = path.basename(path.dirname(here)) === "releases" && fs.existsSync(current) ? current : here;

module.exports = {
  apps: [
    {
      name: "seamwell-api",
      cwd: path.join(ROOT, "apps/api"),
      script: "dist/server.js",
      node_args: "--env-file=.env",
      instances: 1, // in-memory rate limits → keep 1 instance (see docs/02-security.md before scaling)
      max_memory_restart: "400M",
      kill_timeout: 10_000, // let in-flight requests finish (server.ts closes gracefully on SIGINT/SIGTERM)
      env: { NODE_ENV: "production" },
    },
    {
      name: "seamwell-web",
      cwd: path.join(ROOT, "apps/web"),
      // npm workspaces install `next` once, in the repo root's node_modules.
      script: path.join(ROOT, "node_modules/next/dist/bin/next"),
      args: "start --port 3000 --hostname 127.0.0.1",
      instances: 1,
      max_memory_restart: "700M",
      env: { NODE_ENV: "production" },
    },
  ],
};
