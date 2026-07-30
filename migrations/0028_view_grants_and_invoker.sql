-- ============================================================================
-- Migration 0028 — view grants + restore owner rights on three views — MANUAL APPLY
-- ----------------------------------------------------------------------------
-- WHAT HAPPENED. A Supabase advisor remediation was applied from the DASHBOARD,
-- outside the migration record. It set `security_invoker = on` on all four
-- public views and — because a view drop/create re-applies the project's default
-- privileges — handed `anon` ALL SEVEN privileges on each of them. Nothing in
-- the repository noticed: the migration ledger reported every row APPLIED, the
-- local matrices passed, and the drift was found by accident while auditing an
-- unrelated grant.
--
-- THREE of those four views are DESIGNED to run with owner rights. Flipping them
-- to invoker rights did not harden them; it broke them, silently, in production:
--
--   public_profiles   — the single cross-member read path (0023). Under invoker
--                       rights the caller's own `pf_read` (id = auth.uid())
--                       applies, so a member sees ONLY THEMSELVES. Measured in
--                       prod: 1 row visible of 3 members. Nine call sites read
--                       this view for other members' names (Exchange, messages,
--                       groups, the maintainer console).
--
--   proposal_results  — the ONLY sanctioned read path for governance results
--                       (CLAUDE.md invariant 4: `votes` has no read policy;
--                       results are read from this view). Under invoker rights
--                       the caller's `vt_select` (user_id = auth.uid()) applies
--                       INSIDE the aggregate, so the tally counts only the
--                       reader's own ballot. Measured on a local prod-shaped DB
--                       with six ballots on a closed proposal:
--                         owner rights (repo)  → ballots 6, revealed t, 7.5/1.0/3.0
--                         invoker rights (prod)→ ballots 1, revealed f, all NULL
--                       A member reading results today sees a tally of one.
--
--   groups_directory  — the group directory (0013, built owner-rights on purpose
--                       and labelled so: "mirrors public_profiles ... ALL GROUPS
--                       to any verified member"). Under invoker rights `grp_read`
--                       applies, so a members_only group the member has not joined
--                       disappears from the directory entirely — which also makes
--                       `join_policy = 'request'` unreachable, because you cannot
--                       ask to join a group you cannot see. Measured locally:
--                         owner rights (repo)  → 3 of 3 groups, descriptions gated
--                         invoker rights (prod)→ 2 of 3, the unjoined one gone
--
-- THE COUPLING THAT MAKES OWNER RIGHTS SAFE. An owner-rights view reads past
-- base-table RLS by design. That is only acceptable because the view's own
-- projection is the access boundary — public_profiles' per-viewer CASE, and
-- proposal_results' `ballots >= 5` reveal gate and `now() > closes_at` temporal
-- gate — AND because no untrusted role can reach the view at all. So the REVOKE
-- comes FIRST in this file and would come first even if these were ever split
-- across two migrations: restoring owner rights while `anon` still held SELECT
-- would turn a latent grant into a live read of every member's row.
--
-- EXPLICITLY OUT OF SCOPE — these stay latent and belong to the sweep, with
-- before/after grant tables, NOT to this migration:
--   · invite_tokens / invite_redemptions / invited_emails — `authenticated` and
--     `service_role` hold all 7 privileges including TRUNCATE (0024/0027 revoked
--     from `anon` only).
--   · qr_counts, interest_signups — RLS on with ZERO policies, and `anon` holds
--     all 7 including TRUNCATE.
--   · every table from 0001/0013/0014/0015/schema.sql that carries no REVOKE.
--   · service_role's blanket table privileges everywhere.
-- Those are bounded by RLS and by PostgREST exposing no TRUNCATE verb. This
-- migration touches VIEWS ONLY, because three of them are actively broken.
--
-- G-flags:
--   G-VW-1  REVOKE precedes every GRANT, and the grant that remains is named per
--           view with the reason it is needed. Restrictive-first, matching 0026.
--   G-VW-2  `service_role` is deliberately NOT revoked here. It is the secret
--           key, it already bypasses RLS, and narrowing it is a sweep-wide
--           decision that must not be smuggled into a four-view fix.
--   G-VW-3  content_moderation is pinned EXPLICITLY to security_invoker = on.
--           The dashboard set it; this migration makes that deliberate rather
--           than accidental. It is safe: `mod_read` is `using (true)` for
--           authenticated, so invoker rights change nothing for the intended
--           audience, and they close the owner-rights hole that the anon grant
--           would otherwise have opened on a transparency log.
--   G-VW-4  groups_directory IS restored to owner rights — resolved by test, not
--           by assumption. An earlier revision of this file left it alone as an
--           open question. Seeding a public group the member had not joined, a
--           members_only group they had not joined, and a members_only group they
--           had, and reading the view as that member:
--             owner rights (repo) → 3 rows; members_only descriptions NULL
--             invoker rights (prod)→ 2 rows; the unjoined members_only group is GONE
--           That is a break, and 0013 says so in the migration that created the
--           view: "Directory view (OWNER-RIGHTS; mirrors public_profiles) —
--           limited, directory-safe columns for ALL GROUPS to any verified
--           member ... description ONLY for public groups; members_only
--           descriptions/rosters stay gated (G8)." The app repeats it: the browse
--           page comment reads "every group by name + category, members_only ones
--           with their description gated to null."
--           The consequence is concrete: `join_policy = 'request'` exists so a
--           member can ASK to join a members_only group. Under invoker rights that
--           group is invisible, so the request path is unreachable — the policy
--           value becomes undiscoverable rather than merely restricted.
--
-- STUDIO-SAFE: pure SQL, no psql meta-commands. Prove first with
-- seed/matrix-0028.sql (one rolled-back transaction, writes nothing), then apply
-- BY HAND in the Supabase SQL editor as owner at the stop-gate — verify the
-- project-ref first. Record it in docs/migrations-applied.md once applied.
-- Safe to re-run.
--
-- ----------------------------------------------------------------------------
-- CANONICAL APPLY-STATUS PROBE for docs/migrations-applied.md.
--
-- Covers BOTH catalogs, per the 0027 lesson: privileges live in
-- information_schema.role_table_grants, and reloptions live in pg_class. A probe
-- that checked only one of them could report APPLIED while the other half was
-- wrong — which is precisely how this drift survived.
--
--   ('0028 view grants + owner rights',
--    'anon holds nothing on the four views; the three owner-rights views restored; content_moderation pinned invoker',
--    -- (i) no anon privilege of any kind on any of the four views
--    not exists (select 1 from information_schema.role_table_grants
--                 where table_schema='public'
--                   and table_name in ('public_profiles','proposal_results',
--                                      'content_moderation','groups_directory')
--                   and grantee in ('anon','PUBLIC'))
--    -- (ii) authenticated kept exactly SELECT, nothing more
--      and not exists (select 1 from information_schema.role_table_grants
--                       where table_schema='public'
--                         and table_name in ('public_profiles','proposal_results',
--                                            'content_moderation','groups_directory')
--                         and grantee='authenticated'
--                         and privilege_type <> 'SELECT')
--    -- (iii) the three owner-rights views are owner-rights again. `security_invoker=off`
--    --       and an ABSENT reloption are both owner rights; assert NOT-on rather
--    --       than equality, or a future Postgres default flips this silently.
--      and not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
--                       where n.nspname='public'
--                         and c.relname in ('public_profiles','proposal_results','groups_directory')
--                         and coalesce(array_to_string(c.reloptions,','),'') ilike '%security_invoker=on%')
--    -- (iv) content_moderation stays invoker-rights, deliberately (G-VW-3)
--      and exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
--                   where n.nspname='public' and c.relname='content_moderation'
--                     and coalesce(array_to_string(c.reloptions,','),'') ilike '%security_invoker=on%'))
-- ----------------------------------------------------------------------------
-- ============================================================================

