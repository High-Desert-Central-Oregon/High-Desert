-- Migration 0026 dry-run matrix — STUDIO-SAFE: pure SQL, no psql meta-commands;
-- ids/roles ride GUCs + role impersonation; failures raise loudly with case
-- numbers; success = the script reaches 'MATRIX 0026 GREEN'. One transaction,
-- rolled back — writes nothing. Run AFTER applying
-- migrations/0026_neighborhood_pledges.sql.
--
-- Proves the four-lens bar for the neighborhood pledge campaign:
--   L1 read-path attack — `pledges` is unreachable by every client role, by
--      POLICY (RLS on, zero policies) and independently by PRIVILEGE (all
--      revoked from anon, authenticated, AND service_role). Neither a direct
--      select, a join from a readable table, nor a view over it yields a row.
--   L2 promise fidelity — the printed promise holds: a threshold may be lowered
--      and may not be raised once anyone has pledged; a stored address is always
--      canonical, so the unique constraint cannot be defeated by casing.
--   L3 invariant/regression — neighborhoods stays anon-readable (the 35 seeded
--      membership rows are untouched and keep threshold NULL, so they publish no
--      /n/ page); the owner path still works.
--   L4 rigor — table shape, constraints, both triggers, and both indexes wired.
--
-- Personas (seed/dry-run-accounts.sql): ben (b2, verified member). Not required —
-- case 2b falls back to a synthetic sub when the dry-run seed is absent.

begin;

select set_config(
  'mx.ben',
  coalesce(
    (select p.id::text from profiles p join auth.users u on u.id = p.id
      where u.email = 'ben@dryrun.test'),
    '99999999-9999-9999-9999-999999999999'),
  false);

-- == 0  schema shape: columns, constraint, table, triggers, indexes ===========
do $$ declare n int; begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='neighborhoods'
                    and column_name='threshold' and is_nullable='YES') then
    raise exception 'MATRIX FAIL 0a: neighborhoods.threshold missing or NOT NULL (must be nullable — G-PLG-a)'; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='neighborhoods'
                    and column_name='opened_at') then
    raise exception 'MATRIX FAIL 0b: neighborhoods.opened_at missing'; end if;
  if not exists (select 1 from pg_constraint
                  where conname='neighborhoods_threshold_positive') then
    raise exception 'MATRIX FAIL 0c: threshold positivity constraint missing'; end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='pledges') then
    raise exception 'MATRIX FAIL 0d: pledges table missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_normalize_pledge_email') then
    raise exception 'MATRIX FAIL 0e: normalize trigger missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_guard_neighborhood_threshold') then
    raise exception 'MATRIX FAIL 0f: threshold guard trigger missing'; end if;
  select count(*) into n from pg_indexes where schemaname='public' and tablename='pledges'
    and indexname in ('pledges_neighborhood_idx','pledges_removal_token_idx');
  if n <> 2 then raise exception 'MATRIX FAIL 0g: expected both pledges indexes, found %', n; end if;
  -- the removal-token index must be UNIQUE — "one token addresses exactly one row"
  if not exists (select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
                  where c.relname='pledges_removal_token_idx' and i.indisunique) then
    raise exception 'MATRIX FAIL 0h: pledges_removal_token_idx is not UNIQUE'; end if;
end $$;

-- == 1  RLS is on with ZERO policies, and stays that way ======================
do $$ declare n int; begin
  if not (select relrowsecurity from pg_class where relname='pledges') then
    raise exception 'MATRIX FAIL 1a: RLS not enabled on pledges'; end if;
  select count(*) into n from pg_policies where schemaname='public' and tablename='pledges';
  if n <> 0 then
    raise exception 'MATRIX FAIL 1b: pledges must have ZERO policies, found % (G-PLG-b)', n; end if;
end $$;

-- == 2  privilege layer: NO client role holds any grant on pledges ============
--     Independent of RLS. Even if a policy were added by mistake, there is no
--     privilege to exercise it with.
do $$ declare g text; begin
  select string_agg(distinct grantee||':'||privilege_type, ', ')
    into g
    from information_schema.role_table_grants
   where table_schema='public' and table_name='pledges'
     and grantee in ('anon','authenticated','service_role');
  if g is not null then
    raise exception 'MATRIX FAIL 2a: pledges carries client grants (%) — must be none (G-PLG-b)', g; end if;
