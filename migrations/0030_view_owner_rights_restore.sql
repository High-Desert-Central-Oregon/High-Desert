-- ============================================================================
-- Migration 0030 — restore owner rights on three views — MANUAL APPLY
-- ----------------------------------------------------------------------------
-- THIS IS THE SECOND OUT-OF-BAND REVERT OF THE SAME DELIBERATE DESIGN.
--
--   0023 (2026-07-14)  set public_profiles to owner rights ON PURPOSE, and said
--                      so in its own comment: "OWNER-RIGHTS view:
--                      security_invoker = false … so it reads PAST the narrowed
--                      base pf_read — that is precisely what makes it the single
--                      cross-member read path".
--   2026-07-30         a dashboard-applied advisor remediation flipped all four
--                      public views to security_invoker=on and, because that run
--                      recreated them, also reset their privileges.
--   0028 (2026-07-30)  restored owner rights on three of the four and revoked
--                      the anon grants the remediation had handed back.
--   2026-07-31         flipped to security_invoker=on AGAIN. This migration.
--
-- Convention 6 in docs/migrations-applied.md already says advisor remediations
-- are applied as MIGRATIONS, never from the dashboard. This is its second
-- violation, and the recurrence — plus what to do about it permanently — is
-- written up in docs/ops/note-2026-07-31-view-invoker-recurrence.md.
--
-- ----------------------------------------------------------------------------
-- WHAT DIVERGED, AND WHAT DID NOT
--
-- Only the reloptions moved. Verified against the repo before writing this:
--   · function digest  (name, prosecdef, proconfig, body hash, 57 fns)  IDENTICAL
--   · policy digest    (cmd, roles, qual, with_check, 51 policies)      IDENTICAL
--   · trigger digest   (table, name, function, 25 triggers)             IDENTICAL
--   · gate hash 4a88b18c…9a07                                          UNCHANGED
--   · pf_read still `SELECT | {authenticated} | (id = auth.uid())`      UNCHANGED
--   · anon/PUBLIC on the four views: 0 rows; authenticated: exactly SELECT ×4
--
-- GRANTS SURVIVED, which is diagnostic: this revert was `ALTER VIEW … SET`, not
-- a drop/create. That is why this migration contains NO revoke and no grant —
-- there is nothing to repair. 0028 needed revoke-first because that remediation
-- had reset privileges; this one did not.
--
-- ----------------------------------------------------------------------------
-- WHY OWNER RIGHTS ARE CORRECT HERE
--
--   public_profiles   0023 narrowed `pf_read` to `id = auth.uid()` — owner-only —
--                     precisely BECAUSE this view carries the cross-member read.
--                     The view reads past that policy so ONE view serves every
--                     cross-member lookup, and the per-viewer CASE on auth.uid()
--                     IS the access boundary (neighborhood_id is returned only to
--                     the row's owner or when visibility='members'). Under invoker
--                     rights pf_read applies to the caller and a member sees ONLY
--                     THEMSELVES — which is the live break this fixes, across the
--                     nine call sites that read it for other members' names.
--
--   proposal_results  `votes` has no read policy at all (invariant 4: ballots are
--                     secret), and `vt_select` restricts a member to their own
--                     row. Under invoker rights that predicate applies INSIDE the
--                     aggregate, collapsing the community tally to the caller's
--                     own single ballot. The view emits aggregates only, gated on
--                     `now() > closes_at` and `ballots >= 5`, so reading past
--                     vt_select cannot surface an individual ballot.
--
--   groups_directory  0013 built it owner-rights on purpose and labelled it
--                     "mirrors public_profiles … ALL GROUPS to any verified
--                     member". Under invoker rights `grp_read` applies and a
--                     members_only group the member has not joined vanishes
--                     entirely — which also makes `join_policy = 'request'`
--                     unreachable, because you cannot ask to join a group you
--                     cannot see.
--
--   content_moderation  STAYS security_invoker=on. 0028 pinned it deliberately:
--                     `mod_read` is `using (true)` for authenticated, so invoker
--                     rights change nothing for its audience, and they close the
--                     owner-rights hole that an anon grant would otherwise open
--                     on a transparency log. It is NOT touched here.
--
-- ----------------------------------------------------------------------------
-- ⚠ THE COUPLING — READ BEFORE CHANGING ANY GRANT ON THESE VIEWS
--
-- Owner rights are safe ONLY because anon holds nothing on these views. An
-- owner-rights view reads past base-table RLS by design; what stops that from
-- being an exposure is that the only role which can reach the view is
-- `authenticated`, and what it may see is then decided by the view's own
-- projection. If a future change restores `anon SELECT` on any of these three,
-- THIS POSTURE BECOMES AN EXPOSURE — every member row readable by anyone holding
-- the publishable key.
--
-- So the ordering rule stands even though this migration does not need it:
-- REVOKE BEFORE RESTORING OWNER RIGHTS, ALWAYS. It is unnecessary here only
-- because the grants were never lost. Do not read its absence as permission to
-- reorder a future one.
--
-- ----------------------------------------------------------------------------
-- SCOPE: three ALTER VIEW statements. NO grant changes.
--
-- The grant-surface sweep audited on 2026-07-31 becomes **migration 0031** —
-- narrowing anon and authenticated on the ~17 tables that carry no REVOKE,
-- stripping TRUNCATE/REFERENCES/TRIGGER, and leaving service_role for its own
-- pass. It is deliberately not folded in here: this is a live user-facing break
-- and its fix should be three lines a reviewer can check in a minute.
--
-- And after 0031: **the 38 functions EXECUTE-able by `anon`** (45 by
-- `authenticated`) are a materially larger surface than the table grants —
-- they include decide_verification, set_member_role, resolve_appeal and
-- update_group_settings — and warrant their own migration. A table-level revoke
-- does not touch function EXECUTE, so 0031 alone would leave the more powerful
-- path open.
--
-- ----------------------------------------------------------------------------
-- CANONICAL APPLY-STATUS PROBE for docs/migrations-applied.md. Covers BOTH
-- catalogs — reloptions live in pg_class, privileges in information_schema —
-- because the 2026-07-30 remediation moved both at once and a probe checking
-- only one would have reported APPLIED while the other half was wrong.
--
--   ('0030 view owner rights restored',
--    'three views owner-rights, content_moderation invoker; anon holds nothing on any of the four; authenticated exactly SELECT',
--    -- (i) the three owner-rights views are owner-rights. `security_invoker=off`
--    --     and an ABSENT reloption both mean owner rights, so assert NOT-on
--    --     rather than equality to a literal.
--    not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
--                 where n.nspname = 'public'
--                   and c.relname in ('public_profiles','proposal_results','groups_directory')
--                   and coalesce(array_to_string(c.reloptions, ','), '') ilike '%security_invoker=on%')
--    -- (ii) content_moderation stays invoker-rights, deliberately
--      and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
--                   where n.nspname = 'public' and c.relname = 'content_moderation'
--                     and coalesce(array_to_string(c.reloptions, ','), '') ilike '%security_invoker=on%')
--    -- (iii) no anon or PUBLIC privilege on any of the four — the coupling above
--      and not exists (select 1 from information_schema.role_table_grants
--                       where table_schema = 'public'
--                         and table_name in ('public_profiles','proposal_results',
--                                            'content_moderation','groups_directory')
--                         and grantee in ('anon','PUBLIC'))
--    -- (iv) authenticated holds exactly SELECT, nothing more
--      and not exists (select 1 from information_schema.role_table_grants
--                       where table_schema = 'public'
--                         and table_name in ('public_profiles','proposal_results',
--                                            'content_moderation','groups_directory')
--                         and grantee = 'authenticated' and privilege_type <> 'SELECT')
--      and (select count(*) from information_schema.role_table_grants
--            where table_schema = 'public'
--              and table_name in ('public_profiles','proposal_results',
--                                 'content_moderation','groups_directory')
--              and grantee = 'authenticated' and privilege_type = 'SELECT') = 4)
-- ----------------------------------------------------------------------------
--
-- STUDIO-SAFE: pure SQL, no psql meta-commands. Prove first with
-- seed/matrix-0030.sql (one rolled-back transaction, writes nothing), then apply
-- BY HAND in the Supabase SQL editor as owner at the stop-gate — verify the
-- project-ref first. Record it in docs/migrations-applied.md once applied.
-- Safe to re-run.
-- ============================================================================

