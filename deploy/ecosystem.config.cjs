// PM2 process file for the Hostinger VPS (docs/07-deployment-vps.md).
//   deploy/deploy.sh (re)starts it from /var/www/seamwell/current/deploy/ecosystem.config.cjs
// Both apps listen on 127.0.0.1 only — Nginx is the only way in from the internet.
const fs = require("node:fs");
const path = require("node:path");

// Node resolves symlinks for __dirname, so inside a release this file sees /var/www/seamwell/releases/<name>/.
// Point PM2 at the stable `current` link and the `shared` folder with ABSOLUTE paths, so nothing depends on
// the working directory PM2 happens to start the process in.
const here = path.resolve(__dirname, "..");
const base = path.resolve(here, "../..");
const inReleases = path.basename(path.dirname(here)) === "releases" && fs.existsSync(path.join(base, "current"));
const ROOT = inReleases ? path.join(base, "current") : here;
const SHARED = path.join(base, "shared");

const apiEnvFile = inReleases ? path.join(SHARED, "api.env") : path.join(ROOT, "apps/api/.env");
const webDir = path.join(ROOT, "apps/web"); // `next start <dir>` reads <dir>/.env.local (→ shared/web.env.local)

module.exports = {
  apps: [
    {
      name: "seamwell-api",
      cwd: path.join(ROOT, "apps/api"),
      script: path.join(ROOT, "apps/api/dist/server.js"),
      node_args: `--env-file=${apiEnvFile}`,
      instances: 1, // in-memory rate limits → keep 1 instance (see docs/02-security.md before scaling)
      max_memory_restart: "400M",
      kill_timeout: 10_000, // let in-flight requests finish (server.ts closes gracefully on SIGINT/SIGTERM)
      env: { NODE_ENV: "production", ...(inReleases ? { UPLOAD_DIR: path.join(SHARED, "uploads") } : {}) },
    },
    {
      name: "seamwell-web",
      cwd: webDir,
      // npm workspaces install `next` once, in the repo root's node_modules.
      script: path.join(ROOT, "node_modules/next/dist/bin/next"),
      args: ["start", webDir, "--port", "3000", "--hostname", "127.0.0.1"],
      instances: 1,
      max_memory_restart: "700M",
      env: { NODE_ENV: "production" },
    },
  ],
};
