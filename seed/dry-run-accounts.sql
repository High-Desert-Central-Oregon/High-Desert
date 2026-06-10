-- ============================================================================
-- HIGH DESERT — dry-run TEST accounts  (Step 10, closed-beta hardening)
-- ----------------------------------------------------------------------------
-- ⚠️  STAGING / DEV ONLY.  These are SYNTHETIC test accounts for the dry-run
--     runbook (docs/dry-run-runbook.md). They are NOT the ~50-person founding
--     cohort. The real cohort seed deliberately waits on three things still in
--     flight: (1) Terms & Privacy Oregon legal review, (2) Resend transactional
--     email, (3) the Eagle Crest in/out decision. Do not run this against prod.
--
-- PREREQUISITES
--   • schema.sql has been applied (tables, triggers, RLS, the 35 neighborhood
--     seeds) plus migrations 0001–0007. pgcrypto is enabled by schema.sql.
--   • Run as the project owner (Supabase SQL editor = `postgres`, or psql as a
--     superuser). The owner bypasses RLS, and — because auth.uid() is NULL with
--     no JWT — the profile trust-field guard (trg_guard_profile_columns) does
--     NOT freeze verified/role/tenure_start. That is the sanctioned admin path
--     for setting trust state; a normal member UPDATE still can't touch it.
--
-- WHAT THIS CREATES
--   6 accounts across 3 neighborhoods, spanning every vote-weight tier:
--     a1 Aida Ramirez   member     verified  Braydon Park     1.5×  (Year 3+)
--     b2 Ben Okafor     member     verified  Braydon Park     1.2×  (Year 2)
--     c3 Carla Nguyen   member     verified  Canyon Crossing  1.0×  (Year 1, es)
--     d4 Diego Flores   member     UNVERIFIED Canyon Crossing  —    (verifies in the runbook)
--     e5 Esther Cohen   moderator  verified  Deer Crossing    1.5×  (reviewer / actor)
--     f6 Frank Mbeki    moderator  verified  Deer Crossing    1.5×  (resolves appeals — separation of duties)
--
-- Two moderators exist on purpose: the appeal flow requires a DIFFERENT
-- moderator than the one who acted (resolve_appeal enforces it).
--
-- IDEMPOTENT: re-running first clears all prior test data (Section 0), in FK
-- dependency order, so a fresh dry-run always starts clean — including any
-- events/proposals/votes/appeals/audit rows a previous runbook pass created.
--
-- TEARDOWN: Section 0 IS the teardown. To wipe the test accounts without
-- re-seeding, run Section 0 on its own.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0 · RESET (idempotent teardown). Deletes only the six fixed test UUIDs and
--     everything they authored/acted-on. Owner context = RLS bypassed.
--     Order matters: rows with ON DELETE NO ACTION back-references to profiles
--     (moderation_actions.actor_id, audit_log.actor_id, verifications.reviewed_by,
--     neighborhood_requests.resolved_by) must go before auth.users cascades.
-- ----------------------------------------------------------------------------
do $$
declare
  test_ids uuid[] := array[
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000b2',
    '00000000-0000-0000-0000-0000000000c3',
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-0000000000e5',
    '00000000-0000-0000-0000-0000000000f6'
  ]::uuid[];
begin
  delete from audit_log          where actor_id   = any(test_ids);
  delete from appeals            where user_id    = any(test_ids);
  delete from moderation_actions where actor_id   = any(test_ids);
  delete from votes              where user_id    = any(test_ids);
  delete from proposals          where author_id  = any(test_ids);
  delete from events             where creator_id = any(test_ids);
  delete from verifications      where user_id    = any(test_ids) or reviewed_by = any(test_ids);
  delete from neighborhood_requests where user_id = any(test_ids) or resolved_by = any(test_ids);
  delete from consents           where user_id    = any(test_ids);
  delete from event_rsvps        where user_id    = any(test_ids);
  -- Cascades the profiles rows (and any remaining children) via the FK on
  -- profiles.id -> auth.users(id) ON DELETE CASCADE.
  delete from auth.users         where id         = any(test_ids);
end $$;

-- ----------------------------------------------------------------------------
-- 1 · Helper: create one auth user. The on_auth_user_created trigger then
--     inserts the matching profiles row (display_name/locale come from metadata).
--     Plain (not SECURITY DEFINER) — it runs with the owner's rights because the
--     seed is run as the owner — and it is DROPPED at the end so nothing
--     privileged lingers.
-- ----------------------------------------------------------------------------
create or replace function public.seed_test_user(
  p_id           uuid,
  p_email        text,
  p_password     text,
  p_display_name text,
  p_locale       text default 'en'
) returns void
language plpgsql
set search_path = auth, public, extensions
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_display_name, 'locale', p_locale),
    now(), now(),
    '', '', '', ''
  );

  -- An identities row lets email+password sign-in work through the app. The
  -- runbook does NOT need it (it drives RLS via role impersonation), and the
  -- auth.identities shape varies across GoTrue versions, so any failure here is
  -- swallowed rather than aborting the seed.
  begin
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      p_id::text, p_id,
      jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  exception when others then
    raise notice 'identities insert skipped for % (% — %)', p_email, sqlstate, sqlerrm;
  end;