end $$;

-- fixtures (owner context) for the read-path attacks below
insert into public.neighborhoods (slug, name, threshold)
values ('mx-0026-hood', 'MX 0026 Hood', 20);
insert into public.pledges (neighborhood_id, email_normalized)
select id, 'mx-secret@dryrun.test' from public.neighborhoods where slug='mx-0026-hood';

-- == 3  read-path attack: anon cannot reach a pledge, any shape ===============
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
set local role anon;
do $$ declare n int; leaked boolean; begin
  -- 3a direct select
  begin
    select count(*) into n from public.pledges;
    if n <> 0 then raise exception 'MATRIX FAIL 3a: anon READ % pledge rows', n; end if;
  exception when insufficient_privilege then null;   -- refused outright: also correct
  end;
  -- 3b join from a readable table (neighborhoods IS anon-readable)
  begin
    select count(*) into n
      from public.neighborhoods nb join public.pledges p on p.neighborhood_id = nb.id;
    if n <> 0 then raise exception 'MATRIX FAIL 3b: anon reached pledges through a join (% rows)', n; end if;
  exception when insufficient_privilege then null;
  end;
  -- 3c the SECOND lock, asserted independently of the first. 3a and 3b prove RLS
  --     filters every row; this proves anon cannot even EXECUTE a read against
  --     the table — it must be refused at the privilege layer before RLS is
  --     consulted at all. The distinction is load-bearing: with a mistakenly
  --     granted SELECT, 3a and 3b still pass (RLS with zero policies returns an
  --     empty set), so only this case notices. Verified against a deliberately
  --     granted anon SELECT, where 3a passed and this went red.
  --     The verdict is raised OUTSIDE the catching block: a handler broad enough
  --     to absorb the refusal would otherwise also absorb the MATRIX FAIL and
  --     the case could never go red.
  leaked := false;
  begin
    perform count(*) from public.pledges where email_normalized like '%@%';
    leaked := true;
  exception when others then null;                    -- refused: correct
  end;
  if leaked then raise exception
    'MATRIX FAIL 3c: anon could execute a read against pledges (no rows leaked — RLS held — but the privilege lock is off)'; end if;
  -- 3d write
  leaked := false;
  begin
    insert into public.pledges (neighborhood_id, email_normalized)
    select id, 'anon-forged@dryrun.test' from public.neighborhoods where slug='mx-0026-hood';
    leaked := true;
  exception when others then null;                    -- refused: correct
  end;
  if leaked then raise exception 'MATRIX FAIL 3d: anon INSERTED a pledge directly'; end if;
end $$;
reset role;

-- == 4  read-path attack: an authenticated member fares no better ============
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('mx.ben'), 'role','authenticated')::text, true);
set local role authenticated;
do $$ declare n int; leaked boolean; begin
  begin
    select count(*) into n from public.pledges;
    if n <> 0 then raise exception 'MATRIX FAIL 4a: a member READ % pledge rows', n; end if;
  exception when insufficient_privilege then null;
  end;
  leaked := false;
  begin
    delete from public.pledges;
    leaked := true;
  exception when others then null;                    -- refused: correct
  end;
  if leaked then raise exception 'MATRIX FAIL 4b: a member DELETED pledges'; end if;
end $$;
reset role;

-- == 5  normalization is canonical, and the unique constraint holds ===========
do $$ declare stored text; begin
  insert into public.pledges (neighborhood_id, email_normalized)
  select id, '  MiXeD.Case@DryRun.TEST ' from public.neighborhoods where slug='mx-0026-hood';
  select email_normalized into stored from public.pledges
   where email_normalized = 'mixed.case@dryrun.test';
  if stored is null then
    raise exception 'MATRIX FAIL 5a: email not lowercased/trimmed on write'; end if;
end $$;

