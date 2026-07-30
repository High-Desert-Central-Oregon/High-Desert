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
5. **Grants, privileges, and object definitions are READ FROM PROD at the stop-gate — never
   inferred from a local pass.** A local matrix proves *logic*; it cannot prove *privilege*.
   The two environments apply different default ACLs: tables created under `supabase_admin`'s
   defaults receive `arwdDxtm` (**all**, DML included), while under `postgres`'s defaults they
   receive `Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, **no DML**). Local uses the
   restrictive set; prod uses the permissive one. Every explicit `GRANT` in a migration is
   therefore *additive on top of a default we did not choose*, and only an explicit `REVOKE`
   narrows anything.

   **The proof that this is not theoretical.** `seed/matrix-0025.sql` case 5e asserts
   `has_table_privilege('anon','public.qr_counts','insert')` is false. Locally it **is**
   false, so the case passes. In prod `anon` **holds** INSERT, so the same case would fail.
   The assertion is correct; the substrate is not representative. No local suite can detect
   prod's wider grants by construction, and a green matrix must never be read as evidence
   about privileges.
6. **Supabase advisor remediations are applied as MIGRATIONS, never from the dashboard.**
   The advisor panel is a *reporting* surface. Its one-click fixes are DDL that lands outside
   the migration record, where nothing reviews it, nothing tests it, and the ledger keeps
   reporting `APPLIED` for a state that no longer matches the repo. If an advisor is right,
   the fix is a migration citing the advisor; if it is wrong, the reason goes in a decision
   record. Neither outcome is a button.

   **Recorded instance (2026-07-30).** The `security_definer_view` advisor's remediation was
   applied from the dashboard. It set `security_invoker = on` on **all four** public views and,
   because a view drop/create re-applies the project's default privileges, handed `anon`
   **all seven** privileges on each. Two of those views are owner-rights **by design**, so the
   change did not harden them — it broke them silently: `public_profiles` began returning a
   member only their own row (the single cross-member read path, nine call sites), and
   `proposal_results` began returning each reader a tally of their own single ballot (the only
   sanctioned read path for governance results, invariant 4). Nothing in the migration record
   noticed for either. Migration 0028 restores both and pins the intent at the object.

## Applied status (as of 2026-07-29)

All migrations **0012–0027 are applied and live in production**, and every one of them now has a
row below. Status was verified against prod with the probe query in the next section (owner-run,
output confirmed 2026-07-14 for 0012–0023; re-run 2026-07-26, which returned `APPLIED` for all
fifteen rows including the newly recorded 0024, 0025 and 0026; re-run again 2026-07-29, which
returned `APPLIED` for all sixteen rows including the newly recorded 0027). **0028 is written but NOT applied** — the probe below therefore has seventeen tuples and is expected to report `MISSING` for 0028 until it is applied at its stop-gate. For 0012–0023, `Applied on` uses
each migration's introducing-commit date as the by-hand-apply proxy (owner may refine specific
dates); 0024 and 0025 are deliberately left undated, see the note below. 0023 (profile visibility + perf
indexes) was applied by hand at its stop-gate on 2026-07-14, after its four-lens review and a
GREEN `seed/matrix-0023.sql` dry-run. 0026 (neighborhood pledge campaigns) was applied by hand at
its stop-gate on 2026-07-26, after a GREEN `seed/matrix-0026.sql` dry-run, and verified against
prod by read-only catalog introspection: all eight functions present and pinning
`search_path = public, pg_temp`, the default `EXECUTE TO PUBLIC` revoked on every one of them,
`pledges` deny-by-default at both layers (RLS on, zero policies, no client grants), the
`removal_token` unique index present, `neighborhoods.threshold` nullable with all 35 seeded rows
and the `profiles` FK intact, and **no new ERROR-level security advisors**. 0027 (invite tokens —
bearer, capped) was applied by hand at its stop-gate on 2026-07-29, after a GREEN
`seed/matrix-0027.sql` dry-run, and verified against prod by the probe tuple below: both tables
(`invite_tokens`, `invite_redemptions`) and both functions (`redeem_invite`,
`purge_stale_invites`) present, exactly **2** policies across the two tables and both
moderator-only, and **nothing reachable by `anon`** — with the table privileges and the function
privileges asserted **separately**, because they live in different catalogs
(`information_schema.role_table_grants` vs `has_function_privilege`) and a single clause covering
"no anon grant" was true and false at the same time in an earlier draft. The `PUBLIC` default
`EXECUTE` is confirmed revoked on both functions. `invite_tokens.neighborhood_id` is nullable with
its delete rule asserted rather than assumed — `pg_constraint.confdeltype = 'n'` (SET NULL), since
the column existing says nothing about whether deleting a neighborhood would take its tokens with
it. `profiles.invited_by` is confirmed absent: the invite graph stayed inside its subsystem. The
regression criterion held — `enforce_invited_signup()` was confirmed **byte-identical in
production after the apply**, `sha256(pg_get_functiondef(...))` =
`8f2f632e92d2eab9900fd11b9a0bd9156c2f867bedff33d211f322086366532e`, unchanged from the pre-build
baseline: the write path to the allowlist was added without touching the gate that reads it. The
applied file was `migrations/0027_invite_tokens.sql` at SHA-256
`26451c0b8194cb764589f8556f4d3fc2bd7c3f557c18344ae616083ed96a2d7a`, recorded so this ledger says
**which bytes** were applied and not merely which number.

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
| 0027 invite tokens (bearer, capped) | `9899c0c` | 2026-07-29 | by hand, SQL editor | ✅ Applied |
| 0028 view grants + owner rights (`public_profiles`, `proposal_results`) | _this branch_ | — | by hand, SQL editor | ⏳ **Not yet applied** |

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
  -- 0023 also asserts public_profiles is OWNER-RIGHTS. Added after a dashboard
  -- advisor remediation flipped it to security_invoker=on in prod while this
  -- probe still reported APPLIED — the view is the single cross-member read path
  -- and under invoker rights it silently returns a member only their own row.
  -- An ABSENT reloption and security_invoker=off are both owner rights, so the
  -- assertion is NOT-on rather than equality to a literal.
  ('0023 profile visibility + perf indexes',
   'neighborhood_visibility col + pf_read owner-only + 4 perf indexes + public_profiles owner-rights',
   exists (select 1 from information_schema.columns
           where table_name = 'profiles' and column_name = 'neighborhood_visibility')
     and exists (select 1 from pg_policies where tablename = 'profiles'
                 and policyname = 'pf_read' and qual not ilike '%is_moderator%')
     and (select count(*) from pg_indexes where schemaname = 'public'
          and indexname in ('events_group_created_idx', 'events_status_starts_idx',
                            'moderation_actions_target_idx', 'thread_state_member_idx')) = 4
     and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relname = 'public_profiles'
                       and coalesce(array_to_string(c.reloptions, ','), '') ilike '%security_invoker=on%')),
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
                       and grantee in ('anon', 'authenticated', 'service_role'))),
  -- 0027's two anon assertions are SEPARATE on purpose. An earlier draft of this
  -- clause checked only `information_schema.role_table_grants ... grantee='anon'`
  -- and reported APPLIED while anon held EXECUTE on redeem_invite — table grants
  -- and function grants live in different catalogs, so one clause covering "no
  -- anon grant" could be true and false at the same time and still pass. Table
  -- privileges and function privileges are now asserted independently, and each
  -- names which surface it covers. Kept character-identical to the header of
  -- migrations/0027_invite_tokens.sql, which is the applied file.
  ('0027 invite tokens',
   'tables + fns + moderator-only RLS + NOTHING reachable by anon + nullable SET NULL neighborhood_id + no profiles.invited_by',
   exists (select 1 from information_schema.tables
            where table_schema='public' and table_name='invite_tokens')
     and exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='invite_redemptions')
     and exists (select 1 from pg_proc where proname='redeem_invite')
     and exists (select 1 from pg_proc where proname='purge_stale_invites')
     and (select count(*) from pg_policies
           where tablename in ('invite_tokens','invite_redemptions')) = 2
     -- (i) no anon DML on either table
     and not exists (select 1 from information_schema.role_table_grants
                      where table_schema='public'
                        and table_name in ('invite_tokens','invite_redemptions')
                        and grantee='anon')
     -- (ii) no anon EXECUTE on either function, and no PUBLIC default either
     and not has_function_privilege('anon','public.redeem_invite(text,text)','EXECUTE')
     and not has_function_privilege('anon','public.purge_stale_invites(interval)','EXECUTE')
     and not has_function_privilege('public','public.redeem_invite(text,text)','EXECUTE')
     and not has_function_privilege('public','public.purge_stale_invites(interval)','EXECUTE')
     -- (iii) the neighborhood reference exists, is nullable, and its delete
     --       rule is SET NULL ('n'). The delete rule is asserted, not assumed:
     --       the column existing says nothing about whether deleting a
     --       neighborhood would take its tokens with it (G-INV-6).
     and exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='invite_tokens'
                    and column_name='neighborhood_id' and is_nullable='YES')
     and exists (select 1 from pg_constraint c
                  where c.conrelid = 'public.invite_tokens'::regclass
                    and c.contype = 'f'
                    and c.confrelid = 'public.neighborhoods'::regclass
                    and c.confdeltype = 'n')
     -- the invite graph did not escape its subsystem (G-INV-2)
     and not exists (select 1 from information_schema.columns
                      where table_name='profiles' and column_name='invited_by')),
  -- 0028 covers BOTH catalogs on purpose. Privileges live in
  -- information_schema.role_table_grants; reloptions live in pg_class. A probe
  -- checking only one could report APPLIED while the other half was wrong —
  -- which is exactly how the advisor drift survived unnoticed.
  ('0028 view grants + owner rights',
   'anon holds nothing on the four views; public_profiles and proposal_results back to owner rights',
   not exists (select 1 from information_schema.role_table_grants
                where table_schema='public'
                  and table_name in ('public_profiles','proposal_results',
                                     'content_moderation','groups_directory')
                  and grantee in ('anon','PUBLIC'))
     and not exists (select 1 from information_schema.role_table_grants
                      where table_schema='public'
                        and table_name in ('public_profiles','proposal_results',
                                           'content_moderation','groups_directory')
                        and grantee='authenticated'
                        and privilege_type <> 'SELECT')
     and not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                      where n.nspname='public'
                        and c.relname in ('public_profiles','proposal_results')
                        and coalesce(array_to_string(c.reloptions,','),'') ilike '%security_invoker=on%')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname='public' and c.relname='content_moderation'
                    and coalesce(array_to_string(c.reloptions,','),'') ilike '%security_invoker=on%'))
) as m(migration, probe, present)
order by m.migration;
```

Expected output when fully applied: every row `APPLIED`. Any `MISSING` row names the migration
to apply by hand at the next stop-gate. When you apply a new migration, re-run the probe and
update the table above (add the row; keep the probe in sync with the new migration's signature
objects).
