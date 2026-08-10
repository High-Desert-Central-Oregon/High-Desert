#!/usr/bin/env sh
# check-migration-numbers.sh — fail when one migration number is claimed by two
# different pieces of work.
#
# WHY THIS EXISTS. On 2026-08-10 the number 0030 was claimed three ways at once:
#   · migrations/0030_view_owner_rights_restore.sql  (applied to prod, pushed)
#   · migrations/0030_join_signup_source.sql         (written locally, unpushed)
#   · docs/spec/notices-n1-spec-v1.md                (proposing 0030_notices_and_sources.sql)
# Each was written by someone who had checked "the last applied migration" and got
# a different answer, because each was looking at a different branch. Nothing in
# the repo compared them, so all three looked correct in isolation. Two of the
# three also claimed the same dry-run path, seed/matrix-0030.sql.
#
# A migration number is a name for one piece of work. This checks that it stays
# one — ACROSS BRANCHES, because a single branch can never see the collision.
#
# WHAT COUNTS AS A CLAIM. Only a migration FILENAME (`NNNN_slug.sql`) names a
# piece of work, so only a filename creates a "subject" for a number:
#   1. migrations/NNNN_slug.sql on any ref            -> subject NNNN_slug.sql
#   2. seed/matrix-NNNN.sql on any ref                -> subject resolved, in order:
#        a. an NNNN_slug.sql named inside the matrix body
#        b. its sibling migrations/NNNN_*.sql on the SAME ref
#        c. matrix-NNNN@<blob8>  (orphan matrix — identified by content, so two
#           different orphan matrices for one number still collide)
#   3. an NNNN_slug.sql named in docs/spec/** or DECISIONS.md -> subject NNNN_slug.sql
#
# A number with two or more distinct subjects is a collision and fails the run.
#
# Bare by-number prose ("migration 0030 backfills…") and bare `matrix-NNNN.sql`
# paths deliberately do NOT create a subject. They name a number without naming
# the work, so treating them as claims would flag a spec for referring to its own
# migration twice. The filename is the identity; the prose follows it.
#
# docs/migrations-applied.md is deliberately OUT of scope: the ledger's job is to
# name every migration filename that ever ran, so scanning it would make every
# historical number look multiply-claimed.
#
# USAGE
#   scripts/check-migration-numbers.sh                 # every local + remote ref
#   scripts/check-migration-numbers.sh REF [REF...]    # only these refs
#
# Exit 0 = every number names one thing. Exit 1 = collision (details on stdout).
# POSIX sh: no bashisms, no associative arrays — it runs in alpine/git under CI.
set -eu

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
CLAIMS="$TMP/claims.tsv"   # number <TAB> subject <TAB> where
: > "$CLAIMS"

# --- which refs -------------------------------------------------------------
if [ "$#" -gt 0 ]; then
  REFS="$*"
else
  REFS="$(git for-each-ref --format='%(refname:short)' refs/heads/ refs/remotes/)"
fi

nrefs=0
for ref in $REFS; do
  git rev-parse --verify --quiet "$ref^{commit}" >/dev/null 2>&1 || {
    echo "check-migration-numbers: no such ref: $ref" >&2; exit 2; }
  nrefs=$((nrefs + 1))
done
echo "Scanning $nrefs ref(s) for migration-number collisions."

# --- 1 · migration files ----------------------------------------------------
for ref in $REFS; do
  git ls-tree -r --name-only "$ref" -- migrations/ 2>/dev/null \
  | sed -n 's|^migrations/\(00[0-9][0-9]_[A-Za-z0-9_]*\.sql\)$|\1|p' \
  | while read -r base; do
      num=$(printf '%s' "$base" | cut -c1-4)
      printf '%s\t%s\tmigration file on %s\n' "$num" "$base" "$ref" >> "$CLAIMS"
    done
done

# --- 2 · dry-run matrix files ----------------------------------------------
for ref in $REFS; do
  git ls-tree -r --name-only "$ref" -- seed/ 2>/dev/null \
  | sed -n 's|^seed/matrix-\(00[0-9][0-9]\)\.sql$|\1|p' \
  | while read -r num; do
      body="$(git show "$ref:seed/matrix-$num.sql" 2>/dev/null || true)"
      # (a) a migration filename named inside the matrix body
      subj="$(printf '%s' "$body" | grep -oE "${num}_[A-Za-z0-9_]+\.sql" | head -1 || true)"
      if [ -z "$subj" ]; then
        # (b) the sibling migration on this same ref
        subj="$(git ls-tree -r --name-only "$ref" -- migrations/ 2>/dev/null \
                | sed -n "s|^migrations/\(${num}_[A-Za-z0-9_]*\.sql\)$|\1|p" | head -1 || true)"
      fi
      if [ -z "$subj" ]; then
        # (c) orphan matrix — identify it by content so two differing orphans collide
        blob="$(git rev-parse "$ref:seed/matrix-$num.sql" 2>/dev/null | cut -c1-8)"
        subj="matrix-$num@$blob"
      fi
      printf '%s\t%s\tmatrix seed/matrix-%s.sql on %s\n' "$num" "$subj" "$num" "$ref" >> "$CLAIMS"
    done
done

# --- 3 · by-number references in docs/spec/** and DECISIONS.md --------------
for ref in $REFS; do
  docs="$(git ls-tree -r --name-only "$ref" -- docs/spec/ 2>/dev/null || true)"
  git cat-file -e "$ref:DECISIONS.md" 2>/dev/null && docs="$docs DECISIONS.md"
  for f in $docs; do
    git show "$ref:$f" 2>/dev/null \
    | grep -oE '\b00[0-9][0-9]_[A-Za-z0-9_]+\.sql' \
    | sort -u \
    | while read -r subj; do
        num=$(printf '%s' "$subj" | cut -c1-4)
        printf '%s\t%s\tnamed in %s on %s\n' "$num" "$subj" "$f" "$ref" >> "$CLAIMS"
      done
  done
done

# --- report -----------------------------------------------------------------
if [ ! -s "$CLAIMS" ]; then
  echo "No migration numbers found on the scanned refs — nothing to check."
  exit 0
fi

NUMS="$(cut -f1 "$CLAIMS" | sort -u)"
fail=0
for num in $NUMS; do
  subjects="$(awk -F'\t' -v n="$num" '$1==n {print $2}' "$CLAIMS" | sort -u)"
  count="$(printf '%s\n' "$subjects" | grep -c . || true)"
  if [ "$count" -gt 1 ]; then
    fail=1
    echo ""
    echo "COLLISION: migration number $num names $count different things:"
    printf '%s\n' "$subjects" | while read -r s; do
      [ -z "$s" ] && continue
      echo "  - $s"
      awk -F'\t' -v n="$num" -v s="$s" '$1==n && $2==s {print "      " $3}' "$CLAIMS" | sort -u
    done
  fi
done

echo ""
if [ "$fail" -ne 0 ]; then
  echo "FAIL: a migration number must name exactly one piece of work."
  echo ""
  echo "Renumber whichever claimant is NOT yet applied to production. The applied"
  echo "one cannot move — its number is already recorded in the ledger and in the"
  echo "prod catalog. Check what is actually applied with the probe in"
  echo "docs/migrations-applied.md; do not trust a branch's own notes about which"
  echo "number is next, which is how every one of these collisions has started."
  exit 1
fi

echo "OK: $(printf '%s\n' "$NUMS" | grep -c .) migration number(s) checked, each naming exactly one piece of work."
