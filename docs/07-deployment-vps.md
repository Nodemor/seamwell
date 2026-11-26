# 07 · Deploy to the Hostinger KVM 2 VPS

KVM 2 = 2 vCPU · 8 GB RAM · 100 GB NVMe — plenty for this shop (web ≈ 250 MB, API ≈ 120 MB, Postgres ≈ 200 MB).
It can share the server with other sites: each site gets its own Nginx `server` block and its own local ports
(this shop uses **3000** and **4000** on 127.0.0.1 — change them in `deploy/ecosystem.config.cjs`, the Nginx file and
`API_INTERNAL_URL` if another app already uses them).

**Golden rule:** secrets (passwords, keys, `.env` contents) are typed or generated **on the server only** — never pasted
into a chat, an issue, a commit or a screenshot.

```
Browser ──https──▶ Nginx :443 ──/api/*──────▶ API  (PM2 "seamwell-api", 127.0.0.1:4000) ──▶ PostgreSQL (127.0.0.1:5432)
                             ├─/uploads/*───▶ files in shared/uploads (static, never executed)
                             └─everything else▶ Website (PM2 "seamwell-web", 127.0.0.1:3000)

GitHub: pull request ──▶ CI checks ──merge to main──▶ CI checks ──▶ SSH (locked key) ──▶ deploy.sh on the VPS
```

Folders on the server (`deploy/deploy.sh` manages them):
```
/var/www/seamwell/
  repo/        git clone of GitHub — deploy.sh lives here; the site never runs from it
  shared/      api.env · web.env.local · uploads/      ← your settings + uploaded photos, kept forever
  releases/    one complete build per deploy (newest 3 kept)
  current  →   the live release (PM2 runs from here)
```
A deploy builds the new release **next to** the live one; the site keeps serving the old one until the build is
finished, then switches in one step. If the new release fails its health check, it switches straight back.

## 0. Before you start
- The code on GitHub (`https://github.com/Nodemor/seamwell`, public — nothing secret is in the repo).
- A domain. In Hostinger hPanel → **DNS**: `A` record `@` → the VPS IP, and `A` record `www` → the same IP (allow up to an hour).
- Your PC's SSH key: `ssh-keygen -t ed25519` (if you don't have one), then copy `~/.ssh/id_ed25519.pub`.
- In hPanel → VPS → **OS**: Ubuntu 24.04 (plain, no control panel).

### Using Hostinger's web console (Browser terminal)
hPanel → VPS → **Browser terminal** opens a root shell in the browser — you can run this whole guide from it.
- It logs you in as **root**. Steps marked "as `deploy`" → first run `su - deploy` (type `exit` to get back to root).
- It works even when SSH is broken or locked down, so it's your **rescue door** — keep the root password in your
  password manager (hPanel → VPS → Settings → change root password).
- GitHub's automatic deploys still need SSH (port 22, key only) — that's why §1 keeps SSH open but locks it to keys.
- Pasting: use the console's paste button / right-click; long one-liners are safer typed in pieces if paste drops characters.

## 1. Server basics (as root, first login only)
```bash
adduser deploy && usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && nano /home/deploy/.ssh/authorized_keys     # paste YOUR PUBLIC key (id_ed25519.pub)
chown -R deploy: /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```
(Run these in the Browser terminal, or after `ssh root@<vps-ip>` from your PC.)
Check `ssh deploy@<vps-ip>` from your PC works **before** locking root out — if it doesn't, the Browser terminal still
gets you in. Then, as `deploy`:
```bash
sudo nano /etc/ssh/sshd_config.d/99-hardening.conf
#   PasswordAuthentication no
#   PermitRootLogin no
#   KbdInteractiveAuthentication no
sudo sshd -t && sudo systemctl restart ssh
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx ufw fail2ban git gnupg curl unattended-upgrades
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable
sudo systemctl enable --now fail2ban            # default jail protects SSH
sudo dpkg-reconfigure -plow unattended-upgrades # answer "Yes"
```
✅ Expect: `sudo ufw status` → only `OpenSSH` and `Nginx Full`; `sudo fail2ban-client status sshd` → jail active.