-- 1 · REVOKE FIRST -----------------------------------------------------------
--     Every one of these four views currently grants `anon` all seven
--     privileges, inherited from the project's default ACL when the dashboard
--     remediation recreated them. `anon` is the publishable key: anyone who
--     views source on the marketing site holds it. None of these four surfaces
--     is public.
--
--     `authenticated` is revoked too and then granted back exactly SELECT below,
--     rather than trusting whatever the default ACL happened to leave. That is
--     the 0026 posture: state the privilege you intend instead of subtracting
--     from a default you did not choose.
revoke all on public.public_profiles    from public, anon, authenticated;
revoke all on public.proposal_results   from public, anon, authenticated;
revoke all on public.content_moderation from public, anon, authenticated;
revoke all on public.groups_directory   from public, anon, authenticated;

-- 2 · GRANT BACK, ONE LINE PER SURFACE, WITH THE REASON -----------------------

-- The single cross-member read path (0023). Members need other members' display
-- names to read the Exchange, a message thread, or a group roster; nine call
-- sites depend on it. SELECT only — nothing writes through a view here.
grant select on public.public_profiles to authenticated;

-- Governance results (invariant 4). Members must be able to read the outcome of
-- a closed proposal; the view is the only path that exists, because `votes` has
-- no read policy and individual ballots are secret.
grant select on public.proposal_results to authenticated;

