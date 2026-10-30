#!/usr/bin/env bash
# Logical backup of the database (roles, schema, data incl. auth users) and all
# storage files. Complements Supabase's managed daily backups / PITR.
#
#   SUPABASE_DB_URL=postgresql://... NEXT_PUBLIC_SUPABASE_URL=... \
#   SUPABASE_SERVICE_ROLE_KEY=... scripts/backup.sh [output-dir]
#
# Requires the Supabase CLI (which uses Docker for pg_dump). Store backups
# encrypted and off-site: they contain personal data.
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL (Project Settings → Database → connection string)}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="${1:-backups}/${STAMP}"
mkdir -p "$OUT"

echo "→ Database dump to $OUT"
supabase db dump --db-url "$SUPABASE_DB_URL" --role-only -f "$OUT/roles.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$OUT/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f "$OUT/data.sql"

echo "→ Storage files"
npx tsx scripts/backup-storage.ts "$OUT/storage"

( cd "$OUT" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )
echo "✔ Backup complete: $OUT ($(du -sh "$OUT" | cut -f1))"
