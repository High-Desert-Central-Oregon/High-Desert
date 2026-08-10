-- ============================================================================
-- seed/matrix-0030.sql — dry-run proof for migration 0030. LOCAL ONLY.
-- ----------------------------------------------------------------------------
-- One transaction, rolled back. Writes nothing that survives.
-- NEVER run against production (CLAUDE.md): it creates auth.users fixtures.
--
-- What this proves:
--   1. reloptions: the three are owner-rights, content_moderation stays invoker.
--   2. grants: anon/PUBLIC hold nothing on any of the four; authenticated holds
--      exactly SELECT. This is the COUPLING that makes owner rights safe, so it
--      is asserted here even though 0030 changes no grant.
--   3. BEHAVIOURAL: a member reads OTHER members, a FULL tally, and ALL groups.
--   4. The same three reads BREAK under security_invoker=on — proven inside the
--      transaction, so case 3 cannot pass vacuously.
--   5. The per-viewer CASE still withholds; pf_read is still owner-only; and
--      moderators are still excluded from the pf_read predicate.
-- ============================================================================
begin;

-- == fixtures ================================================================
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000',
       ('aaaa0030-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
       'authenticated','authenticated','mx0030-'||i||'@example.test','x',now(),
       '{}'::jsonb,'{}'::jsonb,now(),now(),'','','',''
  from generate_series(1,6) i;

update public.profiles set verified = true, tenure_start = '2024-01-01',
       neighborhood_id = (select id from public.neighborhoods order by slug limit 1)
 where id::text like 'aaaa0030-%';
update public.profiles set neighborhood_visibility = 'members'
 where id = 'aaaa0030-0000-4000-8000-000000000001';
update public.profiles set neighborhood_visibility = 'hidden'
 where id = 'aaaa0030-0000-4000-8000-000000000002';
-- one moderator, to prove pf_read does not widen for them
update public.profiles set role = 'moderator'
 where id = 'aaaa0030-0000-4000-8000-000000000003';

insert into public.groups (id, slug, name, description, visibility, join_policy)
values ('aaaa0030-0000-4000-8000-0000000000aa','mx30-public','MX30 Public','pub desc','public','open'),
       ('aaaa0030-0000-4000-8000-0000000000bb','mx30-private','MX30 Private','priv desc','members_only','request'),
       ('aaaa0030-0000-4000-8000-0000000000cc','mx30-joined','MX30 Joined','joined desc','members_only','request');
insert into public.group_members (group_id, user_id, role, status)
values ('aaaa0030-0000-4000-8000-0000000000cc','aaaa0030-0000-4000-8000-000000000001','member','active');

insert into public.proposals (id, title, kind, status, opens_at, closes_at)
values ('aaaa0030-0000-4000-8000-00000000dead','MX30 probe','minor','open',
        now() - interval '10 days', now() + interval '1 day');
do $$
declare r record; i int := 0; ch text[] := array['yes','yes','yes','no','abstain','yes'];
begin
  for r in select id from public.profiles where id::text like 'aaaa0030-%' order by id loop
    i := i + 1;
    perform set_config('request.jwt.claims',
      json_build_object('sub', r.id::text,'role','authenticated')::text, true);
    insert into public.votes (proposal_id, choice)
    values ('aaaa0030-0000-4000-8000-00000000dead', ch[i]::vote_choice);
  end loop;
  perform set_config('request.jwt.claims','', true);
end $$;
alter table public.proposals disable trigger trg_guard_proposal_columns;
update public.proposals set closes_at = now() - interval '1 day', status = 'closed'
 where id = 'aaaa0030-0000-4000-8000-00000000dead';
alter table public.proposals enable trigger trg_guard_proposal_columns;

-- == 1  reloptions ============================================================
do $$ declare v text; begin
  foreach v in array array['public_profiles','proposal_results','groups_directory'] loop
    if (select coalesce(array_to_string(c.reloptions,','),'')
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relname=v) ilike '%security_invoker=on%' then
      raise exception 'MATRIX FAIL 1a: % is invoker-rights — it depends on owner rights and is silently broken in that state', v;
    end if;
  end loop;
  if (select coalesce(array_to_string(c.reloptions,','),'')
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname='content_moderation') not ilike '%security_invoker=on%' then
    raise exception 'MATRIX FAIL 1b: content_moderation is not pinned to security_invoker=on (0028 pinned it deliberately)';
  end if;
end $$;

-- == 2  the coupling: anon holds nothing, authenticated exactly SELECT ========
do $$ declare g text; n int; begin
  select string_agg(distinct grantee||':'||privilege_type, ', ') into g
    from information_schema.role_table_grants
   where table_schema='public'
     and table_name in ('public_profiles','proposal_results','content_moderation','groups_directory')
     and grantee in ('anon','PUBLIC');
  if g is not null then
    raise exception 'MATRIX FAIL 2a: anon/PUBLIC hold privileges on a view (%) — owner rights are safe ONLY while they hold nothing', g;
  end if;
  select string_agg(distinct table_name||':'||privilege_type, ', ') into g
    from information_schema.role_table_grants
   where table_schema='public'
     and table_name in ('public_profiles','proposal_results','content_moderation','groups_directory')
     and grantee='authenticated' and privilege_type <> 'SELECT';
  if g is not null then
    raise exception 'MATRIX FAIL 2b: authenticated holds more than SELECT on a view (%)', g;
  end if;
  select count(*) into n from information_schema.role_table_grants
   where table_schema='public'
     and table_name in ('public_profiles','proposal_results','content_moderation','groups_directory')
     and grantee='authenticated' and privilege_type='SELECT';
  if n <> 4 then
    raise exception 'MATRIX FAIL 2c: authenticated holds SELECT on % of 4 views — members cannot read', n;
  end if;
end $$;

-- == 3  BEHAVIOURAL: cross-member read, full tally, all groups ===============
do $$ declare n int; b int; rev boolean; begin
  perform set_config('request.jwt.claims',
    json_build_object('sub','aaaa0030-0000-4000-8000-000000000001','role','authenticated')::text, true);
  -- `set local role` is REQUIRED: without it this runs as the table owner, RLS
  -- never engages, and every assertion below passes regardless of reloptions.
  set local role authenticated;

  select count(*) into n from public.public_profiles where id::text like 'aaaa0030-%';
  if n <> 6 then
    reset role;
    raise exception 'MATRIX FAIL 3a: a member sees % of 6 members through public_profiles — the cross-member read path is broken', n;
  end if;

  select ballots, revealed into b, rev from public.proposal_results
   where proposal_id = 'aaaa0030-0000-4000-8000-00000000dead';
  if b <> 6 or not rev then
    reset role;
    raise exception 'MATRIX FAIL 3b: tally reads ballots=%, revealed=% (expected 6, true) — vt_select collapsed the aggregate to the caller', b, rev;
  end if;

  select count(*) into n from public.groups_directory where slug like 'mx30-%';
  if n <> 3 then
    reset role;
    raise exception 'MATRIX FAIL 3c: a verified member sees % of 3 groups — an unjoined members_only group vanished and join_policy=request is unreachable', n;
  end if;
  reset role;
end $$;

-- == 4  all three BREAK under invoker rights (case 3 is not vacuous) =========
do $$ declare n int; b int; g int; broke boolean := false; begin
  alter view public.public_profiles  set (security_invoker = on);
  alter view public.proposal_results set (security_invoker = on);
  alter view public.groups_directory set (security_invoker = on);

  perform set_config('request.jwt.claims',
    json_build_object('sub','aaaa0030-0000-4000-8000-000000000001','role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.public_profiles where id::text like 'aaaa0030-%';
  select ballots into b from public.proposal_results
   where proposal_id = 'aaaa0030-0000-4000-8000-00000000dead';
  select count(*) into g from public.groups_directory where slug like 'mx30-%';
  reset role;

  if n = 1 and b = 1 and g = 2 then broke := true; end if;

  alter view public.public_profiles  set (security_invoker = false);
  alter view public.proposal_results set (security_invoker = false);
  alter view public.groups_directory set (security_invoker = false);

  if not broke then
    raise exception 'MATRIX FAIL 4: invoker rights did NOT break the three reads (saw % profiles, % ballots, % groups; expected 1/1/2) — case 3 proves nothing', n, b, g;
  end if;
end $$;

-- == 5  the CASE still withholds; pf_read still owner-only ===================
do $$ declare hidden uuid; shown uuid; d text; begin
  perform set_config('request.jwt.claims',
    json_build_object('sub','aaaa0030-0000-4000-8000-000000000001','role','authenticated')::text, true);
  set local role authenticated;

  select neighborhood_id into hidden from public.public_profiles
   where id = 'aaaa0030-0000-4000-8000-000000000002';
  if hidden is not null then
    reset role;
    raise exception 'MATRIX FAIL 5a: a hidden neighborhood_id leaked — the per-viewer CASE is the access boundary and it is not holding';
  end if;

  select neighborhood_id into shown from public.public_profiles
   where id = 'aaaa0030-0000-4000-8000-000000000001';
  if shown is null then
    reset role;
    raise exception 'MATRIX FAIL 5b: the viewer cannot see their own neighborhood_id — the CASE is over-withholding';
  end if;

  -- members_only descriptions stay gated even though the group is listed (G8)
  select description into d from public.groups_directory where slug = 'mx30-private';
  if d is not null then
    reset role;
    raise exception 'MATRIX FAIL 5c: a members_only description leaked — listing a group is not opening it';
  end if;
  reset role;

  if exists (select 1 from pg_policies
              where schemaname='public' and tablename='profiles' and policyname='pf_read'
                and qual ilike '%is_moderator%') then
    raise exception 'MATRIX FAIL 5d: pf_read mentions is_moderator — 0023 narrowed it to owner-only and moderators must stay excluded from it';
  end if;
end $$;

select 'MATRIX 0030 GREEN — all cases passed' as verdict;

rollback;
