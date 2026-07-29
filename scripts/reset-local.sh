#!/usr/bin/env bash
# reset-local.sh — rebuild the LOCAL database from scratch, ending with the seed
# the test suite needs.
#
# WHY THIS EXISTS. `supabase db reset` alone does not rebuild this project.
# There is no supabase/migrations/ directory and no supabase/seed.sql, so a bare
# reset leaves an empty database and the reset path was three commands people
# remembered in a different order each time. Worse, the last one was easy to
# forget: seed/dry-run-accounts.sql is what set-field-visibility.test.ts and
# set-neighborhood.test.ts sign in with, so a fresh reset used to leave two test
# files failing with "local sign-in failed (is the dry-run seed loaded?)" — which
# reads like a code regression and is not one. Reloading the seed is the last
# step here so a fresh reset leaves the suite green.
#
# LOCAL ONLY. It refuses to run against anything but a loopback host. Matrix and
# seed SQL never run against production, under any framing (CLAUDE.md).
set -euo pipefail

DB="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- the guard -------------------------------------------------------------
# Everything below drops and rewrites a database. A host that is not loopback is
# not the local stack, and there is no flag to override this.
host="$(printf '%s' "$DB" | sed -E 's#^[^@]*@##; s#[:/].*$##')"
case "$host" in
  127.0.0.1|localhost|::1|"[::1]") ;;
  *)
    echo "reset-local: refusing to touch a non-local host ($host)." >&2
    echo "This script drops and rebuilds the database. Local stack only." >&2
    exit 1
    ;;
esac

psql_run() { psql "$DB" -v ON_ERROR_STOP=1 -q -f "$1"; }

echo "==> supabase db reset (no seed — this project's seeds are applied below)"
supabase db reset --no-seed --workdir "$REPO"

echo "==> schema.sql (baseline through migration 0015)"
psql_run "$REPO/schema.sql"

# Every migration after the baseline, in filename order. Enumerated rather than
# hardcoded so adding 0028 needs no edit here — and the floor is a number, not a
# glob, so it stays right at 0100.
echo "==> migrations after 0015, in order"
for f in "$REPO"/migrations/*.sql; do
  num="$(basename "$f")"; num="${num%%_*}"
  [ "$((10#$num))" -gt 15 ] || continue
  echo "    - $(basename "$f")"
  psql_run "$f"
done

# --- the step that used to get forgotten -----------------------------------
echo "==> seed/dry-run-accounts.sql (6 personas the suite signs in as)"
psql_run "$REPO/seed/dry-run-accounts.sql"

echo
echo "Local database rebuilt. Verify with: cd steppe && npm test"
