# Phase 10 · Deploy to the Hostinger KVM 2 VPS

**Goal:** the shop is live on its domain with HTTPS, backups and monitoring.
**Read first:** `docs/07-deployment-vps.md`, `deploy/*`.

## Prompt to paste into Claude Code
```
Phase 10 (deploy) of Seamwell. Read docs/07-deployment-vps.md and the files in deploy/. I will run the server commands myself over SSH — guide me step by step and check my outputs.

1. Review deploy/ecosystem.config.cjs, deploy/nginx-seamwell.conf and deploy/backup-db.sh for my domain <yourshop.lk> and fix anything that doesn't match the code (ports, paths, upload folder).
2. Create a GitHub Actions workflow (.github/workflows/ci.yml): install, typecheck, lint, unit tests, build on every push/PR.
3. Create deploy/deploy.sh that I run on the server: git pull, npm ci, npm run db:migrate, npm run build, pm2 reload all, then curl the health endpoint and fail loudly if it's not OK.
4. Add uptime monitoring instructions (UptimeRobot free on /api/health and /) and PM2 log rotation (pm2 install pm2-logrotate).
5. Walk me through the go-live checklist at the end of docs/07-deployment-vps.md and record the results in docs/GO-LIVE.md.
Never ask me to paste real secrets into the chat.
```

## Acceptance criteria
- [ ] https://yourshop.lk loads, A+ on securityheaders.com (or close, with reasons), SSL Labs A
- [ ] Ports 3000/4000/5432 closed from the internet
- [ ] Backup file created and a test restore done
- [ ] CI green on main

## Security checklist
- [ ] SSH: keys only, root login disabled, fail2ban active, UFW only 22/80/443
- [ ] `.env` files chmod 600, not in git
- [ ] Admin account has MFA and recovery codes stored offline
