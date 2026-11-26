#!/usr/bin/env bash
# Seamwell deploy — zero-downtime release folders (docs/07-deployment-vps.md §8).
#
#   /var/www/seamwell/
#     repo/        git clone of GitHub (this script lives here; the site never runs from it)
#     shared/      api.env · web.env.local · uploads/   (kept across releases, chmod 600 env files)
#     releases/    20261126-101500-abc1234/ …            (one full build per deploy, newest 3 kept)
#     current  →   releases/<the live one>               (PM2 runs from here)
#
# Usage (as the deploy user):
#   bash /var/www/seamwell/repo/deploy/deploy.sh             deploy the latest commit on main
#   bash /var/www/seamwell/repo/deploy/deploy.sh <sha>       deploy a specific commit (must be on main)
#   bash /var/www/seamwell/repo/deploy/deploy.sh rebuild     rebuild + restart the live commit (after editing shared/*.env*)
#   bash /var/www/seamwell/repo/deploy/deploy.sh rollback    switch back to the previous release (instant)
#   bash /var/www/seamwell/repo/deploy/deploy.sh status      what's live
# GitHub Actions runs it through a restricted SSH key (forced command "deploy.sh --from-ssh") that can only
# ask for "deploy <40-char sha>" or "status".
#
# The new release is installed + built in its own folder while the old one keeps serving. Only a finished build
# goes live (one atomic symlink switch + PM2 restart). If it then fails its health check, the previous release
# is switched back automatically. Database migrations run before the switch, after an automatic backup when
# the update contains new migrations (needs the sudo rule from §7).
set -Eeuo pipefail

BASE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../.." && pwd)"
REPO="$BASE/repo"
SHARED="$BASE/shared"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
KEEP=3

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*" >&2; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

NEW=""
SWITCHED=0
on_error() {
  local line=$1
  if [[ $SWITCHED -eq 0 ]]; then
    if [[ -n "$NEW" && -d "$NEW" ]]; then rm -rf -- "$NEW"; fi
    printf '\n\033[1;31m✖ Deploy stopped at line %s. The live site was not changed (still: %s).\033[0m\n' \
      "$line" "$(basename "$(readlink -f "$CURRENT" 2>/dev/null || echo none)")" >&2
  else
    printf '\n\033[1;31m✖ Deploy stopped at line %s after switching releases. Check: pm2 logs --lines 80 — go back with: deploy.sh rollback\033[0m\n' "$line" >&2
  fi
}
trap 'on_error $LINENO' ERR
[[ $EUID -ne 0 ]] || fail "Run this as the deploy user, not root (files must belong to deploy)."

# ── What to do ───────────────────────────────────────────────────────────────────────────────────────────
MODE=deploy
TARGET=""
FORCE="${SEAMWELL_FORCE:-0}" # 1 = build even if this commit is already live
if [[ "${1:-}" == "--from-ssh" ]]; then
  cmd="${SSH_ORIGINAL_COMMAND:-}"
  if [[ "$cmd" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
    TARGET="${BASH_REMATCH[1]}"
  elif [[ "$cmd" == "status" ]]; then
    MODE=status
  else
    echo "Refused: this key may only run 'deploy <commit sha>' or 'status'." >&2
    exit 2
  fi
else
  case "${1:-}" in
    "") ;;
    rollback) MODE=rollback ;;
    rebuild) FORCE=1 ;;
    status) MODE=status ;;
    *)
      [[ "$1" =~ ^[0-9a-f]{7,40}$ ]] || fail "Usage: deploy.sh [commit-sha | rollback | status]"
      TARGET="$1"
      ;;
  esac
fi

live_name() { if [[ -L "$CURRENT" && -d "$CURRENT" ]]; then basename "$(readlink -f "$CURRENT")"; else echo none; fi; }

if [[ $MODE == status ]]; then
  echo "Live release: $(live_name)"
  echo "Releases on disk:"
  ls -1 "$RELEASES" 2>/dev/null | sort -r | sed 's/^/  /'
  pm2 ls 2>/dev/null | grep -E 'seamwell|name' || true
  exit 0
fi

# One deploy at a time (GitHub + a manual run can't overlap).
exec 9>"$BASE/.deploy.lock"
flock -w 900 9 || fail "Another deploy is still running (waited 15 minutes)."

# ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────
switch_to() { # atomic: the new symlink replaces the old one in a single rename
  ln -sfn "$1" "$BASE/.current.tmp"
  mv -Tf "$BASE/.current.tmp" "$CURRENT"
}

reload_apps() { # fresh PM2 definitions every time (a few seconds' restart), so config changes always apply
  pm2 delete seamwell-api seamwell-web >/dev/null 2>&1 || true
  pm2 start "$CURRENT/deploy/ecosystem.config.cjs" >/dev/null
  pm2 save >/dev/null
}

healthy() {
  local i
  check() { # url, expected text, label
    for i in $(seq 1 30); do
      if curl -fsS --max-time 5 "$1" 2>/dev/null | grep -q "$2"; then note "✓ $3"; return 0; fi
      sleep 2
    done
    warn "$3 is not answering ($1)"
    return 1
  }
  check "http://127.0.0.1:4000/api/health" '"ok":true' "API" &&
    check "http://127.0.0.1:3000/" "Seamwell" "Website" &&
    { [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3000/admin)" == 404 ]] &&
      note "✓ /admin is hidden (404)" || { warn "/admin does not answer 404 — is ADMIN_PATH set in shared/web.env.local?"; return 1; }; }
}

previous_release() { # newest release older than the live one
  local live
  live="$(live_name)"
  ls -1 "$RELEASES" 2>/dev/null | sort | awk -v live="$live" '$0 == live { print prev; exit } { prev = $0 }'
}

# ── Rollback ─────────────────────────────────────────────────────────────────────────────────────────────
if [[ $MODE == rollback ]]; then
  PREV="$(previous_release)"
  [[ -n "$PREV" ]] || fail "No older release on disk to go back to."
  step "Rolling back: $(live_name) → $PREV"
  switch_to "$RELEASES/$PREV"
  reload_apps
  healthy || fail "The previous release is not healthy either — check: pm2 logs --lines 80"
  note "Database changes are not undone (migrations only add, so the older code keeps working)."
  printf '\n\033[1;32m✔ Rolled back to %s\033[0m\n' "$PREV"
  exit 0
fi

# ── Checks before touching anything ─────────────────────────────────────────────────────────────────────
for f in api.env web.env.local; do
  [[ -f "$SHARED/$f" ]] || fail "$SHARED/$f is missing (docs/07-deployment-vps.md §4)"
  chmod 600 "$SHARED/$f"
done
env_value() { sed -n "s/^$2=//p" "$1" | tail -n 1 | tr -d "\r\"' "; } # never printed
API_ADMIN="$(env_value "$SHARED/api.env" ADMIN_PATH)"
WEB_ADMIN="$(env_value "$SHARED/web.env.local" ADMIN_PATH)"
[[ -n "$API_ADMIN" ]] || fail "ADMIN_PATH is missing in shared/api.env (docs §4)"
[[ "$API_ADMIN" == "$WEB_ADMIN" ]] || fail "ADMIN_PATH must be identical in shared/api.env and shared/web.env.local"
mkdir -p "$SHARED/uploads" "$RELEASES"

# ── Code ─────────────────────────────────────────────────────────────────────────────────────────────────
step "Fetching the code"
git -C "$REPO" fetch --prune --quiet origin
SHA="$(git -C "$REPO" rev-parse --verify --quiet "${TARGET:-origin/main}^{commit}")" || fail "Unknown commit: ${TARGET:-origin/main}"
git -C "$REPO" merge-base --is-ancestor "$SHA" origin/main || fail "$SHA is not on main — only code merged into main is deployed."

# Keep repo/ (and so this script) at the latest main. If this script changed, restart with the new version.
SELF_BEFORE="$(sha1sum "$REPO/deploy/deploy.sh" | cut -c1-40)"
git -C "$REPO" checkout --quiet main
git -C "$REPO" merge --quiet --ff-only origin/main || fail "repo/ has local changes — run: git -C $REPO status"
if [[ -z "${SEAMWELL_DEPLOY_REEXEC:-}" && "$(sha1sum "$REPO/deploy/deploy.sh" | cut -c1-40)" != "$SELF_BEFORE" ]]; then
  note "deploy.sh was updated — restarting with the new version"
  exec 9>&-
  SEAMWELL_DEPLOY_REEXEC=1 SEAMWELL_FORCE="$FORCE" exec bash "$REPO/deploy/deploy.sh" "$SHA"
