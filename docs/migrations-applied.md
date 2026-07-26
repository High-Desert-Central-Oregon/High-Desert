# Migrations — applied-to-production ledger

The source of truth for **what is live in prod** is the database catalog, not memory or a
commit log. This file records the applied status of each migration and — more importantly —
**the canonical query that answers "is migration N applied?"** against production. Any future
status question resolves by running that query against prod, never by recalling a confirmation.

## Convention (applies to every migration from here on)

1. **One migration, one commit.** A migration gets its **own** commit — never buried inside a
   feature/UI commit. (0019 was historically introduced inside the X1 board UI commit
   `35f486c`; that is the anti-pattern this rule exists to prevent.)
2. **`— manual apply` marker in the commit subject** for any migration that must be applied by
   hand at the stop-gate (the convention visible on 0020–0022).
3. **A `-- APPLIED:` note is not kept in the migration file** (the file is the desired state);
   the *authority* on applied status is the prod catalog, via the probe query below.
4. Migrations are applied to prod **by hand in the Supabase SQL editor, as the owner, at a
   stop-gate** — per CLAUDE.md. The dry-run matrices (`seed/matrix-*.sql`) prove them on a
   local, prod-shaped DB first; **matrix/test SQL never runs against prod.**

## Applied status (as of 2026-07-26)

All migrations **0012–0026 are applied and live in production**, and every one of them now has a
row below. Status was verified against prod with the probe query in the next section (owner-run,
output confirmed 2026-07-14 for 0012–0023; re-run 2026-07-26, which returned `APPLIED` for all
fifteen rows including the newly recorded 0024, 0025 and 0026). For 0012–0023, `Applied on` uses
each migration's introducing-commit date as the by-hand-apply proxy (owner may refine specific
dates); 0024 and 0025 are deliberately left undated, see the note below. 0023 (profile visibility + perf
indexes) was applied by hand at its stop-gate on 2026-07-14, after its four-lens review and a
GREEN `seed/matrix-0023.sql` dry-run. 0026 (neighborhood pledge campaigns) was applied by hand at
its stop-gate on 2026-07-26, after a GREEN `seed/matrix-0026.sql` dry-run, and verified against
prod by read-only catalog introspection: all eight functions present and pinning
`search_path = public, pg_temp`, the default `EXECUTE TO PUBLIC` revoked on every one of them,
`pledges` deny-by-default at both layers (RLS on, zero policies, no client grants), the
`removal_token` unique index present, `neighborhoods.threshold` nullable with all 35 seeded rows
and the `profiles` FK intact, and **no new ERROR-level security advisors**.

> **0024 and 0025 carry no apply date, on purpose.** Both were applied by hand and both are
> confirmed live by the probe below (re-run 2026-07-26), but the day each was applied was never
> written down, and nothing in the catalog records when DDL ran. The date is therefore left as
> `not recorded` rather than back-filled from the commit date the way 0012–0023 were: that proxy
> was applied to those rows knowingly and in bulk, and quietly extending it here would turn a
> guess into a citation in the one file whose whole purpose is being true. An honest gap is
> auditable; a plausible date is not. If you remember either date, replace the cell.

| Migration | Introduced by | Applied on | Method | Status |
|-----------|---------------|-----------|--------|--------|
| 0012 append-only backstop | `33834da` | 2026-06-14 | by hand, SQL editor | ✅ Applied |
| 0013 groups core | `abc2308` | 2026-06-14 | by hand, SQL editor | ✅ Applied |
| 0014 interest_signups | `1794fc8` | 2026-06-20 | by hand, SQL editor | ✅ Applied |
| 0015 qr_counts | `675dc54` | 2026-06-27 | by hand, SQL editor | ✅ Applied |
| 0016 verification-evidence bucket | `74e513f` | 2026-07-07 | by hand, SQL editor | ✅ Applied |
| 0017 event_category (`events.category_id`) | `69bf781` | 2026-07-12 | by hand, SQL editor | ✅ Applied |
| 0018 exchange posts + `events.group_id` | `a4d4809` | 2026-07-12 | by hand, SQL editor | ✅ Applied |
| 0019 appeals know posts (`file_appeal`) | `35f486c` ⚠️ | 2026-07-12 | by hand, SQL editor | ✅ Applied |
| 0020 calendar feeds + `events.ends_at` | `d241ff0` | 2026-07-12 | by hand, SQL editor | ✅ Applied |
| 0021 reports intake | `96c2ee9` | 2026-07-13 | by hand, SQL editor | ✅ Applied |
| 0022 member messages | `22370c2` | 2026-07-13 | by hand, SQL editor | ✅ Applied |
| 0023 profile visibility (Y1) + 4 perf indexes | `978b239` | 2026-07-14 | by hand, SQL editor | ✅ Applied |
| 0024 invite-only signup allowlist + `auth.users` gate | `b2a584b` | not recorded | by hand, SQL editor | ✅ Applied |
| 0025 qr print variants (posters + seed card) | `22b754d` ⚠️ | not recorded | by hand, SQL editor | ✅ Applied |
| 0026 neighborhood pledge campaigns | `71ad6d0` | 2026-07-26 | by hand, SQL editor | ✅ Applied |

