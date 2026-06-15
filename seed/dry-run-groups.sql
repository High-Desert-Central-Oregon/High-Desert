-- ============================================================================
-- STEPPE — dry-run TEST groups  (Spec v2 §1; groups phase 1a)
-- ----------------------------------------------------------------------------
-- ⚠️  STAGING / DEV ONLY.  Synthetic groups for the dry-run runbook's G8–G10/G12
--     matrix. Depends on the six accounts seed.
--
-- PREREQUISITES (fresh DB, in order):
--     supabase db reset
--     psql -f schema.sql                  (the complete current snapshot)
--     psql -f seed/dry-run-accounts.sql   (the six cast members)
--     psql -f seed/dry-run-groups.sql     (this file)
--   Run as the project owner (Supabase SQL editor = postgres, or psql as super).
--   Owner context bypasses RLS, so these rows are seeded directly — the
--   security-definer RPCs are the CLIENT write path and are exercised by the
--   runbook matrix, not here. FRESH-DB-ONLY / additive: re-running errors on the
--   fixed group UUIDs; reset first.
--
-- WHAT THIS CREATES — one group per §1 preset, wired across the six accounts:
--   g1 Public board   public  + open    — maintainer Aida · active member Ben
--   g2 Curated        public  + request — maintainer Carla · active Aida · PENDING Ben
--   g3 Private        members_only + locked — maintainer Esther · active member Frank
--
-- This wiring exercises: G8 (Aida/Ben/Carla can't read g3's roster/description),
-- G10 (open→active, request→pending, locked self-join rejected), G9/G12 (a g1
-- maintainer can't act in g3), and status/role forge attempts (direct writes).
-- ============================================================================

-- Fixed group UUIDs so the runbook can paste them.
insert into groups (id, slug, name, description, category_id, visibility, join_policy, is_system, created_by) values
  ('90000000-0000-0000-0000-000000000001', 'dryrun-public-board', 'Dry-run Public Board',
   'Open community board — anyone verified can join instantly.',
   (select id from categories where slug = 'interests-hobbies'),
   'public', 'open', false, '00000000-0000-0000-0000-0000000000a1'),
  ('90000000-0000-0000-0000-000000000002', 'dryrun-curated', 'Dry-run Curated',
   'Curated group — a maintainer approves each join request.',
   (select id from categories where slug = 'services-skills'),
   'public', 'request', false, '00000000-0000-0000-0000-0000000000c3'),
  ('90000000-0000-0000-0000-000000000003', 'dryrun-private', 'Dry-run Private',
   'Members-only, invite-only — contents hidden, no self-join.',
   (select id from categories where slug = 'help-mutual-aid'),
   'members_only', 'locked', false, '00000000-0000-0000-0000-0000000000e5');

insert into group_members (group_id, user_id, role, status) values
  -- g1 Public board: maintainer Aida, active member Ben
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'maintainer', 'active'),
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'member',     'active'),
  -- g2 Curated: maintainer Carla, active member Aida, PENDING request from Ben
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c3', 'maintainer', 'active'),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'member',     'active'),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2', 'member',     'pending'),
  -- g3 Private: maintainer Esther, active member Frank
  ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000e5', 'maintainer', 'active'),
  ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000f6', 'member',     'active');

-- Roster check — confirm the wiring at a glance (run as owner).
select g.slug, g.visibility, g.join_policy, p.display_name, gm.role, gm.status
from group_members gm
join groups g  on g.id = gm.group_id
join profiles p on p.id = gm.user_id
where g.slug like 'dryrun-%'
order by g.slug, gm.role desc, gm.status, p.display_name;
