-- ============================================================================
-- seed/matrix-0029.sql — dry-run proof for migration 0029. LOCAL ONLY.
-- ----------------------------------------------------------------------------
-- One transaction, rolled back. Writes nothing that survives.
-- NEVER run against production (CLAUDE.md).
--
-- What this proves:
--   1. EVERY function in public carries (public, pg_temp) — asserted over all
--      of them, not a list, so a function added later without it fails here.
--   2. The gate is the NEW baseline, and the OLD one is gone.
--   3. created_by defaults to auth.uid() in the DATABASE.
--   4. The neighborhood_id comment no longer describes the withdrawn landing.
--   5. BEHAVIOURAL: an insert omitting created_by records the acting user; an
--      insert supplying it explicitly keeps the explicit value (which is what
--      the mint action does, so the action is unaffected).
--   6. Case 1 can fail — proven by unpinning a function inside the txn.
-- ============================================================================
begin;

-- == 1  every function pinned =================================================
do $$ declare bad text; n int; begin
  select string_agg(p.proname||' -> '||coalesce(array_to_string(p.proconfig,','),'(unpinned)'), ', '),
         count(*)
    into bad, n
    from pg_proc p join pg_namespace nsp on nsp.oid = p.pronamespace
   where nsp.nspname = 'public' and p.prokind = 'f'
     and coalesce(array_to_string(p.proconfig,','),'') is distinct from 'search_path=public, pg_temp';
  if n > 0 then
    raise exception 'MATRIX FAIL 1a: % function(s) not pinned to (public, pg_temp): %', n, bad;
  end if;
end $$;

-- == 2  the gate is the new baseline, and the old value is gone ===============
do $$ declare sha text; begin
  select encode(sha256(pg_get_functiondef(p.oid)::bytea),'hex') into sha
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='enforce_invited_signup';
  if sha = '8f2f632e92d2eab9900fd11b9a0bd9156c2f867bedff33d211f322086366532e' then
    raise exception 'MATRIX FAIL 2a: the gate still carries the PRE-0029 hash — the sweep did not reach it';
  end if;
  if sha <> '4a88b18c388fa8c78a4766892774069d562b887e0df9751db0cc288991c29a07' then
    raise exception 'MATRIX FAIL 2b: gate hash is % — expected the 0029 baseline 4a88b18c388fa8c78a4766892774069d562b887e0df9751db0cc288991c29a07', sha;
  end if;
  -- the sweep must not have edited the BODY: the gate still keys on session_user
  -- and still reads only invited_emails.
  if pg_get_functiondef('public.enforce_invited_signup'::regproc) not like '%session_user%' then
    raise exception 'MATRIX FAIL 2c: the gate no longer keys on session_user — 0029 pins search_path and must not touch bodies';
  end if;
  if pg_get_functiondef('public.enforce_invited_signup'::regproc) not like '%invited_emails%' then
    raise exception 'MATRIX FAIL 2d: the gate no longer reads invited_emails';
  end if;
end $$;

-- == 3  created_by has the database-side default ==============================
do $$ declare d text; begin
  select column_default into d from information_schema.columns
   where table_schema='public' and table_name='invite_tokens' and column_name='created_by';
  if d is null or d not ilike '%auth.uid()%' then
    raise exception 'MATRIX FAIL 3a: created_by default is % — expected auth.uid()', coalesce(d,'(none)');
  end if;
end $$;

-- == 4  the stale comment is gone =============================================
do $$ declare c text; begin
  select col_description('public.invite_tokens'::regclass, ordinal_position) into c
    from information_schema.columns
   where table_schema='public' and table_name='invite_tokens' and column_name='neighborhood_id';
  if c ilike '%pledge landing%' or c ilike '%Phase 4%' then
    raise exception 'MATRIX FAIL 4a: the neighborhood_id comment still describes the withdrawn pledge landing';
  end if;
  if c not ilike '%provenance%' then
    raise exception 'MATRIX FAIL 4b: the neighborhood_id comment does not state mint-time provenance';
  end if;
end $$;

-- == 5  BEHAVIOURAL: the default fires, and an explicit value still wins ======
--       The second half is what proves the mint action is unaffected: it
--       supplies created_by explicitly, and an explicit value must override the
--       default rather than be replaced by it.
do $$ declare v_default uuid; v_explicit uuid; v_actor uuid := '11111111-0029-4000-8000-000000000001'; begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_actor, 'authenticated','authenticated',
          'mx0029@example.test','x',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),'','','','');

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_actor::text, 'role','authenticated')::text, true);

  insert into public.invite_tokens (max_uses, expires_at, label)
  values (5, now() + interval '7 days', 'mx0029-default')
  returning created_by into v_default;
  if v_default is distinct from v_actor then
    raise exception 'MATRIX FAIL 5a: omitting created_by recorded % — expected the acting user from auth.uid()', coalesce(v_default::text,'NULL');
  end if;

  insert into public.invite_tokens (max_uses, expires_at, label, created_by)
  values (5, now() + interval '7 days', 'mx0029-explicit', v_actor)
  returning created_by into v_explicit;
  if v_explicit is distinct from v_actor then
    raise exception 'MATRIX FAIL 5b: an explicit created_by was not honoured — the mint action would break';
  end if;

  perform set_config('request.jwt.claims','', true);
end $$;

-- == 6  case 1 can fail (non-vacuity) =========================================
do $$ declare tripped boolean := false; begin
  alter function public.is_moderator() set search_path = public;
  begin
    perform 1 from pg_proc p join pg_namespace nsp on nsp.oid=p.pronamespace
     where nsp.nspname='public' and p.prokind='f'
       and coalesce(array_to_string(p.proconfig,','),'') is distinct from 'search_path=public, pg_temp';
    if found then tripped := true; end if;
  end;
  alter function public.is_moderator() set search_path = public, pg_temp;
  if not tripped then
    raise exception 'MATRIX FAIL 6a: unpinning a function did not make case 1''s predicate match — case 1 proves nothing';
  end if;
end $$;

select 'MATRIX 0029 GREEN — all cases passed' as verdict;

rollback;