### 1b. Firewalls — three free layers
1. **Hostinger VPS firewall** (hPanel → VPS → **Security → Firewall**; menu names may differ slightly) — filters traffic
   *before* it reaches the server. Create a configuration with **Accept TCP 22, 80, 443** (from anywhere) and activate it;
   everything else is dropped. Ports 3000, 4000 and 5432 must never be opened anywhere.
2. **UFW** on the server (done above: only SSH + Nginx). Two layers means one mistake doesn't expose anything.
3. **Ban repeat attackers** — fail2ban is already running for SSH. Add Nginx jails so scanners hammering the site are
   banned too:
   ```bash
   sudo tee /etc/fail2ban/jail.d/seamwell.conf >/dev/null <<'JAIL'
   [sshd]
   enabled  = true
   maxretry = 4
   bantime  = 1h
   findtime = 10m

   [recidive]
   enabled  = true
   bantime  = 1w

   [nginx-botsearch]
   enabled  = true
   port     = http,https
   backend  = auto
   logpath  = /var/log/nginx/access.log

   [nginx-limit-req]
   enabled  = true
   port     = http,https
   backend  = auto
   logpath  = /var/log/nginx/error.log
   JAIL
   sudo systemctl restart fail2ban && sudo fail2ban-client status
   ```
   ✅ Expect: jails `nginx-botsearch, nginx-limit-req, recidive, sshd`. (`nginx-limit-req` bans IPs that keep hitting the
   API rate limit in the Nginx file; `recidive` bans repeat offenders for a week.) Run this after §6 if Nginx isn't
   installed yet.

   *Optional instead of fail2ban:* **CrowdSec** (free) does the same and also blocks IPs that other servers worldwide
   reported. Don't run both on SSH. Install: `curl -s https://install.crowdsec.net | sudo sh && sudo apt -y install crowdsec crowdsec-firewall-bouncer-iptables`,
   then `sudo systemctl disable --now fail2ban`. Check with `sudo cscli metrics`.

Don't block SSH to "only my IP": GitHub's deploy servers use changing IPs, and SSH is already key-only + banned on
abuse. The Browser terminal is your way in if you ever lock yourself out.

## 2. Node.js 22 + PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs build-essential      # build tools for argon2/sharp if a prebuilt binary is missing
sudo npm i -g pm2
pm2 install pm2-logrotate                        # keeps logs small: 10 MB × 7 files per app
pm2 set pm2-logrotate:max_size 10M && pm2 set pm2-logrotate:retain 7
```
✅ Expect: `node -v` → v22.x.

## 3. PostgreSQL 17 (local only)
```bash
sudo apt -y install postgresql-common && sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt -y install postgresql-17
DBPASS=$(openssl rand -hex 24); echo "DB password (save it in your password manager): $DBPASS"
sudo -u postgres psql -c "CREATE USER seamwell WITH PASSWORD '$DBPASS';"
sudo -u postgres psql -c "CREATE DATABASE seamwell OWNER seamwell;"
```
Hex passwords contain only `0-9a-f`, so they need no escaping in `DATABASE_URL`. Postgres listens on `localhost`
by default — keep it that way (never open 5432 in UFW).

## 4. Get the code & configure
The repo is public, so the server clones it over HTTPS (no key needed — the server only ever reads from GitHub):
```bash
sudo mkdir -p /var/www/seamwell && sudo chown deploy: /var/www/seamwell
cd /var/www/seamwell
git clone https://github.com/Nodemor/seamwell.git repo
mkdir -p shared/uploads releases
cp repo/apps/api/.env.example shared/api.env && cp repo/apps/web/.env.example shared/web.env.local
chmod 600 shared/api.env shared/web.env.local
```
(Private repo instead? Add a read-only deploy key: `ssh-keygen -t ed25519 -f ~/.ssh/github_seamwell -N ""`, paste the
`.pub` into GitHub → Settings → Deploy keys with "write access" OFF, and clone `git@github.com:Nodemor/seamwell.git`.)

Generate the secrets **on the server** (they print in your SSH window only), then paste them into the files with `nano`:
```bash
node -e "const c=require('crypto'); for (const k of ['JWT_ACCESS_SECRET','JWT_MFA_SECRET']) console.log(k+'='+c.randomBytes(48).toString('base64url')); console.log('DATA_ENCRYPTION_KEY='+c.randomBytes(32).toString('hex')); console.log('ADMIN_PATH='+c.randomBytes(12).toString('hex'))"
nano shared/api.env
nano shared/web.env.local
```
**`ADMIN_PATH`** is the secret admin address: the admin area is at `https://<your domain>/<ADMIN_PATH>`, and `/admin`
answers "page not found" to everyone. Put the **same** value in both files, and save the full admin URL in your
password manager (bookmark it). The API refuses to start in production without it, and `deploy.sh` refuses to deploy
if the two files disagree. After a 2FA sign-in, the account menu's "Shop admin" link also takes you there.

