#!/usr/bin/env bash
# Nightly encrypted backup of the database AND the uploaded photos. Install (once):
#   sudo cp /var/www/seamwell/repo/deploy/backup-db.sh /usr/local/bin/seamwell-backup && sudo chmod 700 /usr/local/bin/seamwell-backup
#   openssl rand -base64 36 | sed 's/^/BACKUP_PASSPHRASE=/' | sudo tee /root/.seamwell-backup.env >/dev/null && sudo chmod 600 /root/.seamwell-backup.env
#   sudo cat /root/.seamwell-backup.env   → copy the passphrase into your password manager (without it backups can't be restored)
#   (sudo crontab -l 2>/dev/null; echo "30 2 * * * /usr/local/bin/seamwell-backup >> /var/log/seamwell-backup.log 2>&1") | sudo crontab -
#   # let deploy.sh take a backup by itself before database changes (this one command only):
#   echo 'deploy ALL=(root) NOPASSWD: /usr/local/bin/seamwell-backup' | sudo tee /etc/sudoers.d/seamwell-backup >/dev/null && sudo chmod 440 /etc/sudoers.d/seamwell-backup && sudo visudo -c
# Test now:  sudo /usr/local/bin/seamwell-backup && sudo ls -lh /var/backups/seamwell
set -euo pipefail
source /root/.seamwell-backup.env
DIR=/var/backups/seamwell
UPLOADS=/var/www/seamwell/shared/uploads
STAMP=$(date +%F)
mkdir -p "$DIR" && chmod 700 "$DIR"

DB_FILE="$DIR/seamwell-db-$STAMP.sql.gz.gpg"
sudo -u postgres pg_dump --no-owner --no-privileges seamwell | gzip | gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -c -o "$DB_FILE"

UP_FILE="$DIR/seamwell-uploads-$STAMP.tar.gz.gpg"
if [[ -d "$UPLOADS" ]]; then
  tar -C "$UPLOADS" -czf - . | gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -c -o "$UP_FILE"
fi

find "$DIR" -name 'seamwell-*.gpg' -mtime +14 -delete
echo "$(date -Is) backup written: $DB_FILE $( [[ -f $UP_FILE ]] && echo "+ $UP_FILE")"

# ── Restore (test this monthly on a scratch database) ─────────────────────────────────────────────
#   source /root/.seamwell-backup.env
#   sudo -u postgres createdb seamwell_restore_test
#   gpg --batch --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -d FILE.sql.gz.gpg | gunzip | sudo -u postgres psql -q seamwell_restore_test
#   sudo -u postgres psql seamwell_restore_test -c "select count(*) from orders"   # sanity check
#   sudo -u postgres dropdb seamwell_restore_test
# Photos:  gpg ... -d FILE.tar.gz.gpg | sudo -u deploy tar -C /var/www/seamwell/shared/uploads -xzf -