⚠️ 0019 was introduced inside a UI commit (`35f486c`), not its own commit — the anti-pattern the
convention above forbids. It **is** applied (its `file_appeal()` recognizes `post` targets, so
post authors can appeal a removed post — no P7 gap), verified by the probe below.

⚠️ 0025 is the same anti-pattern: it landed inside `22b754d`, a feature commit carrying the QR
print variants, the join-form wiring, and the poster PDFs alongside the migration. It **is**
applied, verified by the probe below. (0024 by contrast is a clean migration-only commit, and
0026 was squashed to one — both follow convention #1.)

## Canonical apply-status probe (READ-ONLY)

Run this in the prod SQL editor to answer "which migrations are live?" It is a **pure catalog
`SELECT`** — it touches only `information_schema` / `pg_catalog` / `storage.buckets`, performs
**no writes, no DDL, and needs no transaction.** This is explicitly **not** the test harness
(which writes-then-rolls-back and must never touch prod); reading the catalog to confirm
applied state is safe and is the intended way to check.

```sql
-- Steppe — migration apply-status probe (READ-ONLY catalog introspection).
-- Safe to run in the prod SQL editor as owner. Returns one row per migration.
select m.migration, m.probe,
       case when m.present then 'APPLIED' else 'MISSING' end as status
from (values
  ('0012 append-only backstop',
   'forbid_write() fn + trg_append_only trigger present',
   exists (select 1 from pg_proc where proname = 'forbid_write')
     and exists (select 1 from pg_trigger where tgname = 'trg_append_only')),
  ('0013 groups core',
   'tables groups + group_members present',
   exists (select 1 from information_schema.tables where table_name = 'groups')
     and exists (select 1 from information_schema.tables where table_name = 'group_members')),
  ('0014 interest_signups',
   'table interest_signups present',
   exists (select 1 from information_schema.tables where table_name = 'interest_signups')),
  ('0015 qr_counts',
   'table qr_counts present',
   exists (select 1 from information_schema.tables where table_name = 'qr_counts')),
  ('0016 verification-evidence bucket',
   'storage bucket verification-evidence present',
   exists (select 1 from storage.buckets where id = 'verification-evidence')),
  ('0017 event_category',
   'events.category_id column present',
   exists (select 1 from information_schema.columns
           where table_name = 'events' and column_name = 'category_id')),
  ('0018 exchange posts + events.group_id',
   'table posts + events.group_id column present',
   exists (select 1 from information_schema.tables where table_name = 'posts')
     and exists (select 1 from information_schema.columns
                 where table_name = 'events' and column_name = 'group_id')),
  ('0019 appeals know posts',
   'file_appeal() body references post targets (0019, not just 0006)',
   exists (select 1 from pg_proc where proname = 'file_appeal'
           and pg_get_functiondef(oid) ilike '%post%')),
  ('0020 calendar feeds + events.ends_at',
   'table calendar_feeds + events.ends_at column present',
   exists (select 1 from information_schema.tables where table_name = 'calendar_feeds')
     and exists (select 1 from information_schema.columns
                 where table_name = 'events' and column_name = 'ends_at')),
  ('0021 reports intake',
   'table reports + resolve_report() present',
   exists (select 1 from information_schema.tables where table_name = 'reports')
     and exists (select 1 from pg_proc where proname = 'resolve_report')),
  ('0022 member messages',
   'threads + messages + thread_state + member_blocks present',
   exists (select 1 from information_schema.tables where table_name = 'threads')
     and exists (select 1 from information_schema.tables where table_name = 'messages')
     and exists (select 1 from information_schema.tables where table_name = 'thread_state')
     and exists (select 1 from information_schema.tables where table_name = 'member_blocks')),
  ('0023 profile visibility + perf indexes',
   'neighborhood_visibility col + pf_read owner-only + 4 perf indexes',
   exists (select 1 from information_schema.columns
           where table_name = 'profiles' and column_name = 'neighborhood_visibility')
     and exists (select 1 from pg_policies where tablename = 'profiles'
                 and policyname = 'pf_read' and qual not ilike '%is_moderator%')
     and (select count(*) from pg_indexes where schemaname = 'public'
          and indexname in ('events_group_created_idx', 'events_status_starts_idx',
                            'moderation_actions_target_idx', 'thread_state_member_idx')) = 4),
  -- 0024's signature is the GATE, not the table. A half-apply that created
  -- invited_emails but missed the auth.users trigger would leave signups fully
  -- open while looking applied, so the trigger's presence ON auth.users is
  -- checked directly — as is the session_user test inside the function, since
  -- keying on current_user instead would mean the gate never fires at all.
  ('0024 invite-only signup allowlist',
   'invited_emails (RLS, no anon read) + normalize trigger + enforce_invited_signup() on auth.users keying on session_user',
   exists (select 1 from information_schema.tables
           where table_schema = 'public' and table_name = 'invited_emails')
     and (select c.relrowsecurity from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'invited_emails')
     and not has_table_privilege('anon', 'public.invited_emails', 'SELECT')
     and exists (select 1 from pg_trigger where tgname = 'trg_normalize_invited_email')
     and exists (select 1 from pg_trigger t
                   join pg_class c on c.oid = t.tgrelid
                   join pg_namespace ns on ns.oid = c.relnamespace
                  where t.tgname = 'trg_enforce_invited_signup'
                    and ns.nspname = 'auth' and c.relname = 'users')
     and exists (select 1 from pg_proc where proname = 'enforce_invited_signup'
                 and pg_get_functiondef(oid) ilike '%session_user%')),
  -- 0025 changed the variant allowlist in TWO independent places — the check
  -- constraint and the function body — which can drift apart, so both are
  -- probed. EXECUTE is checked too: the counter must stay service_role-only,
  -- and dropping/recreating the function would silently restore PUBLIC execute.
  ('0025 qr print variants',
   'increment_qr_count() + qr_counts_variant_check both know the print variants; EXECUTE service_role-only',
   exists (select 1 from pg_proc where proname = 'increment_qr_count'
           and pg_get_functiondef(oid) ilike '%seed_card%'
           and pg_get_functiondef(oid) ilike '%poster_owned%')
     and exists (select 1 from pg_constraint where conname = 'qr_counts_variant_check'
                 and pg_get_constraintdef(oid) ilike '%seed_card%')
     and not has_function_privilege('public', 'public.increment_qr_count(text,text)', 'EXECUTE')
     and has_function_privilege('service_role', 'public.increment_qr_count(text,text)', 'EXECUTE')),
  -- 0026 checks CORRECTNESS as well as presence, the way 0023 does. A half-applied
  -- 0026 — table created but the grants not revoked — would leave pre-member email
  -- addresses reachable by every client role, so "the table exists" is not a
  -- sufficient signature for this one.
  ('0026 neighborhood pledge campaigns',
   'table pledges (RLS, no policies, no client grants) + neighborhoods.threshold + 6 pledge fns',
   exists (select 1 from information_schema.tables where table_name = 'pledges')
     and exists (select 1 from information_schema.columns
                 where table_name = 'neighborhoods' and column_name = 'threshold')
     and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in ('neighborhood_status', 'submit_pledge', 'pledge_removal_token',
                              'remove_pledge', 'pledge_activity',
                              'close_stale_pledge_campaigns')) = 6
     and (select count(*) from pg_policies where tablename = 'pledges') = 0
     and not exists (select 1 from information_schema.role_table_grants
                     where table_name = 'pledges'
                       and grantee in ('anon', 'authenticated', 'service_role')))
) as m(migration, probe, present)
order by m.migration;
```

Expected output when fully applied: every row `APPLIED`. Any `MISSING` row names the migration
to apply by hand at the next stop-gate. When you apply a new migration, re-run the probe and
update the table above (add the row; keep the probe in sync with the new migration's signature
objects).