savepoint dup_probe;
do $$ begin
  -- the SAME address in different casing must collide, not create a second row
  insert into public.pledges (neighborhood_id, email_normalized)
  select id, 'MIXED.CASE@dryrun.test' from public.neighborhoods where slug='mx-0026-hood';
  raise exception 'MATRIX FAIL 5b: casing defeated the (neighborhood, email) unique constraint';
exception when unique_violation then null;
end $$;
rollback to savepoint dup_probe;

do $$ begin
  insert into public.pledges (neighborhood_id, email_normalized)
  select id, '   ' from public.neighborhoods where slug='mx-0026-hood';
  raise exception 'MATRIX FAIL 5c: a blank email was accepted';
exception when check_violation then null;
end $$;

-- == 6  the printed promise: lower yes, raise no (G-PLG-e) ===================
savepoint threshold_probe;
do $$ begin
  update public.neighborhoods set threshold = 35 where slug='mx-0026-hood';   -- 20 -> 35, pledges exist
  raise exception 'MATRIX FAIL 6a: a threshold was RAISED after neighbors pledged';
exception when check_violation then null;
end $$;
rollback to savepoint threshold_probe;

update public.neighborhoods set threshold = 12 where slug='mx-0026-hood';     -- lowering is expected
do $$ declare t int; begin
  select threshold into t from public.neighborhoods where slug='mx-0026-hood';
  if t <> 12 then raise exception 'MATRIX FAIL 6b: lowering a threshold was refused (got %)', t; end if;
end $$;

-- starting a campaign (NULL -> n) must pass even though it is an "increase"
do $$ declare t int; begin
  update public.neighborhoods set threshold = 20 where slug='wildflower';
  select threshold into t from public.neighborhoods where slug='wildflower';
  if t <> 20 then raise exception 'MATRIX FAIL 6c: starting a campaign (NULL -> n) was refused'; end if;
end $$;

-- raising IS allowed while nobody has pledged (no one relied on the number yet)
do $$ declare t int; begin
  update public.neighborhoods set threshold = 35 where slug='wildflower';
  select threshold into t from public.neighborhoods where slug='wildflower';
  if t <> 35 then raise exception 'MATRIX FAIL 6d: raising was refused with zero pledges'; end if;
end $$;

do $$ begin
  update public.neighborhoods set threshold = 0 where slug='mx-0026-hood';
  raise exception 'MATRIX FAIL 6e: a non-positive threshold was accepted';
exception when check_violation then null;
end $$;

-- == 7  regression: the 35 seeded membership rows publish no campaign ========
do $$ declare n int; begin
  select count(*) into n from public.neighborhoods
   where threshold is not null and slug not in ('mx-0026-hood','wildflower');
  if n <> 0 then
    raise exception 'MATRIX FAIL 7a: % seeded neighborhood(s) carry a threshold — they must default to NULL (G-PLG-a)', n; end if;
  -- and neighborhoods itself stays anon-readable (the /n/ page is read-free)
  if not has_table_privilege('anon','public.neighborhoods','SELECT') then
    raise exception 'MATRIX FAIL 7b: anon lost SELECT on neighborhoods — the public page would break'; end if;
end $$;

