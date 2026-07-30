-- ============================================================================
-- seed/matrix-0028.sql — dry-run proof for migration 0028. LOCAL ONLY.
-- ----------------------------------------------------------------------------
-- One transaction, rolled back at the end. Writes nothing that survives.
-- NEVER run against production (CLAUDE.md): it creates auth.users fixtures.
--
-- What this proves, in order of how much damage a regression would do:
--   1. `anon` holds NOTHING on any of the four public views, and `authenticated`
--      holds exactly SELECT — asserted in the privilege catalog.
--   2. The two owner-rights views are owner-rights, and content_moderation is
--      deliberately invoker-rights — asserted in pg_class.reloptions.
--   3. BEHAVIOURAL: a member reads OTHER members through public_profiles, and
--      reads a full community tally through proposal_results.
--   4. The same two reads BREAK when security_invoker is flipped on — proven
--      inside this transaction, so case 3 cannot pass vacuously.
--   5. The per-viewer CASE still withholds a hidden neighborhood_id, and
--      pf_read is still owner-only (0023 not undone by 0028).
-- ============================================================================
begin;

-- == fixtures =================================================================
-- Two members in the same neighborhood: one hides their neighborhood, one shows
-- it to members. Plus a closed proposal with six ballots, so the reveal gate
-- (ballots >= 5) opens.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000',
       ('cccccccc-0028-4000-8000-00000000000'||i)::uuid,
       'authenticated','authenticated','mx0028-'||i||'@example.test','x',now(),
       '{}'::jsonb,'{}'::jsonb,now(),now(),'','','',''
  from generate_series(1,6) i;

update public.profiles set verified = true, tenure_start = '2024-01-01'
 where id::text like 'cccccccc-0028-4000-8000-%';
update public.profiles set neighborhood_visibility = 'members'
 where id = 'cccccccc-0028-4000-8000-000000000001';
update public.profiles set neighborhood_visibility = 'hidden'
 where id = 'cccccccc-0028-4000-8000-000000000002';
update public.profiles set neighborhood_id = (select id from public.neighborhoods order by slug limit 1)
 where id::text like 'cccccccc-0028-4000-8000-%';

insert into public.proposals (id, title, kind, status, opens_at, closes_at)
values ('cccccccc-0028-4000-8000-00000000dead','MX0028 probe','minor','open',
        now() - interval '10 days', now() + interval '1 day');

do $$
declare r record; i int := 0; ch text[] := array['yes','yes','yes','no','abstain','yes'];
begin
  for r in select id from public.profiles where id::text like 'cccccccc-0028-4000-8000-%' order by id loop
    i := i + 1;
    perform set_config('request.jwt.claims',
      json_build_object('sub', r.id::text,'role','authenticated')::text, true);
    insert into public.votes (proposal_id, choice)
    values ('cccccccc-0028-4000-8000-00000000dead', ch[i]::vote_choice);
  end loop;
  perform set_config('request.jwt.claims','', true);
end $$;

-- The goalpost guard preserves closes_at on UPDATE (by design). Disabled for the
-- fixture only, and re-enabled immediately; vote immutability is NOT touched.
alter table public.proposals disable trigger trg_guard_proposal_columns;
update public.proposals set closes_at = now() - interval '1 day', status = 'closed'
 where id = 'cccccccc-0028-4000-8000-00000000dead';
alter table public.proposals enable trigger trg_guard_proposal_columns;

-- == 1  anon holds nothing; authenticated holds exactly SELECT ================
do $$ declare g text; begin
  select string_agg(distinct grantee||':'||privilege_type, ', ')
    into g
    from information_schema.role_table_grants
   where table_schema='public'
     and table_name in ('public_profiles','proposal_results','content_moderation','groups_directory')
     and grantee in ('anon','PUBLIC');
  if g is not null then
    raise exception 'MATRIX FAIL 1a: a public/anon privilege survives on a view (%) — the publishable key is not an audience for any of these', g;
  end if;

  select string_agg(distinct table_name||':'||privilege_type, ', ')
    into g
    from information_schema.role_table_grants
   where table_schema='public'
     and table_name in ('public_profiles','proposal_results','content_moderation','groups_directory')
     and grantee='authenticated' and privilege_type <> 'SELECT';
  if g is not null then
    raise exception 'MATRIX FAIL 1b: authenticated holds more than SELECT on a view (%)', g;
  end if;

  if (select count(*) from information_schema.role_table_grants
       where table_schema='public'
         and table_name in ('public_profiles','proposal_results','content_moderation','groups_directory')
         and grantee='authenticated' and privilege_type='SELECT') <> 4 then
    raise exception 'MATRIX FAIL 1c: authenticated lost SELECT on one of the four views — members cannot read';
  end if;