-- The moderation transparency log. Members can see what was removed or restored
-- and why — that is the point of a transparency view. `mod_read` already allows
-- authenticated to read the underlying rows, so this grant exposes nothing new.
grant select on public.content_moderation to authenticated;

-- The group directory. Verified members browse groups here; the view's own
-- `WHERE is_verified()` and its description CASE decide what each row shows.
grant select on public.groups_directory to authenticated;

-- 3 · RESTORE OWNER RIGHTS ON THE THREE VIEWS THAT DEPEND ON THEM -------------
--     ONLY safe because section 1 ran first. An owner-rights view reads past
--     base-table RLS; the access boundary moves into the view's own projection.
--     With `anon` revoked, the only reader is an authenticated member, and what
--     they may see is decided by the view body:
--
--       public_profiles  — the per-viewer CASE (neighborhood_id is returned only
--                          to the owner of the row or when visibility='members').
--                          Base-table `pf_read` is NOT the boundary here and was
--                          never meant to be; 0023 narrowed pf_read to
--                          owner-only precisely because this view carries the
--                          cross-member read.
--       proposal_results — the `now() > closes_at` temporal gate and the
--                          `ballots >= 5` reveal gate. Individual ballots are
--                          never projected: the view emits aggregates only, so
--                          reading past `vt_select` cannot surface a ballot.
--
--     Restoring 0023's explicit setting rather than dropping the reloption: an
--     absent option means owner rights TODAY, and being explicit survives a
--     future default change and documents the intent at the object.
--       groups_directory — its `WHERE is_verified()` gate plus the per-row
--                          description CASE (G8): every group is LISTED to a
--                          verified member, and only members_only descriptions
--                          and rosters are withheld. Base-table `grp_read` is not
--                          the boundary here either; if it were, a members_only
--                          group would vanish from the directory and its
--                          `join_policy = 'request'` could never be exercised.
alter view public.public_profiles  set (security_invoker = false);
alter view public.proposal_results set (security_invoker = false);
alter view public.groups_directory set (security_invoker = false);

-- 4 · PIN THE ONE THAT SHOULD STAY AS THE ADVISOR LEFT IT (G-VW-3) ------------
--     Not a change — content_moderation is already invoker-rights in production.
--     Setting it explicitly converts an accident into a decision, so the next
--     audit sees intent rather than drift. Safe because `mod_read` is
--     `using (true)` for authenticated: invoker rights alter nothing for the
--     audience this view has, while ensuring that if the anon grant ever returns
--     it yields zero rows rather than the whole log.
alter view public.content_moderation set (security_invoker = on);

comment on view public.public_profiles is
  'Cross-member read path. OWNER RIGHTS (security_invoker=false, 0023, restored '
  'by 0028): reads past the owner-only pf_read so members can see each other. '
  'The per-viewer CASE is the access boundary. Safe ONLY while anon holds no '
  'privilege on this view — revoke before ever changing the invoker setting.';

comment on view public.groups_directory is
  'Group directory. OWNER RIGHTS (security_invoker=false, restored by 0028): '
  '0013 built it owner-rights deliberately so ALL groups are listed to any '
  'verified member, with members_only descriptions and rosters withheld by the '
  'per-row CASE (G8). Under invoker rights an unjoined members_only group '
  'disappears entirely, which also makes join_policy=''request'' unreachable.';

comment on view public.proposal_results is
  'Governance results (invariant 4). OWNER RIGHTS (security_invoker=false, '
  'restored by 0028): aggregates past vt_select, which is what makes a community '
  'tally possible when individual ballots are secret. Emits aggregates only, '
  'gated on now() > closes_at and ballots >= 5. Under invoker rights this view '
  'silently returns each reader a tally of their own single ballot.';