-- == 9  neighborhood_status(): the only door, and it opens onto an aggregate ==
do $$ declare r record; n int; v_shape text; begin
  -- 9a shape: exactly the five declared columns, in order. This is the contract
  --    that stops a column added to `pledges` later from widening the return.
  --    RETURNS TABLE lands as OUT params with proargmodes 't' over a `record`
  --    pseudo-type — there is no composite in pg_type to read, so the columns
  --    come from proargnames/proallargtypes.
  select string_agg(a.nm || ':' || format_type(a.tp, null), ',' order by a.ord)
    into v_shape
    from pg_proc p,
         lateral (
           select n.nm, t.tp, n.ord
             from unnest(p.proargnames)    with ordinality as n(nm, ord)
             join unnest(p.proallargtypes) with ordinality as t(tp, ord2) on ord2 = n.ord
             join unnest(p.proargmodes)    with ordinality as m(md, ord3) on ord3 = n.ord
            where m.md = 't'
         ) a
   where p.proname = 'neighborhood_status';
  if v_shape is distinct from
     'slug:text,name:text,threshold:integer,pledge_count:bigint,is_open:boolean' then
    raise exception 'MATRIX FAIL 9a: neighborhood_status return shape drifted → %', coalesce(v_shape,'(null)'); end if;

  -- 9b search_path is pinned AND includes pg_temp (a temp table must not be able
  --    to shadow public.pledges inside the definer body)
  if not exists (select 1 from pg_proc where proname='neighborhood_status'
                   and 'search_path=public, pg_temp' = any(proconfig)) then
    raise exception 'MATRIX FAIL 9b: neighborhood_status does not pin search_path = public, pg_temp'; end if;

  -- 9c it is SECURITY DEFINER (it must read a table no client can reach)
  if not (select prosecdef from pg_proc where proname='neighborhood_status') then
    raise exception 'MATRIX FAIL 9c: neighborhood_status is not SECURITY DEFINER'; end if;

  -- 9d grants: anon + authenticated only; never PUBLIC
  if has_function_privilege('public','public.neighborhood_status(text)','EXECUTE') then
    raise exception 'MATRIX FAIL 9d: EXECUTE still granted to PUBLIC'; end if;
  if not has_function_privilege('anon','public.neighborhood_status(text)','EXECUTE') then
    raise exception 'MATRIX FAIL 9e: anon cannot execute it — the read-free page would break'; end if;
  if not has_function_privilege('authenticated','public.neighborhood_status(text)','EXECUTE') then
    raise exception 'MATRIX FAIL 9f: authenticated cannot execute it'; end if;

  -- 9g correct count, and is_open follows opened_at (NOT the count crossing)
  select count(*) into n from public.neighborhood_status('mx-0026-hood');
  if n <> 1 then raise exception 'MATRIX FAIL 9g: expected 1 row for a live campaign, got %', n; end if;
  select * into r from public.neighborhood_status('mx-0026-hood');
  if r.pledge_count <> 2 then
    raise exception 'MATRIX FAIL 9h: pledge_count wrong (expected 2, got %)', r.pledge_count; end if;
  if r.is_open then
    raise exception 'MATRIX FAIL 9i: is_open true while opened_at is null — arithmetic must not open a neighborhood'; end if;

  -- 9j threshold reached but still not open: the count crossing is NOT the opening
  update public.neighborhoods set threshold = 1 where slug='mx-0026-hood';
  select * into r from public.neighborhood_status('mx-0026-hood');
  if r.is_open then
    raise exception 'MATRIX FAIL 9j: count >= threshold flipped is_open — a human records the opening (invariant 5)'; end if;

  -- 9k a human records it, and only then is it open
  update public.neighborhoods set opened_at = now() where slug='mx-0026-hood';
  select * into r from public.neighborhood_status('mx-0026-hood');
  if not r.is_open then raise exception 'MATRIX FAIL 9k: opened_at set but is_open still false'; end if;
end $$;

-- == 10 unknown / non-campaign slugs return NOTHING, and never raise ==========
do $$ declare n int; begin
  select count(*) into n from public.neighborhood_status('no-such-neighborhood-anywhere');
  if n <> 0 then raise exception 'MATRIX FAIL 10a: unknown slug returned % rows', n; end if;
  -- a seeded MEMBERSHIP neighborhood with no campaign must be indistinguishable
  -- from one that does not exist — no browsable directory (G-PLG-a)
  select count(*) into n from public.neighborhood_status('braydon-park');
  if n <> 0 then raise exception 'MATRIX FAIL 10b: a non-campaign neighborhood published a page'; end if;
  select count(*) into n from public.neighborhood_status(null);
  if n <> 0 then raise exception 'MATRIX FAIL 10c: null slug returned rows'; end if;
  select count(*) into n from public.neighborhood_status('  MX-0026-HOOD  ');
  if n <> 1 then raise exception 'MATRIX FAIL 10d: slug lookup is not trim/case-insensitive'; end if;
end $$;