end $$;

-- == 2  reloptions: owner rights restored, content_moderation pinned ==========
do $$ declare v text; begin
  foreach v in array array['public_profiles','proposal_results'] loop
    if (select coalesce(array_to_string(c.reloptions,','),'')
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relname=v) ilike '%security_invoker=on%' then
      raise exception 'MATRIX FAIL 2a: % is invoker-rights — it depends on owner rights and is silently broken in that state', v;
    end if;
  end loop;

  if (select coalesce(array_to_string(c.reloptions,','),'')
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname='content_moderation') not ilike '%security_invoker=on%' then
    raise exception 'MATRIX FAIL 2b: content_moderation is not pinned to security_invoker=on (G-VW-3)';
  end if;
end $$;

-- == 3  BEHAVIOURAL: a member reads other members, and a full tally ===========
do $$ declare n int; b int; rev boolean; begin
  perform set_config('request.jwt.claims',
    json_build_object('sub','cccccccc-0028-4000-8000-000000000001','role','authenticated')::text, true);
  -- `set local role` is REQUIRED, not decoration: without it this block runs as
  -- the table owner, RLS never engages, and the assertions below pass no matter
  -- what security_invoker is set to. Case 4 exists to prove this one can fail.
  set local role authenticated;

  select count(*) into n from public.public_profiles
   where id::text like 'cccccccc-0028-4000-8000-%';
  if n < 6 then
    raise exception 'MATRIX FAIL 3a: a member sees % of 6 fixture members through public_profiles — the cross-member read path is broken', n;
  end if;

  select ballots, revealed into b, rev from public.proposal_results
   where proposal_id = 'cccccccc-0028-4000-8000-00000000dead';
  if b <> 6 or not rev then
    reset role;
    raise exception 'MATRIX FAIL 3b: a member reads ballots=%, revealed=% (expected 6, true) — the tally is counting only the reader''s own ballot', b, rev;
  end if;
  reset role;
end $$;

-- == 4  the same reads BREAK under invoker rights (case 3 is not vacuous) =====
--       Flip, assert the break, flip back — all inside the rolled-back txn.
do $$ declare n int; b int; broke boolean := false; begin
  alter view public.public_profiles  set (security_invoker = on);
  alter view public.proposal_results set (security_invoker = on);

  perform set_config('request.jwt.claims',
    json_build_object('sub','cccccccc-0028-4000-8000-000000000001','role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.public_profiles;
  select ballots into b from public.proposal_results
   where proposal_id = 'cccccccc-0028-4000-8000-00000000dead';
  reset role;

  if n = 1 and b = 1 then broke := true; end if;

  alter view public.public_profiles  set (security_invoker = false);
  alter view public.proposal_results set (security_invoker = false);

  if not broke then
    raise exception 'MATRIX FAIL 4: flipping security_invoker on did NOT break the two reads (saw % profile rows, % ballots) — case 3 proves nothing, so this assertion is not measuring what it claims', n, b;
  end if;
end $$;

-- == 5  0023 still stands: the CASE withholds, pf_read stays owner-only =======
do $$ declare hidden uuid; shown uuid; begin
  perform set_config('request.jwt.claims',
    json_build_object('sub','cccccccc-0028-4000-8000-000000000001','role','authenticated')::text, true);
  set local role authenticated;   -- same reason as case 3

  -- member 2 hides their neighborhood: the viewer must get NULL
  select neighborhood_id into hidden from public.public_profiles
   where id = 'cccccccc-0028-4000-8000-000000000002';
  if hidden is not null then
    raise exception 'MATRIX FAIL 5a: a private neighborhood_id leaked through public_profiles — the per-viewer CASE is the access boundary and it is not holding';
  end if;

  -- member 1 (the viewer, and visibility='members') must get a value
  select neighborhood_id into shown from public.public_profiles
   where id = 'cccccccc-0028-4000-8000-000000000001';
  if shown is null then
    raise exception 'MATRIX FAIL 5b: the viewer cannot see their own neighborhood_id — the CASE is over-withholding';
  end if;

  if exists (select 1 from pg_policies
              where schemaname='public' and tablename='profiles' and policyname='pf_read'
                and qual ilike '%is_moderator%') then
    reset role;
    raise exception 'MATRIX FAIL 5c: pf_read mentions is_moderator — 0023 narrowed it to owner-only and 0028 must not have widened it';
  end if;
  reset role;
end $$;

select 'MATRIX 0028 GREEN — all cases passed' as verdict;

rollback;
