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

All migrations **0012–0026 are applied and live in production.** Status below was verified
against prod with the probe query in the next section (owner-run, output confirmed 2026-07-14 for
0012–0023; re-run 2026-07-26 for 0026); `Applied on` uses each migration's introducing-commit date
as the by-hand-apply proxy (owner may refine specific dates). 0023 (profile visibility + perf
indexes) was applied by hand at its stop-gate on 2026-07-14, after its four-lens review and a
GREEN `seed/matrix-0023.sql` dry-run. 0026 (neighborhood pledge campaigns) was applied by hand at
its stop-gate on 2026-07-26, after a GREEN `seed/matrix-0026.sql` dry-run, and verified against
prod by read-only catalog introspection: all eight functions present and pinning
`search_path = public, pg_temp`, the default `EXECUTE TO PUBLIC` revoked on every one of them,
`pledges` deny-by-default at both layers (RLS on, zero policies, no client grants), the
`removal_token` unique index present, `neighborhoods.threshold` nullable with all 35 seeded rows
and the `profiles` FK intact, and **no new ERROR-level security advisors**.

> ⚠️ **0024 and 0025 are applied in prod but have no rows below.** The 2026-07-26 probe confirms
> `invited_emails` + `enforce_invited_signup()` and the `increment_qr_count()` print variants are
> live. They are omitted rather than invented because their by-hand apply dates aren't recorded
> anywhere this file can cite — the owner should add both rows with the real dates. Until then,
> read the absence of a row as "not yet recorded", **not** as "not applied".

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
| 0026 neighborhood pledge campaigns | `71ad6d0` | 2026-07-26 | by hand, SQL editor | ✅ Applied |

⚠️ 0019 was introduced inside a UI commit (`35f486c`), not its own commit — the anti-pattern the
convention above forbids. It **is** applied (its `file_appeal()` recognizes `post` targets, so
post authors can appeal a removed post — no P7 gap), verified by the probe below.

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