-- == 11 anon can actually call it, and still sees no more than the aggregate ==
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
set local role anon;
do $$ declare r record; leaked boolean; begin
  select * into r from public.neighborhood_status('mx-0026-hood');
  if r.pledge_count <> 2 then
    raise exception 'MATRIX FAIL 11a: anon got the wrong count (%)', r.pledge_count; end if;
  -- and the definer function is not a back door to the rows themselves
  leaked := false;
  begin
    perform email_normalized from public.pledges limit 1;
    leaked := true;
  exception when others then null;
  end;
  if leaked then raise exception 'MATRIX FAIL 11b: anon reached pledge rows after calling the RPC'; end if;
end $$;
reset role;

-- == 13 grant discipline across every function this migration creates ========
do $$ declare f text; bad text; begin
  foreach f in array array[
    'public.neighborhood_status(text)',
    'public.submit_pledge(text,text)',
    'public.pledge_removal_token(text,text)',
    'public.remove_pledge(uuid)',
    'public.pledge_activity()',
    'public.close_stale_pledge_campaigns(interval)',
    'public.normalize_pledge_email()',
    'public.guard_neighborhood_threshold()'
  ] loop
    -- 13a no function keeps the default EXECUTE-to-PUBLIC
    if has_function_privilege('public', f, 'EXECUTE') then
      raise exception 'MATRIX FAIL 13a: % still grants EXECUTE to PUBLIC', f; end if;
    -- 13b every function pins search_path INCLUDING pg_temp, so a temp table
    --     cannot shadow a real one inside a definer body
    select array_to_string(proconfig, ',') into bad from pg_proc
     where oid = f::regprocedure;
    if bad is distinct from 'search_path=public, pg_temp' then
      raise exception 'MATRIX FAIL 13b: % pins % (want search_path=public, pg_temp)', f, coalesce(bad,'nothing'); end if;
  end loop;

  -- 13c the four service_role-only functions are unreachable by any client role.
  --     This is what keeps the route handler the ONLY submission path, and with
  --     it the per-IP limit and the honeypot.
  foreach f in array array[
    'public.submit_pledge(text,text)',
    'public.pledge_removal_token(text,text)',
    'public.remove_pledge(uuid)',
    'public.close_stale_pledge_campaigns(interval)'
  ] loop
    if has_function_privilege('anon', f, 'EXECUTE') then
      raise exception 'MATRIX FAIL 13c: anon can execute % — the rate limit is bypassable', f; end if;
    if has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'MATRIX FAIL 13d: authenticated can execute %', f; end if;
    if not has_function_privilege('service_role', f, 'EXECUTE') then
      raise exception 'MATRIX FAIL 13e: service_role cannot execute % — the route would break', f; end if;
  end loop;
end $$;

-- == 14 submit_pledge: idempotent, counted, and validating server-side ========
insert into public.neighborhoods (slug, name, threshold) values ('mx-submit', 'MX Submit', 3);
do $$ declare r record; leaked boolean; begin
  select * into r from public.submit_pledge('mx-submit', '  Neighbor@Example.COM ');
  if r.pledge_count <> 1 or r.already_pledged or r.threshold <> 3 or r.is_open then
    raise exception 'MATRIX FAIL 14a: first pledge wrong (count %, already %, threshold %, open %)',
      r.pledge_count, r.already_pledged, r.threshold, r.is_open; end if;

  -- 14b the SAME address in different casing must be idempotent, not a second
  --     layer on the column — this is the count's integrity
  select * into r from public.submit_pledge('mx-submit', 'NEIGHBOR@example.com');
  if r.pledge_count <> 1 or not r.already_pledged then
    raise exception 'MATRIX FAIL 14b: repeat pledge was not idempotent (count %, already %)',
      r.pledge_count, r.already_pledged; end if;

  select * into r from public.submit_pledge('mx-submit', 'second@example.com');
  if r.pledge_count <> 2 or r.already_pledged then
    raise exception 'MATRIX FAIL 14c: distinct address did not increment (count %)', r.pledge_count; end if;

  -- 14d server-side validation does not trust the client
  leaked := false;
  begin perform public.submit_pledge('mx-submit', 'not-an-email'); leaked := true;
  exception when check_violation then null; end;
  if leaked then raise exception 'MATRIX FAIL 14d: a malformed address was accepted'; end if;

  -- 14e an unknown slug and a non-campaign neighborhood are both refused, and
  --     refused the SAME way, so submit is not a campaign-existence oracle
  leaked := false;
  begin perform public.submit_pledge('no-such-hood', 'a@b.com'); leaked := true;
  exception when no_data_found then null; end;
  if leaked then raise exception 'MATRIX FAIL 14e: unknown slug accepted a pledge'; end if;

  leaked := false;
  begin perform public.submit_pledge('braydon-park', 'a@b.com'); leaked := true;
  exception when no_data_found then null; end;
  if leaked then raise exception 'MATRIX FAIL 14f: a non-campaign neighborhood accepted a pledge'; end if;

  -- 14g crossing the threshold still does not open the neighborhood
  perform public.submit_pledge('mx-submit', 'third@example.com');
  select * into r from public.submit_pledge('mx-submit', 'fourth@example.com');
  if r.pledge_count < r.threshold then
    raise exception 'MATRIX FAIL 14g: fixture did not cross the threshold'; end if;
  if r.is_open then
    raise exception 'MATRIX FAIL 14h: passing the threshold opened the neighborhood by itself'; end if;
