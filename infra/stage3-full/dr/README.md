# Stage 3 DR runbook (SKELETON — flesh out during staging build-out)

**Why this document gates everything:** self-hosted Supabase has **no managed
backups and no PITR** — those are platform features that do not exist here. The
roadmap (docs/decisions/selfhosting-staged-roadmap.md, Stage 3) gates the
production cutover on **this drill passing**, because an untested restore is not
DR — it's a hope. This runbook, once rehearsed, doubles as the provider-migration
runbook (that's the re-evaluation escape hatch in the jurisdiction decision).

## The three layers

1. **pgBackRest WAL archiving → S3-compatible object storage** (continuous).
   Full backup nightly + WAL segments as they close → point-in-time capability.
   Config lands beside the db service (compose header notes the mount); env
   names in `.env.template` (`PGBACKREST_*`). Encrypt the repo
   (`PGBACKREST_CIPHER_PASS`) — and store that passphrase OFF the box; an
   encrypted backup whose only key died with the machine is not a backup.
2. **Nightly provider snapshot** of the whole VM volume (provider control
   panel / API). Fast whole-box rollback; NOT sufficient alone (same provider,
   same failure domain).
3. **Off-provider encrypted copy** — sync the pgBackRest repo to a second,
   unrelated object store (`OFFSITE_*` names) on a schedule.
   **The off-provider copy must be US-domiciled per the roadmap decision
   (jurisdictional redundancy — e.g. Backblaze B2, US region); see
   `docs/decisions/selfhosting-staged-roadmap.md` → "Hosting jurisdiction —
   DECIDED".** Also verify storage-api objects (the `verification-evidence`
   bucket is transient by design, but group avatars etc. live on the storage
   volume) are covered by layers 2–3.

## RESTORE DRILL — the actual gate

Run on the staging box. Production does not cut over until every line is checked
and the drill is signed off.

- [ ] **Wipe staging**: destroy the staging stack + volumes (`docker compose
      down -v`) — genuinely gone, no cheating from a warm volume.
- [ ] **Restore** from the object-storage repo alone (pgBackRest restore to
      latest, then to an arbitrary earlier point-in-time — both paths).
- [ ] **Verify auth**: magic-link login round-trips against the restored stack
      (GoTrue up, JWT_SECRET correct, a seeded member resolves).
- [ ] **Verify RLS**: the rls-audit spot checks — a member reads own profile,
      cannot read another's ballot (`votes` self-only), `interest_signups`
      denied to anon, append-only triggers still refuse an UPDATE.
- [ ] **Verify data**: row counts vs. source for profiles / votes / audit_log;
      one storage object round-trips.
- [ ] **Time it**: record wall-clock from "box empty" to "verified" — that
      number IS the real RPO/RTO conversation, not an aspiration.
- [ ] **Sign off**: date, operator, restore time, issues found → append below.
      A second person must be able to execute this runbook without its author.

## Drill log

| Date | Operator | From-empty restore time | Result / issues |
|---|---|---|---|
| _none yet — production cutover is blocked until this table has a passing row_ | | | |