-- 1 · RESTORE OWNER RIGHTS ------------------------------------------------
--     Three statements. Explicit `false` rather than dropping the reloption:
--     an absent option means owner rights today, and being explicit survives a
--     future Postgres default change and states the intent at the object.
alter view public.public_profiles  set (security_invoker = false);
alter view public.proposal_results set (security_invoker = false);
alter view public.groups_directory set (security_invoker = false);

-- content_moderation is deliberately NOT altered — see the header. It is
-- correct at security_invoker=on and 0028 pinned it there on purpose.

-- 2 · RESTATE THE INTENT AT THE OBJECT ------------------------------------
--     The comments are re-applied because they are the only part of this
--     decision that a person reading the database (rather than the repo) will
--     ever see — and both reverts were made by someone reading a dashboard.
comment on view public.public_profiles is
  'Cross-member read path. OWNER RIGHTS (security_invoker=false — 0023, restored '
  'by 0028 and again by 0030): reads past the owner-only pf_read so members can '
  'see each other. The per-viewer CASE on auth.uid() is the access boundary. '
  'Safe ONLY while anon holds no privilege on this view. Under invoker rights a '
  'member sees only themselves — do not "harden" this without reading 0030.';

comment on view public.proposal_results is
  'Governance results (invariant 4). OWNER RIGHTS (security_invoker=false, '
  'restored by 0028 and again by 0030): aggregates past vt_select, which is what '
  'makes a community tally possible when individual ballots are secret. Emits '
  'aggregates only, gated on now() > closes_at and ballots >= 5. Under invoker '
  'rights this silently returns each reader a tally of their own single ballot.';

comment on view public.groups_directory is
  'Group directory. OWNER RIGHTS (security_invoker=false — 0013, restored by '
  '0028 and again by 0030): ALL groups are listed to any verified member, with '
  'members_only descriptions and rosters withheld by the per-row CASE (G8). '
  'Under invoker rights an unjoined members_only group disappears entirely, '
  'which also makes join_policy=''request'' unreachable.';
