#!/usr/bin/env bash
# Disaster recovery: restore a backup made by scripts/backup.sh into a NEW,
# EMPTY Supabase project whose schema was created with `supabase db push`.
#
#   TARGET_DB_URL=postgresql://... NEXT_PUBLIC_SUPABASE_URL=<target> \
#   SUPABASE_SERVICE_ROLE_KEY=<target key> scripts/restore.sh backups/<stamp>
#
# Refuses to run against a database that already has users or students.
set -euo pipefail
: "${TARGET_DB_URL:?Set TARGET_DB_URL to the database connection string of the NEW project}"
DIR="${1:?Usage: scripts/restore.sh <backup-dir>}"
( cd "$DIR" && sha256sum --quiet -c SHA256SUMS ) || { echo "Checksum mismatch — backup is corrupt"; exit 1; }

EXISTING=$(psql "$TARGET_DB_URL" -At -c "select (select count(*) from auth.users) + (select count(*) from public.students)")
if [ "$EXISTING" != "0" ]; then
  echo "Target already contains $EXISTING users/students. Refusing to overwrite a live database."
  exit 1
fi

# Storage rows are owned by the storage service: files are re-uploaded through
# the API below and buckets come from migrations, so skip the storage schema.
FILTERED=$(mktemp)
awk '/^COPY "(storage|supabase_functions)"\./{skip=1} skip&&/^\\\.$/{skip=0; next} !skip' "$DIR/data.sql" > "$FILTERED"

echo "→ Restoring database rows"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -c "SET session_replication_role = replica" \
  -c "TRUNCATE public.site_settings, public.pages, public.menu_items, public.banners, public.grade_rules, public.audit_logs CASCADE" \
  -f "$FILTERED" >/dev/null
rm -f "$FILTERED"

echo "→ Restoring storage files"
npx tsx scripts/restore-storage.ts "$DIR/storage"
echo "✔ Restore complete. Verify counts and sign in before switching traffic."