end $$;

-- == 15 removal: exactly one row, and nothing is retained =====================
do $$ declare tok uuid; before_n int; after_n int; ok boolean; begin
  select count(*) into before_n from public.pledges;
  tok := public.pledge_removal_token('mx-submit', 'neighbor@example.com');
  if tok is null then raise exception 'MATRIX FAIL 15a: no removal token for a live pledge'; end if;

  ok := public.remove_pledge(tok);
  if not ok then raise exception 'MATRIX FAIL 15b: remove_pledge reported nothing removed'; end if;

  select count(*) into after_n from public.pledges;
  if after_n <> before_n - 1 then
    raise exception 'MATRIX FAIL 15c: removal took % rows, expected exactly 1', before_n - after_n; end if;

  -- 15d nothing is retained — no tombstone, no suppression row (G-PLG-c)
  if exists (select 1 from public.pledges where email_normalized = 'neighbor@example.com') then
    raise exception 'MATRIX FAIL 15d: a removed address is still present'; end if;

  -- 15e an unknown token deletes nothing and reports so
  select count(*) into before_n from public.pledges;
  if public.remove_pledge(gen_random_uuid()) then
    raise exception 'MATRIX FAIL 15e: a bogus token reported a removal'; end if;
  if public.remove_pledge(null) then
    raise exception 'MATRIX FAIL 15f: a null token reported a removal'; end if;
  select count(*) into after_n from public.pledges;
  if after_n <> before_n then
    raise exception 'MATRIX FAIL 15g: a bogus token deleted % rows', before_n - after_n; end if;
end $$;

-- == 16 pledge_activity: moderators only, and never an address ===============
do $$ declare v_shape text; leaked boolean; n int; begin
  -- 16a the declared return carries no email column — a moderator reviewing for
  --     abuse still cannot see WHO pledged
  select string_agg(a.nm, ',' order by a.ord) into v_shape
    from pg_proc p,
         lateral (
           select n2.nm, n2.ord from unnest(p.proargnames) with ordinality as n2(nm, ord)
             join unnest(p.proargmodes) with ordinality as m(md, ord3) on ord3 = n2.ord
            where m.md = 't') a
   where p.proname = 'pledge_activity';
  if v_shape is distinct from 'slug,name,threshold,pledge_count,pledged_at' then
    raise exception 'MATRIX FAIL 16a: pledge_activity return shape drifted → %', coalesce(v_shape,'(null)'); end if;
  if v_shape like '%email%' then
    raise exception 'MATRIX FAIL 16b: pledge_activity exposes an address'; end if;

  -- 16c a plain member is refused
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('mx.ben'), 'role','authenticated')::text, true);
  set local role authenticated;
  leaked := false;
  begin perform public.pledge_activity(); leaked := true;
  exception when insufficient_privilege then null; end;
  reset role;
  if leaked then raise exception 'MATRIX FAIL 16c: a non-moderator read pledge activity'; end if;