Production values:
```
# shared/api.env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://seamwell:<DB password>@127.0.0.1:5432/seamwell
WEB_ORIGIN=https://yourshop.lk,https://www.yourshop.lk
JWT_ACCESS_SECRET=<generated>
JWT_MFA_SECRET=<generated, different>
DATA_ENCRYPTION_KEY=<generated 64 hex chars>   # never change it later: it decrypts admins' 2FA secrets
COOKIE_SECURE=true
SHOP_NAME=Seamwell Tailoring
BANK_TRANSFER_DETAILS=<real bank details>
SMTP_URL=smtp://<user>:<password>@<smtp host>:587   # without it NO emails are sent (only a warning is logged)
MAIL_FROM=Seamwell Tailoring <orders@yourshop.lk>
HIBP_CHECK=true
ADMIN_PATH=<generated 24 hex chars>                 # same value in shared/web.env.local
# remove DATABASE_URL_TEST on the server — tests don't run there

# shared/web.env.local
API_INTERNAL_URL=http://127.0.0.1:4000
ADMIN_PATH=<the same value as in shared/api.env>   # server-only: never prefix it with NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=https://yourshop.lk          # https here also turns on HSTS + the security.txt URLs
NEXT_PUBLIC_TRYON_SPACE=fashn-ai/fashn-vton-1.5
NEXT_PUBLIC_SHOP_PHONE=+94 7X XXX XXXX
NEXT_PUBLIC_SHOP_WHATSAPP=+94 7X XXX XXXX
NEXT_PUBLIC_SHOP_EMAIL=hello@yourshop.lk          # also the contact in /.well-known/security.txt
NEXT_PUBLIC_SHOP_ADDRESS=<shop address>
NEXT_PUBLIC_SHOP_MAP_URL=https://maps.app.goo.gl/<your place>
```
The API **refuses to start** in production with default secrets, `COOKIE_SECURE=false` or no `ADMIN_PATH`.
`NEXT_PUBLIC_*` values are baked in at build time — after changing them, redeploy (§8). Other changes need only
`pm2 restart all`.
Free SMTP options: Brevo (300 emails/day) or Gmail with an app password (`smtps://you%40gmail.com:<app password>@smtp.gmail.com:465`).

## 5. First build & start
```bash
bash /var/www/seamwell/repo/deploy/deploy.sh      # installs, migrates, builds, starts PM2, checks the site
cd /var/www/seamwell/current
npm run db:seed                                    # optional: sample catalogue (edit/hide items later in the admin)
npm run admin:create -- owner@yourshop.lk "Shop Owner"
pm2 startup                                        # run the sudo command it prints → apps restart after a reboot
```
✅ Expect: the script ends with `✔ Live: <release>` after `✓ API`, `✓ Website` and `✓ /admin is hidden (404)`;
`pm2 status` → `seamwell-api` and `seamwell-web` both **online**.
Open `https://<your domain>/<ADMIN_PATH>` (after §6) → sign in with the admin email → you'll be asked to set up 2FA;
store the recovery codes **offline**.

