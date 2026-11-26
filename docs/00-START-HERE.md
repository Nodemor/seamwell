# 00 · Start here — VS Code + Claude Code setup

## 1. Install the tools (once)

| Tool | Version | Notes |
|---|---|---|
| Node.js | **22 LTS** | https://nodejs.org — check with `node -v` |
| Git | latest | https://git-scm.com |
| VS Code | latest | + the extensions VS Code suggests when you open the folder (`.vscode/extensions.json`) |
| Claude Code | latest | VS Code extension **"Claude Code"** (by Anthropic) from the Extensions panel. For the terminal version follow the official install guide at https://docs.claude.com/en/docs/claude-code |
| PostgreSQL | 16 or 17 | **Either** Docker Desktop (easiest) **or** a native install — see step 3 |

## 2. Open the project

1. Unzip `seamwell.zip` somewhere without spaces in the path, e.g. `C:\dev\seamwell` or `~/dev/seamwell`.
2. VS Code → **File → Open Folder…** → choose `seamwell`.
3. Open a terminal in VS Code (**Ctrl+`**) and run:

```bash
npm install
git init && git add -A && git commit -m "Seamwell starter"
```

## 3. Database

**Option A — Docker (recommended):**
```bash
npm run db:up        # starts PostgreSQL 17 on 127.0.0.1:5432 (user/pass/db in docker-compose.yml)
```

**Option B — native PostgreSQL on Windows (no Docker):**
1. Install PostgreSQL 17 from https://www.postgresql.org/download/windows/ (remember the `postgres` password).
2. Open **SQL Shell (psql)** and run:
   ```sql
   CREATE USER seamwell WITH PASSWORD 'seamwell_dev_password';
   CREATE DATABASE seamwell OWNER seamwell;
   ```

## 4. Environment files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```
For local development the defaults work. Before going live, generate real secrets (commands are in `.env.example`) — see `07-deployment-vps.md`.

## 5. Create tables, add sample products, run

```bash
npm run db:migrate
npm run db:seed
npm run dev
```
- Website: http://localhost:3000
- API health: http://localhost:4000/api/health

Optional checks:
```bash
npm run typecheck && npm run lint && npm test     # 15 unit/security tests
npm run test:e2e -w @seamwell/api                 # 38 end-to-end checks (fresh dev DB, API running)
```

## 6. Create the shop admin

```bash
npm run admin:create -- owner@yourshop.lk "Shop Owner"
```
The admin dashboard unlocks only after the admin turns on **two-factor authentication** (the screens are built in phase 4/5; the API already enforces it).

## 7. Build with Claude Code

1. Open the Claude Code panel in VS Code (or run `claude` in the terminal at the repo root).
2. Claude Code reads `CLAUDE.md` automatically — it contains the stack, commands, security and animation rules.
3. Type **`/next-phase`** — Claude reads the next file in `docs/phases/`, proposes a plan, waits for your OK, builds, and checks the acceptance criteria.
4. Other commands: `/security-review`, `/ui-polish <page>`, `/add-component <name>`.

### Recommended extras for Claude Code
- **Official GSAP skills** (so Claude writes correct, up-to-date GSAP):
  `npx skills add https://github.com/greensock/gsap-skills`
- **21st.dev**: on any component page click **Copy prompt** and paste it into Claude Code, or use the shown CLI command.
- **SuperDesign** (superdesign.dev): generate layout ideas/mockups, then ask Claude Code to implement them with the brand tokens.

### Tips
- One phase per conversation keeps Claude focused. Commit after each phase.
- If something breaks: paste the exact error into Claude Code and ask it to fix *and* explain.
- Never paste real `.env` secrets into the chat. `.claude/settings.json` already blocks Claude from reading `.env` files.
