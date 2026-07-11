-- ============================================================================
-- STEPPE — bootstrap a founding ADMIN / MODERATOR  (Gate 1, step 5)
-- ----------------------------------------------------------------------------
-- The chicken-and-egg path for the FIRST trusted members. decide_verification()
-- requires an existing moderator (is_moderator()); the first one can't approve
-- themselves. So the first admin — and any co-admin/moderator you seed before the
-- reviewer queue is staffed — is set here, directly, as the project OWNER.
--
-- WHY THIS IS SAFE (and the only sanctioned direct path):
--   • Run as owner (Supabase SQL editor = `postgres`). With no JWT, auth.uid() is
--     NULL, so the self-edit guard (trg_guard_profile_columns) does NOT freeze
--     verified / role / tenure_start. A normal member UPDATE still cannot touch
--     them — invariant 2 holds for everyone who isn't the owner.
--   • It records the method + date in `verifications` (invariant 1: keep verified,
--     the date, the method — never evidence; evidence_path stays NULL, nothing to
--     purge) and writes an audit row (invariant 6).
--
-- SCOPE — this is NOT the cohort seed.
--   • Use it ONLY to seed trusted staff (admins, moderators) needed to run the
--     reviewer queue and appeals (separation of duties needs ≥2 moderators).
--   • EVERY ordinary founding member goes through the REAL verification flow, not
--     this file. Do not use it to mass-verify the cohort.
--   • This IS meant for prod (unlike seed/dry-run-accounts.sql, which is synthetic
--     and must NEVER touch prod).
--
-- PREREQUISITE — create the auth user FIRST:
--   Supabase → Authentication → Users → "Add user" → "Create new user" → the email
--   below. The on_auth_user_created trigger bootstraps the profiles row (unverified,
--   'member'); this file promotes it. Re-runnable (idempotent) for the same email.
-- ============================================================================

-- Pick a neighborhood slug for the person (run once to see the 35):
--   select slug, name from public.neighborhoods order by name;

do $$
declare
  -- ►►► EDIT THESE FOUR, then run the whole file. ◄◄◄
  v_email        text        := 'greg@steppe.community';   -- must match the auth user
  v_role         member_role := 'admin';                   -- 'admin' or 'moderator'
  v_display_name text        := 'Greg Chism';
  v_slug         text        := 'pine-tree-meadows';       -- a neighborhoods.slug

  v_uid uuid;
  v_nbhd uuid;
begin
  -- Resolve the person (must already exist as an auth user + profile).
  select p.id into v_uid
    from public.profiles p
    join auth.users u on u.id = p.id
   where u.email = v_email;
  if v_uid is null then
    raise exception
      'No profile for %. Create the auth user first (Authentication → Users → Add user); the trigger bootstraps the profile.',
      v_email;
  end if;

  -- Resolve the neighborhood (fail loudly rather than silently nulling it).
  select id into v_nbhd from public.neighborhoods where slug = v_slug;
  if v_nbhd is null then
    raise exception 'No neighborhood with slug %. See: select slug,name from public.neighborhoods.', v_slug;
  end if;

  -- Promote. tenure_start is set ONCE (coalesce keeps a prior founding date on re-run).
  update public.profiles
     set verified        = true,
         role            = v_role,
         tenure_start    = coalesce(tenure_start, current_date),
         display_name    = v_display_name,
         neighborhood_id = v_nbhd
   where id = v_uid;

  -- Record the method + date — but only once (idempotent re-run inserts nothing).
  if not exists (
    select 1 from public.verifications
     where user_id = v_uid and method = 'founder' and status = 'approved'
  ) then
    insert into public.verifications (user_id, method, status, reviewed_by, reviewed_at)
    values (v_uid, 'founder', 'approved', v_uid, now());

    perform public.log_audit('verification.approved', 'profile', v_uid,
      jsonb_build_object('bootstrap', true, 'method', 'founder', 'role', v_role));
  end if;

  raise notice 'Bootstrapped % as % in % (tenure %).',
    v_email, v_role, v_slug, (select tenure_start from public.profiles where id = v_uid);
end $$;

-- Verify:
--   select p.role, p.verified, p.tenure_start, p.display_name, n.name
--     from public.profiles p
--     left join public.neighborhoods n on n.id = p.neighborhood_id
--     join auth.users u on u.id = p.id
--    where u.email = 'greg@steppe.community';