## 6. Nginx + HTTPS
```bash
sudo cp /var/www/seamwell/repo/deploy/nginx-seamwell.conf /etc/nginx/sites-available/seamwell
sudo sed -i 's/yourshop\.lk/<your domain>/g' /etc/nginx/sites-available/seamwell
sudo ln -s /etc/nginx/sites-available/seamwell /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default        # only if no other site uses it
sudo nginx -t && sudo systemctl reload nginx
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d <your domain> -d www.<your domain> --redirect   # auto-renews (systemd timer)
sudo certbot renew --dry-run
```
✅ Expect: `curl -I https://<your domain>` → `200`, with `content-security-policy` (containing `nonce-`),
`strict-transport-security` and `x-frame-options: DENY`.

## 7. Backups (database + uploaded photos)
Install steps are at the top of `deploy/backup-db.sh` (nightly at 02:30, encrypted with GPG, 14 days kept) —
including the one-line sudo rule that lets `deploy.sh` take a backup by itself before any database change.
Then once a week copy `/var/backups/seamwell` off the server (e.g. `rclone` to Google Drive, or `scp` to your PC),
and once a month test a restore (commands at the bottom of the script).

## 8. Updating the site — automatic from GitHub
Day to day: make changes on a branch → open a pull request → CI checks it → **merge** → GitHub checks `main` again and
deploys that exact commit to the VPS. You can watch it under GitHub → **Actions**.

### 8a. One-time setup on the VPS: a key that can only deploy
```bash
ssh-keygen -t ed25519 -f ~/gh-deploy -N "" -C "github-actions-deploy"
echo "command=\"bash /var/www/seamwell/repo/deploy/deploy.sh --from-ssh\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $(cat ~/gh-deploy.pub)" >> ~/.ssh/authorized_keys
cat ~/gh-deploy          # the PRIVATE key → copy it straight into GitHub (8b) — never into a chat or a file elsewhere
rm ~/gh-deploy ~/gh-deploy.pub
```
The `command=` lock means this key cannot open a shell, copy files or tunnel: whatever GitHub sends, the server only
runs `deploy.sh`, which accepts nothing but `deploy <40-character commit id>` — and only for commits already on `main`.