end $$;

-- ----------------------------------------------------------------------------
-- 2 · Create the six auth users. Shared dev password (see runbook). The profile
--     rows are created by the signup trigger; trust fields are set in Section 3.
-- ----------------------------------------------------------------------------
select public.seed_test_user('00000000-0000-0000-0000-0000000000a1', 'aida@dryrun.test',   'dryrun-password', 'Aida Ramirez', 'en');
select public.seed_test_user('00000000-0000-0000-0000-0000000000b2', 'ben@dryrun.test',    'dryrun-password', 'Ben Okafor',   'en');
select public.seed_test_user('00000000-0000-0000-0000-0000000000c3', 'carla@dryrun.test',  'dryrun-password', 'Carla Nguyen', 'es');
select public.seed_test_user('00000000-0000-0000-0000-0000000000d4', 'diego@dryrun.test',  'dryrun-password', 'Diego Flores', 'en');
select public.seed_test_user('00000000-0000-0000-0000-0000000000e5', 'esther@dryrun.test', 'dryrun-password', 'Esther Cohen', 'en');
select public.seed_test_user('00000000-0000-0000-0000-0000000000f6', 'frank@dryrun.test',  'dryrun-password', 'Frank Mbeki',  'en');

-- ----------------------------------------------------------------------------
-- 3 · Set trust state via the admin path (owner context; the guard does not
--     freeze because auth.uid() is NULL). One statement sets all six.
--
--     Tenure dates are chosen relative to 2026-06-09 to land in each tier:
--       vote_weight_for():  > today-1y → 1.0  ·  > today-2y → 1.2  ·  else → 1.5
--       2022-06-01 → 1.5   2024-11-01 → 1.2   2026-02-01 → 1.0
--     Diego stays UNVERIFIED with no tenure — he verifies live in Walkthrough A,
--     which sets tenure_start = current_date (→ 1.0×).
-- ----------------------------------------------------------------------------
update profiles p set
  verified        = v.verified,
  role            = v.role::member_role,
  tenure_start    = v.tenure_start::date,
  neighborhood_id = n.id,
  locale          = v.locale
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, true,  'member',    '2022-06-01', 'braydon-park',    'en'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, true,  'member',    '2024-11-01', 'braydon-park',    'en'),
  ('00000000-0000-0000-0000-0000000000c3'::uuid, true,  'member',    '2026-02-01', 'canyon-crossing', 'es'),
  ('00000000-0000-0000-0000-0000000000d4'::uuid, false, 'member',    null,         'canyon-crossing', 'en'),
  ('00000000-0000-0000-0000-0000000000e5'::uuid, true,  'moderator', '2021-09-01', 'deer-crossing',   'en'),
  ('00000000-0000-0000-0000-0000000000f6'::uuid, true,  'moderator', '2023-01-01', 'deer-crossing',   'en')
) as v(id, verified, role, tenure_start, slug, locale)
left join neighborhoods n on n.slug = v.slug
where p.id = v.id;

-- ----------------------------------------------------------------------------
-- 4 · Drop the helper so nothing privileged lingers on staging.
-- ----------------------------------------------------------------------------
drop function public.seed_test_user(uuid, text, text, text, text);

-- ----------------------------------------------------------------------------
-- 5 · Roster check — confirm the tiers at a glance. (Run as owner; the
--     authenticated role can't call vote_weight_for, by design — see G2.)
-- ----------------------------------------------------------------------------
select
  p.display_name,
  p.role,
  p.verified,
  p.tenure_start,
  public.vote_weight_for(p.id) as vote_weight,
  n.name as neighborhood
from profiles p
left join neighborhoods n on n.id = p.neighborhood_id
where p.id in (
  '00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000d4',
  '00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f6'
)
order by p.role desc, vote_weight desc, p.display_name;
-- Expected:
--   Frank Mbeki   moderator true  2023-01-01 1.5  Deer Crossing
--   Esther Cohen  moderator true  2021-09-01 1.5  Deer Crossing
--   Aida Ramirez  member    true  2022-06-01 1.5  Braydon Park
--   Ben Okafor    member    true  2024-11-01 1.2  Braydon Park
--   Carla Nguyen  member    true  2026-02-01 1.0  Canyon Crossing
--   Diego Flores  member    false (null)     1.0  Canyon Crossing   ← 1.0 default; verifies in the runbook
