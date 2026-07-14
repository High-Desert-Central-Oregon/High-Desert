-- Migration 0023 dry-run matrix — STUDIO-SAFE: pure SQL, no psql meta-commands;
-- ids ride GUCs; failures raise loudly with case numbers; success = the script
-- reaches 'MATRIX 0023 GREEN'. One transaction, rolled back — writes nothing.
-- Run AFTER applying migrations/0023_profile_visibility.sql.
--
-- Proves the four-lens bar for profile visibility (Y1) + the four perf indexes:
--   L1 read-path attack — a hidden neighborhood is NULL at the DB boundary by
--      EVERY path: the view CASE, a base select, for a member AND a MODERATOR
--      (G-Y1a). Owner always sees own; 'members' reveals to members.
--   L2 promise fidelity — default is 'hidden'; the view exposes exactly the five
--      public columns; the check constraint rejects any third state.
--   L3 invariant 1 — the flag is a two-value enum (no PII); asserted via L2.
--   (L4 a11y/ES is UI, proven in the Part 2 build + walkthrough, not here.)
--   Indexes — the four perf indexes exist on the intended tables.
--
-- Personas (seed/dry-run-accounts.sql): aida/ben (verified members),
-- esther (moderator). aida is the subject who hides, then reveals, her area.

begin;

select
  set_config('mx.aida',   (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'aida@dryrun.test'),   false),
  set_config('mx.ben',    (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'ben@dryrun.test'),    false),
  set_config('mx.esther', (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'esther@dryrun.test'), false),
  set_config('mx.nb',     (select id::text from neighborhoods order by name limit 1), false);

-- Setup (as owner): give aida an area, default-hidden. Prove the default is
-- 'hidden' by NOT setting the flag here (rely on the column default from 0023).
update profiles set neighborhood_id = current_setting('mx.nb')::uuid
 where id = current_setting('mx.aida')::uuid;

-- == 0  schema shape: column default hidden, check constraint, view columns ===
do $$ declare v text; nn text; cols text[]; begin
  select column_default, is_nullable into v, nn
    from information_schema.columns
   where table_schema='public' and table_name='profiles' and column_name='neighborhood_visibility';
  if v is null or v not like '''hidden''%' then
    raise exception 'MATRIX FAIL 0a: neighborhood_visibility default is % (want hidden)', v; end if;
  if nn <> 'NO' then raise exception 'MATRIX FAIL 0a2: neighborhood_visibility is nullable'; end if;
  -- the fresh column defaulted aida to hidden (never set above)
  select neighborhood_visibility into v from profiles where id = current_setting('mx.aida')::uuid;
  if v <> 'hidden' then raise exception 'MATRIX FAIL 0b: default value is % (want hidden)', v; end if;
  -- the view exposes EXACTLY the five public columns (no tenure_start, etc.)
  select array_agg(column_name order by ordinal_position) into cols
    from information_schema.columns
   where table_schema='public' and table_name='public_profiles';
  if cols <> array['id','display_name','neighborhood_id','verified','role'] then
    raise exception 'MATRIX FAIL 0c: public_profiles columns = % (want the 5)', cols; end if;
end $$;

-- == 1  owner sees OWN area through the view even while hidden =================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare v uuid; begin
  select neighborhood_id into v from public_profiles where id = current_setting('mx.aida')::uuid;
  if v is null then raise exception 'MATRIX FAIL 1: owner cannot see own hidden area via the view'; end if;
end $$;
reset role;

-- == 2  another MEMBER: hidden area is NULL in the view, unreadable at base ====
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare v uuid; n int; begin
  -- the view returns aida's row but withholds the value
  select neighborhood_id into v from public_profiles where id = current_setting('mx.aida')::uuid;
  if v is not null then raise exception 'MATRIX FAIL 2a: member read another''s HIDDEN area via the view'; end if;
  -- the base table hands back nothing at all (pf_read is owner-only)
  select count(*) into n from profiles where id = current_setting('mx.aida')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 2b: member read another''s base profiles row (% rows)', n; end if;
end $$;
reset role;

-- == 3  MODERATOR: hidden means hidden to moderators too (G-Y1a) ==============
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.esther'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare v uuid; n int; begin
  if not public.is_moderator() then raise exception 'MATRIX FAIL 3z: esther is not a moderator (seed drift)'; end if;
  -- via the view: the CASE binds the moderator — NULL
  select neighborhood_id into v from public_profiles where id = current_setting('mx.aida')::uuid;
  if v is not null then raise exception 'MATRIX FAIL 3a: MODERATOR read a HIDDEN area via the view'; end if;
  -- via the base table: pf_read no longer grants moderators other rows — 0 rows
  select count(*) into n from profiles where id = current_setting('mx.aida')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 3b: MODERATOR read another''s base profiles row (% rows)', n; end if;
  -- the moderator DOES still get the carve-out attributes through the view
  select count(*) into n from public_profiles
   where id = current_setting('mx.aida')::uuid and verified is not null and role is not null;
  if n <> 1 then raise exception 'MATRIX FAIL 3c: moderator lost verified/role carve-out via the view'; end if;
end $$;
reset role;

-- == 4  owner reveals to 'members' (own-row write); members then see it =======
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
update profiles set neighborhood_visibility = 'members'
 where id = current_setting('mx.aida')::uuid;                       -- pf_update own row; not frozen
-- invalid third state is refused by the check constraint
do $$ begin
  update profiles set neighborhood_visibility = 'public'
   where id = current_setting('mx.aida')::uuid;
  raise exception 'MATRIX FAIL 4a: a third visibility state was accepted';
exception when check_violation then null; end $$;
-- a member cannot flip ANOTHER member's visibility (pf_update own-row only)
do $$ declare n int; begin
  update profiles set neighborhood_visibility = 'members'
   where id = current_setting('mx.ben')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'MATRIX FAIL 4b: member wrote another''s visibility (% rows)', n; end if;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare v uuid; begin
  select neighborhood_id into v from public_profiles where id = current_setting('mx.aida')::uuid;
  if v is null then raise exception 'MATRIX FAIL 4c: member cannot see an area revealed to members'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- == 5  the four perf indexes exist on the intended tables ====================
do $$ declare n int; begin
  select count(*) into n from pg_indexes
   where schemaname='public' and indexname in (
     'events_group_created_idx','events_status_starts_idx',
     'moderation_actions_target_idx','thread_state_member_idx');
  if n <> 4 then raise exception 'MATRIX FAIL 5: % of 4 perf indexes present', n; end if;
end $$;

select 'MATRIX 0023 GREEN — all cases passed' as verdict;

rollback;