fi
git -C "$REPO" log -1 --format='  deploying %h — %s (%an, %cr)' "$SHA"

if [[ "$FORCE" != 1 && "$(live_name)" == *"-${SHA:0:7}" ]]; then
  note "That commit is already live — nothing to do. (After changing settings: deploy.sh rebuild)"
  exit 0
fi

# ── Build the new release next to the live one ─────────────────────────────────────────────────────────
NEW="$RELEASES/$(date -u +%Y%m%d-%H%M%S)-${SHA:0:7}"
step "Preparing $(basename "$NEW")"
mkdir -p "$NEW"
git -C "$REPO" archive "$SHA" | tar -x -C "$NEW"
ln -s "$SHARED/api.env" "$NEW/apps/api/.env"
ln -s "$SHARED/web.env.local" "$NEW/apps/web/.env.local"
rm -rf -- "$NEW/apps/api/uploads"
ln -s "$SHARED/uploads" "$NEW/apps/api/uploads"

step "Installing dependencies"
(cd "$NEW" && npm ci --no-audit --no-fund --prefer-offline --loglevel=error)

step "Migrating the database"
if [[ -L "$CURRENT" ]] && ! diff -rq "$CURRENT/apps/api/drizzle" "$NEW/apps/api/drizzle" >/dev/null 2>&1; then
  note "This update changes the database — taking a backup first"
  if sudo -n /usr/local/bin/seamwell-backup; then note "✓ backup written"; else warn "No automatic backup (sudo rule from docs §7 missing) — continuing"; fi
fi
(cd "$NEW" && npm run --silent db:migrate)

step "Building API + website (the live site keeps running)"
(cd "$NEW" && npm run --silent build)

# ── Go live ──────────────────────────────────────────────────────────────────────────────────────────────
step "Switching to the new release"
PREV_DIR="" # the release that was live before this deploy (none on the very first deploy)
if [[ -L "$CURRENT" && -d "$CURRENT" ]]; then PREV_DIR="$(readlink -f "$CURRENT")"; fi
switch_to "$NEW"
SWITCHED=1
reload_apps

step "Checking the site"
if ! healthy; then
  printf '\n--- last API errors ---\n' >&2
  pm2 logs seamwell-api --err --lines 25 --nostream 2>&1 | sed -E 's#postgres(ql)?://[^ "]*#[db-url]#g' >&2 || true
  printf '\n--- last website errors ---\n' >&2
  pm2 logs seamwell-web --err --lines 15 --nostream 2>&1 | sed -E 's#postgres(ql)?://[^ "]*#[db-url]#g' >&2 || true
  if [[ -n "$PREV_DIR" && -d "$PREV_DIR" && "$PREV_DIR" != "$(readlink -f "$NEW")" ]]; then
    warn "The new release failed its checks — switching back to $(basename "$PREV_DIR")"
    switch_to "$PREV_DIR"
    reload_apps
    healthy || warn "The previous release is not healthy either!"
  fi
  [[ -n "$PREV_DIR" ]] || { pm2 stop "$CURRENT/deploy/ecosystem.config.cjs" >/dev/null 2>&1 || true; rm -f -- "$CURRENT"; fail "First deploy of ${SHA:0:7} failed its checks — apps stopped. See the errors above (more: pm2 logs --lines 80)."; }
  fail "Deploy of ${SHA:0:7} failed and was rolled back. Logs: pm2 logs --lines 80 (failed build kept in $NEW)"
fi

# ── Tidy up: keep the newest $KEEP releases (never the live one) ─────────────────────────────────────────
LIVE="$(live_name)"
ls -1 "$RELEASES" | sort -r | tail -n +$((KEEP + 1)) | while read -r old; do
  [[ -n "$old" && "$old" != "$LIVE" ]] && rm -rf -- "${RELEASES:?}/$old"
done

printf '\n\033[1;32m✔ Live: %s\033[0m\n' "$LIVE"