On **your PC**, read the server's identity so GitHub can verify it's really your VPS (no trust-on-first-use):
```bash
ssh-keyscan -t ed25519 <vps-ip>            # one line: "<vps-ip> ssh-ed25519 AAAA…" → VPS_KNOWN_HOSTS
```
(Optional check: its fingerprint `ssh-keyscan -t ed25519 <vps-ip> | ssh-keygen -lf -` must match the server's
`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.)

### 8b. One-time setup on GitHub (`github.com/Nodemor/seamwell` → Settings)
1. **Environments → New environment `production`** → Deployment branches and tags → **Selected branches → `main`**.
   Add these **environment secrets**: `VPS_HOST` (the IP), `VPS_USER` (`deploy`), `VPS_SSH_KEY` (the private key from 8a),
   `VPS_KNOWN_HOSTS` (the ssh-keyscan line), and `VPS_PORT` only if SSH isn't on 22.
2. **Secrets and variables → Actions → Variables → New repository variable** `DEPLOY_ENABLED` = `true`
   (until this is set, merges run the checks but don't deploy — handy before the VPS exists).
3. **Rules → Rulesets → New branch ruleset** for `main`: restrict deletions, block force pushes, require a pull request,
   require status check **"Typecheck · lint · unit tests · build"**. (Add yourself to the bypass list if you want to
   push small fixes directly.)
4. **Actions → General → Fork pull request workflows**: "Require approval for all external contributors".
   Fork PRs never get the secrets anyway, but this also stops strangers using your Actions minutes.

Test it: GitHub → Actions → **CI / Deploy** → Run workflow (branch `main`). The "Deploy to the VPS" job ends with
`✔ Live: <release>`.

### 8c. By hand on the server (same script)
```bash
bash /var/www/seamwell/repo/deploy/deploy.sh             # latest main
bash /var/www/seamwell/repo/deploy/deploy.sh status      # what's live, releases on disk
bash /var/www/seamwell/repo/deploy/deploy.sh rollback    # back to the previous release in seconds
bash /var/www/seamwell/repo/deploy/deploy.sh <commit>    # a specific commit from main
```
Database changes are never undone by a rollback — migrations only add tables/columns, so older code keeps working.
If a deploy fails, the live site is untouched (failed before the switch) or switched back automatically (failed its
health check); the error and `pm2 logs --lines 80` tell you why.

## 9. Monitoring
- **UptimeRobot** (free, 5-minute checks, email/app alerts): add two HTTPS monitors —
  `https://<your domain>/api/health` (keyword `"ok":true`) and `https://<your domain>/` (keyword `Seamwell`).
- `pm2 status` · `pm2 logs --lines 100` · `pm2 monit` on the server. Logs are rotated by pm2-logrotate.
- Certificates: `sudo certbot certificates` shows the expiry (renewal is automatic).

## 10. Go-live checklist
Record the results in `docs/GO-LIVE.md`.
- [ ] HTTPS works, http → https redirect; `curl -I` shows CSP (with nonce) / HSTS headers
- [ ] securityheaders.com → A or A+ · ssllabs.com/ssltest → A
- [ ] `https://<domain>/api/health` → `{"ok":true}`; ports 3000/4000/5432 **not** reachable from outside (`nmap -Pn -p 22,80,443,3000,4000,5432 <vps-ip>` from your PC → only 22/80/443 open)
- [ ] SSH: keys only, root login off, fail2ban active, UFW only 22/80/443
- [ ] `shared/*.env*` files `chmod 600`; `git -C /var/www/seamwell/repo status` clean
- [ ] `https://<domain>/admin` → 404 page; the admin works only at `https://<domain>/<ADMIN_PATH>` (saved in your password manager)
- [ ] Admin login requires 2FA; recovery codes stored offline
- [ ] A merged pull request deployed itself (GitHub → Actions → "Deploy to the VPS" green); `deploy.sh rollback` tried once
- [ ] Place a COD and a bank-transfer test order, ship one with a tracking number, track it as a guest; emails arrive
- [ ] Real bank details, shop name, contact details, policies (privacy incl. try-on, terms, returns) in place
- [ ] Backups running (`sudo ls -lh /var/backups/seamwell`) and one test restore done
- [ ] `npm run audit` clean · `npm run test:all` green on your PC before pushing · CI green on `main`
- [ ] Try-on works on a phone over mobile data
- [ ] UptimeRobot monitors active
- [ ] Rebuild at least once a year so `security.txt`'s `Expires` date stays in the future

## Using Supabase instead of local Postgres
Skip step 3. Download Supabase's CA certificate (dashboard → Database settings → SSL configuration) to
`/var/www/seamwell/shared/supabase-ca.crt` (shared, so every release finds it), set `DATABASE_URL` to the **Session pooler**
URL ending in `?sslmode=verify-full&sslrootcert=/var/www/seamwell/shared/supabase-ca.crt` (see `apps/api/.env.example`). Everything else stays the same.
Don't use plain `sslmode=require`: the `pg` driver treats it as full verification, which fails without Supabase's CA file.
Notes: pick the region closest to the VPS/customers (e.g. Singapore or Mumbai for Sri Lanka); free projects pause after a
week without traffic; the backup script in step 7 is for local Postgres — on Supabase use its own backups (paid) or a
`pg_dump` cron using the same URL.

## Moving between Supabase and the VPS's own Postgres
Only `DATABASE_URL` changes. To move data: `pg_dump --no-owner --no-acl "<old url>" > seamwell.sql`, then
`psql "<new url>" -f seamwell.sql` (or, for an empty new DB with no real orders yet: `npm run db:migrate && npm run db:seed`).
Uploaded photos live in `/var/www/seamwell/shared/uploads` on the server — copy that folder too.
