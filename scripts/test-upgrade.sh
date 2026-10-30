#!/usr/bin/env bash
# Upgrade-path regression test — LOCAL ONLY: it resets the LOCAL Supabase
# database (never a linked/hosted project).
#
# 1. Rebuilds the local database at the last deployed migration (BASE_VERSION)
#    with the seed data, and adds history a running deployment has: published
#    results, valid certificates and a superseded (reissued) certificate.
# 2. Applies every newer migration the way `supabase db push` does: one
#    transaction per file, through a temporary login role that switches to
#    `postgres` (session_user is NOT `postgres`, as with the CLI's temporary
#    login), recording each version in supabase_migrations.schema_migrations.
# 3. Asserts that every migration applied, existing results/certificates/
#    students are unchanged, certificates and result sheets still verify, and
#    the result guards are active again.
#
# Usage: npm run test:upgrade   (afterwards: npm run seed:users -- --test-users)
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_VERSION="${BASE_VERSION:-20261030000800}"
PROJECT_ID=$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)
CONTAINER="supabase_db_${PROJECT_ID}"
LOGIN_ROLE=upgrade_test_login
LOGIN_PASSWORD="upgrade-test-$RANDOM$RANDOM"

docker inspect "$CONTAINER" >/dev/null 2>&1 || { echo "Local Supabase is not running (supabase start)." >&2; exit 1; }

# sql <user> <password> [psql args...] — SQL on stdin, inside the local DB container
sql() {
  local user=$1 password=$2
  shift 2
  docker exec -i -e PGPASSWORD="$password" "$CONTAINER" psql -h 127.0.0.1 -U "$user" -d postgres -v ON_ERROR_STOP=1 -q -X "$@"
}
cleanup() {
  sql supabase_admin postgres -c "drop role if exists $LOGIN_ROLE" </dev/null >/dev/null 2>&1 || true
  sql postgres postgres -c "drop schema if exists upgrade_check cascade" </dev/null >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "1/4 Local database at migration $BASE_VERSION + seed data"
npx supabase db reset --version "$BASE_VERSION" >/dev/null
for _ in $(seq 1 30); do sql postgres postgres -c "select 1" </dev/null >/dev/null 2>&1 && break; sleep 2; done

echo "2/4 Existing history (published results, valid and superseded certificates)"
sql postgres postgres < tests/upgrade/setup.sql

echo "3/4 Applying newer migrations as a CLI-style login role"
sql supabase_admin postgres -c "drop role if exists $LOGIN_ROLE; create role $LOGIN_ROLE login password '$LOGIN_PASSWORD' noinherit; grant postgres to $LOGIN_ROLE;" </dev/null
applied=0
for file in supabase/migrations/*.sql; do
  base=$(basename "$file" .sql)
  version=${base%%_*}
  [[ "$version" > "$BASE_VERSION" ]] || continue
  echo "    $base"
  {
    echo "set role postgres;"
    cat "$file"
    echo
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '${base#*_}');"
  } | sql "$LOGIN_ROLE" "$LOGIN_PASSWORD" -1 -f -
  applied=$((applied + 1))
done
[[ $applied -gt 0 ]] || { echo "No migrations newer than $BASE_VERSION." >&2; exit 1; }

echo "4/4 Assertions"
sql postgres postgres < tests/upgrade/assert.sql
sql "$LOGIN_ROLE" "$LOGIN_PASSWORD" < tests/upgrade/assert-guards.sql

echo "✔ Upgrade path OK ($applied migrations). Run 'npm run seed:users -- --test-users' before other tests."