end $$;

-- 16d a moderator IS allowed (proved with a purpose-built moderator, so the case
--     does not silently pass just because everyone is refused)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000','1a1a1a1a-0026-4000-8000-00000000d06d'::uuid,
  'authenticated','authenticated','mx0026-mod@dryrun.test', crypt('x', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
update public.profiles set role='moderator', verified=true
 where id = '1a1a1a1a-0026-4000-8000-00000000d06d'::uuid;

select set_config('request.jwt.claims',
  json_build_object('sub','1a1a1a1a-0026-4000-8000-00000000d06d','role','authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.pledge_activity();
  if n = 0 then raise exception 'MATRIX FAIL 16d: a moderator saw no pledge activity at all'; end if;
end $$;
reset role;

-- == 17 the retention bound actually bounds (decision record § Data handling) ==
insert into public.neighborhoods (slug, name, threshold) values
  ('mx-stale','MX Stale',20), ('mx-fresh','MX Fresh',20), ('mx-opened','MX Opened',20);
update public.neighborhoods set opened_at = now() where slug='mx-opened';
insert into public.pledges (neighborhood_id, email_normalized, created_at)
select id, 'stale-old@dryrun.test', now() - interval '200 days' from public.neighborhoods where slug='mx-stale';
insert into public.pledges (neighborhood_id, email_normalized, created_at)
select id, 'stale-new@dryrun.test', now() - interval '2 days'   from public.neighborhoods where slug='mx-stale';
insert into public.pledges (neighborhood_id, email_normalized, created_at)
select id, 'fresh@dryrun.test',     now() - interval '10 days'  from public.neighborhoods where slug='mx-fresh';
insert into public.pledges (neighborhood_id, email_normalized, created_at)
select id, 'opened@dryrun.test',    now() - interval '300 days' from public.neighborhoods where slug='mx-opened';

do $$ declare n int; begin
  select count(*) into n from public.close_stale_pledge_campaigns();
  -- BOTH of the stale campaign's pledges go, including the 2-day-old one: the
  -- commitment is "all pledge records for that neighborhood", not "the old ones"
  if n <> 2 then raise exception 'MATRIX FAIL 17a: purge returned % addresses, expected 2', n; end if;
  if exists (select 1 from public.pledges where email_normalized like 'stale-%') then
    raise exception 'MATRIX FAIL 17b: a stale campaign''s pledges survived'; end if;
  -- a campaign inside the window is untouched
  if not exists (select 1 from public.pledges where email_normalized = 'fresh@dryrun.test') then
    raise exception 'MATRIX FAIL 17c: a campaign inside the window was purged'; end if;
  -- an OPENED neighborhood is never purged, however old its first pledge
  if not exists (select 1 from public.pledges where email_normalized = 'opened@dryrun.test') then
    raise exception 'MATRIX FAIL 17d: an opened neighborhood was purged'; end if;
end $$;

-- 17e it is deliberately NOT cron-scheduled: delete-without-notify would be
--     worse than not running it (see the migration note).
do $$ begin
  if exists (select 1 from pg_class where relname='job' and relnamespace='cron'::regnamespace)
     and exists (select 1 from cron.job where command ilike '%close_stale_pledge_campaigns%') then
    raise exception 'MATRIX FAIL 17e: the purge is cron-scheduled, but the notify half does not exist yet';
  end if;
exception when undefined_table or invalid_schema_name then null;   -- pg_cron absent: fine
end $$;

-- == 12 cascade: removing a neighborhood takes its pledges with it ===========
--      Last, because it destroys the fixture every case above depends on.
do $$ declare n int; begin
  delete from public.neighborhoods where slug='mx-0026-hood';
  select count(*) into n from public.pledges where email_normalized='mx-secret@dryrun.test';
  if n <> 0 then raise exception 'MATRIX FAIL 12a: pledges survived their neighborhood (% rows)', n; end if;
end $$;

select 'MATRIX 0026 GREEN — all cases passed' as verdict;

rollback;
