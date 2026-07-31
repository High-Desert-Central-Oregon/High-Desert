-- Migration 0027 dry-run matrix — STUDIO-SAFE: pure SQL, no psql meta-commands;
-- ids/roles ride GUCs + role impersonation; failures raise loudly with case
-- numbers; success = the script reaches 'MATRIX 0027 GREEN'. One transaction,
-- rolled back — writes nothing. Run AFTER applying
-- migrations/0027_invite_tokens.sql.
--
-- Proves the four-lens bar for bearer invite tokens:
--   L1 read-path attack — neither new table is readable by anon or by a plain
--      member; only redeem_invite reaches anon, and the purge does not.
--   L2 promise fidelity — a valid token admits and attributes; expired,
--      exhausted, revoked, unknown and malformed all return the SAME false and
--      write nothing; a repeat redemption by the same address burns no use.
--   L3 invariant/regression — enforce_invited_signup is byte-identical and still
--      reads only invited_emails. THIS IS THE CASE THAT MATTERS: the build adds a
--      writer to the allowlist and must not teach the gate anything.
--   L4 rigor — table shapes, the idempotency primary key, the entropy default,
--      mandatory expiry, and locked search_path on both new functions.
--
-- NOT provable here: the concurrency guarantee. Two simultaneous redemptions of
-- a one-use token need two connections and real commits, which a single
-- rolled-back transaction cannot stage. That lives in
-- steppe/tests/invite-tokens.test.ts, which proves it by first failing against a
-- deliberately non-atomic implementation. Case 7 below asserts the guard is
-- present in the function source, which is the most this file can honestly do.
--
-- Personas (seed/dry-run-accounts.sql): ben (b2, verified member). Not required —
-- falls back to a synthetic sub when the dry-run seed is absent.

begin;

select set_config(
  'mx.ben',
  coalesce(
    (select p.id::text from profiles p join auth.users u on u.id = p.id
      where u.email = 'ben@dryrun.test'),
    '99999999-9999-9999-9999-999999999999'),
  false);

-- == 0  schema shape ==========================================================
do $$ declare n int; begin
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='invite_tokens') then
    raise exception 'MATRIX FAIL 0a: invite_tokens missing'; end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='invite_redemptions') then
    raise exception 'MATRIX FAIL 0b: invite_redemptions missing'; end if;

  -- expiry is mandatory: no nullable-means-forever token
  if exists (select 1 from information_schema.columns
              where table_name='invite_tokens' and column_name='expires_at'
                and is_nullable='YES') then
    raise exception 'MATRIX FAIL 0c: expires_at is nullable'; end if;

  -- the cap must be positive, and the counter non-negative
  if not exists (select 1 from pg_constraint
                  where conrelid='public.invite_tokens'::regclass
                    and pg_get_constraintdef(oid) ilike '%max_uses > 0%') then
    raise exception 'MATRIX FAIL 0d: max_uses > 0 check missing'; end if;

  -- (token_id, email) is the idempotency guarantee, in the database
  select count(*) into n
    from information_schema.table_constraints tc
    join information_schema.key_column_usage k on k.constraint_name = tc.constraint_name
   where tc.table_name='invite_redemptions' and tc.constraint_type='PRIMARY KEY'
     and k.column_name in ('token_id','email_normalized');
  if n <> 2 then
    raise exception 'MATRIX FAIL 0e: invite_redemptions PK is not (token_id, email_normalized) — idempotency is not enforced'; end if;

  -- profiles must NOT have gained an invited_by column (ADR §3, G-INV-2)
  if exists (select 1 from information_schema.columns
              where table_name='profiles' and column_name='invited_by') then
    raise exception 'MATRIX FAIL 0f: profiles.invited_by exists — the invite graph escaped its subsystem'; end if;
end $$;

-- == 1  token entropy: random, not sequential, not guessable ==================
do $$ declare a text; b text; begin
  if (select column_default from information_schema.columns
       where table_name='invite_tokens' and column_name='token') not ilike '%gen_random_bytes%' then
    raise exception 'MATRIX FAIL 1a: token default is not gen_random_bytes'; end if;

  insert into public.invite_tokens (max_uses, expires_at, label)
  values (1, now() + interval '1 day', 'mx-0027-e1') returning token into a;
  insert into public.invite_tokens (max_uses, expires_at, label)
  values (1, now() + interval '1 day', 'mx-0027-e2') returning token into b;

  if a = b then raise exception 'MATRIX FAIL 1b: two minted tokens collided'; end if;
  if length(a) <> 32 then
    raise exception 'MATRIX FAIL 1c: token is % chars, expected 32 (128 bits hex)', length(a); end if;
  if a !~ '^[0-9a-f]{32}$' then
    raise exception 'MATRIX FAIL 1d: token is not lowercase hex: %', a; end if;
end $$;

-- == 2  RLS + privileges: deny by default =====================================
do $$ declare g text; begin
  if not (select relrowsecurity from pg_class where relname='invite_tokens') then
    raise exception 'MATRIX FAIL 2a: RLS off on invite_tokens'; end if;
  if not (select relrowsecurity from pg_class where relname='invite_redemptions') then
    raise exception 'MATRIX FAIL 2b: RLS off on invite_redemptions'; end if;

  -- (i) TABLE privileges. Deliberately separate from the function check in 2d:
  --     table grants and function grants live in different catalogs, and a single
  --     "no anon grant" clause covering both is an invariant that can be true and
  --     false at once. An earlier draft of this file checked only this half and
  --     passed while anon held EXECUTE on redeem_invite.
  select string_agg(distinct grantee||':'||privilege_type, ', ') into g
    from information_schema.role_table_grants
   where table_schema='public' and table_name in ('invite_tokens','invite_redemptions')
     and grantee = 'anon';
  if g is not null then
    raise exception 'MATRIX FAIL 2c: anon holds TABLE grants on the invite tables (%)', g; end if;
end $$;

-- == 2d  FUNCTION privileges: nothing in 0027 is anon-reachable ===============
--       The guard against reintroducing the reversed grant (G-INV-4). Every
--       function this migration creates is named explicitly, so adding one
--       without deciding its grants fails here rather than shipping open.
do $$ declare f text; begin
  foreach f in array array['public.redeem_invite(text,text)',
                           'public.purge_stale_invites(interval)'] loop
    if has_function_privilege('anon', f, 'EXECUTE') then
      raise exception 'MATRIX FAIL 2d: anon can EXECUTE % — G-INV-4 says anon gets nothing. '
                      'The redeem route is server-side and holds service_role; an anonymous '
                      'person does not imply an anonymous database role.', f; end if;
    if has_function_privilege('public', f, 'EXECUTE') then
      raise exception 'MATRIX FAIL 2e: % still carries the default EXECUTE to PUBLIC', f; end if;
  end loop;

  -- And the positive half: the one role that MUST reach redemption still can,
  -- so 2d cannot pass by the function being unreachable to everyone.
  if not has_function_privilege('service_role','public.redeem_invite(text,text)','EXECUTE') then
    raise exception 'MATRIX FAIL 2f: service_role cannot execute redeem_invite — redemption is impossible'; end if;
end $$;

-- fixture for the read-path attacks and the redemption cases
do $$ declare v_tok text; begin
  insert into public.invite_tokens (max_uses, expires_at, label)
  values (3, now() + interval '7 days', 'mx-0027-live') returning token into v_tok;
  perform set_config('mx.tok', v_tok, false);
end $$;

-- == 3  read-path attack: anon sees neither table =============================
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
set local role anon;
do $$ declare leaked boolean; begin
  foreach leaked in array array[false] loop null; end loop;   -- keep declare block tidy
  leaked := false;
  begin perform 1 from public.invite_tokens limit 1; leaked := true;
  exception when others then null; end;
  if leaked then raise exception 'MATRIX FAIL 3a: anon could read invite_tokens'; end if;

  leaked := false;
  begin perform 1 from public.invite_redemptions limit 1; leaked := true;
  exception when others then null; end;
  if leaked then raise exception 'MATRIX FAIL 3b: anon could read invite_redemptions'; end if;
end $$;
reset role;

-- == 4  a plain member sees nothing (RLS is moderator-only) ===================
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('mx.ben'), 'role','authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.invite_tokens;
  if n <> 0 then raise exception 'MATRIX FAIL 4a: a non-moderator read % token rows', n; end if;
  select count(*) into n from public.invite_redemptions;
  if n <> 0 then raise exception 'MATRIX FAIL 4b: a non-moderator read % redemption rows', n; end if;
end $$;
reset role;

-- == 5  function grants =======================================================
do $$ begin
  if has_function_privilege('public','public.redeem_invite(text,text)','EXECUTE') then
    raise exception 'MATRIX FAIL 5a: redeem_invite still grants EXECUTE to PUBLIC'; end if;
  -- INVERTED from an earlier revision of this file, which asserted anon COULD
  -- execute this. Kept as a guard rather than deleted, because the grant it
  -- forbids was once deliberately present and the argument for it was plausible.
  if has_function_privilege('anon','public.redeem_invite(text,text)','EXECUTE') then
    raise exception 'MATRIX FAIL 5b: anon can execute redeem_invite — the grant was reversed; '
                    'exposing the RPC lets a token holder script garbage addresses and exhaust '
                    'the cap before a real redeemer arrives'; end if;
  if not has_function_privilege('service_role','public.redeem_invite(text,text)','EXECUTE') then
    raise exception 'MATRIX FAIL 5c: service_role lost EXECUTE on redeem_invite'; end if;
  if has_function_privilege('anon','public.purge_stale_invites(interval)','EXECUTE') then
    raise exception 'MATRIX FAIL 5d: anon can execute the purge'; end if;
  if has_function_privilege('public','public.purge_stale_invites(interval)','EXECUTE') then
    raise exception 'MATRIX FAIL 5e: purge still grants EXECUTE to PUBLIC'; end if;
end $$;

-- == 6  search_path pinned WITH pg_temp on both new functions ==================
do $$ declare f text; cfg text; begin
  foreach f in array array['public.redeem_invite(text,text)',
                           'public.purge_stale_invites(interval)'] loop
    select array_to_string(proconfig, ',') into cfg from pg_proc where oid = f::regprocedure;
    if cfg is distinct from 'search_path=public, pg_temp' then
      raise exception 'MATRIX FAIL 6a: % pins % (want search_path=public, pg_temp)', f, coalesce(cfg,'nothing'); end if;
  end loop;
end $$;

-- == 7  the atomic guard is present in the redemption source ==================
--     Concurrency itself is proven in steppe/tests/invite-tokens.test.ts (two
--     connections, real commits, and a first run against a non-atomic
--     implementation that must fail). This asserts the guard did not go missing.
do $$ declare src text; begin
  src := pg_get_functiondef('public.redeem_invite(text,text)'::regprocedure);
  if src not ilike '%uses_count < t.max_uses%' then
    raise exception 'MATRIX FAIL 7a: the cap test is not in the UPDATE WHERE clause — check-then-act race'; end if;
  if src not ilike '%expires_at > now()%' then
    raise exception 'MATRIX FAIL 7b: expiry is not tested inside the claim'; end if;
  if src not ilike '%revoked_at is null%' then
    raise exception 'MATRIX FAIL 7c: revocation is not tested inside the claim'; end if;
  if src not ilike '%on conflict (token_id, email_normalized) do nothing%' then
    raise exception 'MATRIX FAIL 7d: the redemption insert is not the idempotency mutex'; end if;
end $$;

-- == 8  a valid token admits, attributes, and counts ==========================
do $$ declare ok boolean; n int; begin
  select public.redeem_invite(current_setting('mx.tok'), '  Neighbor@MX0027.TEST ') into ok;
  if not ok then raise exception 'MATRIX FAIL 8a: a valid token was refused'; end if;

  -- normalized on the way in, so casing cannot make a second person
  select count(*) into n from public.invited_emails where email = 'neighbor@mx0027.test';
  if n <> 1 then raise exception 'MATRIX FAIL 8b: expected 1 allowlist row, got %', n; end if;

  select uses_count into n from public.invite_tokens where token = current_setting('mx.tok');
  if n <> 1 then raise exception 'MATRIX FAIL 8c: uses_count is %, expected 1', n; end if;
end $$;

-- == 9  idempotent per address: a double-tap burns no second use ==============
do $$ declare ok boolean; n int; begin
  select public.redeem_invite(current_setting('mx.tok'), 'NEIGHBOR@mx0027.test') into ok;
  if not ok then raise exception 'MATRIX FAIL 9a: a repeat redemption was refused (it should succeed)'; end if;

  select uses_count into n from public.invite_tokens where token = current_setting('mx.tok');
  if n <> 1 then raise exception 'MATRIX FAIL 9b: a double-tap burned a second use (uses_count=%)', n; end if;

  select count(*) into n from public.invite_redemptions r
    join public.invite_tokens t on t.id = r.token_id
   where t.token = current_setting('mx.tok');
  if n <> 1 then raise exception 'MATRIX FAIL 9c: expected 1 redemption row, got %', n; end if;
end $$;

-- == 10  exhausted / expired / revoked / unknown / malformed all refuse =======
--       Same answer, and nothing written. No oracle in the return value.
do $$ declare ok boolean; n int; v_tok text; begin
  -- exhausted
  insert into public.invite_tokens (max_uses, uses_count, expires_at, label)
  values (1, 1, now() + interval '1 day', 'mx-0027-x') returning token into v_tok;
  select public.redeem_invite(v_tok, 'x@mx0027.test') into ok;
  if ok then raise exception 'MATRIX FAIL 10a: an exhausted token admitted'; end if;

  -- expired
  insert into public.invite_tokens (max_uses, expires_at, label)
  values (5, now() - interval '1 minute', 'mx-0027-p') returning token into v_tok;
  select public.redeem_invite(v_tok, 'p@mx0027.test') into ok;
  if ok then raise exception 'MATRIX FAIL 10b: an expired token admitted'; end if;

  -- revoked
  insert into public.invite_tokens (max_uses, expires_at, revoked_at, label)
  values (5, now() + interval '1 day', now(), 'mx-0027-r') returning token into v_tok;
  select public.redeem_invite(v_tok, 'r@mx0027.test') into ok;
  if ok then raise exception 'MATRIX FAIL 10c: a revoked token admitted'; end if;

  -- unknown token, and a malformed address
  if public.redeem_invite('00000000000000000000000000000000', 'u@mx0027.test') then
    raise exception 'MATRIX FAIL 10d: an unknown token admitted'; end if;
  if public.redeem_invite(current_setting('mx.tok'), 'not-an-email') then
    raise exception 'MATRIX FAIL 10e: a malformed address admitted'; end if;

  -- nothing written by any of the five refusals
  select count(*) into n from public.invited_emails
   where email in ('x@mx0027.test','p@mx0027.test','r@mx0027.test','u@mx0027.test');
  if n <> 0 then raise exception 'MATRIX FAIL 10f: a refused redemption wrote % allowlist rows', n; end if;

  -- and no orphan redemption row left behind by a rolled-back claim
  select count(*) into n from public.invite_redemptions
   where email_normalized in ('x@mx0027.test','p@mx0027.test','r@mx0027.test');
  if n <> 0 then raise exception 'MATRIX FAIL 10g: % orphan redemption rows survived a refusal', n; end if;
end $$;

-- == 11  THE CASE THAT MATTERS — the gate is untouched ========================
do $$ declare src text; sha text; begin
  select encode(sha256(pg_get_functiondef(p.oid)::bytea),'hex') into sha
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='enforce_invited_signup';
  -- Baseline ROTATED by migration 0029 (search_path sweep). The pre-0029 value
  -- was 8f2f632e92d2eab9900fd11b9a0bd9156c2f867bedff33d211f322086366532e
  -- — historical now. 0027 deliberately did not pin this function's search_path
  -- because byte-identity of the gate WAS 0027's regression criterion.
  if sha <> '4a88b18c388fa8c78a4766892774069d562b887e0df9751db0cc288991c29a07' then
    raise exception 'MATRIX FAIL 11a: enforce_invited_signup changed (sha %) — 0027 must not touch the gate', sha; end if;

  src := pg_get_functiondef('public.enforce_invited_signup()'::regprocedure);
  if src !~ 'session_user = ''supabase_auth_admin''' then
    raise exception 'MATRIX FAIL 11b: the gate no longer keys on session_user'; end if;
  if src not ilike '%public.invited_emails%' then
    raise exception 'MATRIX FAIL 11c: the gate no longer reads invited_emails'; end if;
  -- the whole point: the gate learned nothing about tokens
  if src ~* 'invite_tokens|invite_redemptions|redeem_invite' then
    raise exception 'MATRIX FAIL 11d: the gate now references the token subsystem — dual-layer property lost'; end if;
end $$;

-- == 12  the purge is scoped, and is not cron-scheduled =======================
do $$ begin
  if pg_get_functiondef('public.purge_stale_invites(interval)'::regprocedure)
     not ilike '%note = ''invite token''%' then
    raise exception 'MATRIX FAIL 12a: the purge is not scoped to rows this subsystem wrote — it could delete the hand-added roster'; end if;
exception when undefined_function then
  raise exception 'MATRIX FAIL 12b: purge_stale_invites missing';
end $$;

do $$ begin
  if exists (select 1 from pg_class where relname='job' and relnamespace='cron'::regnamespace)
     and exists (select 1 from cron.job where command ilike '%purge_stale_invites%') then
    raise exception 'MATRIX FAIL 12c: the purge is cron-scheduled, but the notify half does not exist yet';
  end if;
exception when undefined_table or invalid_schema_name then null;   -- pg_cron absent: fine
end $$;

-- == 13  the neighborhood reference: nullable, SET NULL, and inert (G-INV-6) ==
--        13a/13b are catalog assertions; 13c is the one that matters, because a
--        column existing says nothing about what happens when the campaign it
--        points at goes away. It closes a neighborhood the hard way — deleting
--        the row — and checks the token and its redemption are both still there.
do $$ declare v_nb uuid; v_tok uuid; n int; begin
  -- 13a nullable: NULL is a meaning (general-purpose token), not an omission
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='invite_tokens'
                    and column_name='neighborhood_id' and is_nullable='YES') then
    raise exception 'MATRIX FAIL 13a: invite_tokens.neighborhood_id missing or NOT NULL — a general-purpose token has no neighborhood'; end if;

  -- 13b the delete rule is SET NULL, not CASCADE and not RESTRICT
  if not exists (select 1 from pg_constraint c
                  where c.conrelid = 'public.invite_tokens'::regclass
                    and c.contype = 'f'
                    and c.confrelid = 'public.neighborhoods'::regclass
                    and c.confdeltype = 'n') then
    raise exception 'MATRIX FAIL 13b: the neighborhood FK delete rule is not SET NULL — a closed campaign could destroy invite history'; end if;

  -- 13c behavioral: the campaign disappears, the token and its history do not
  insert into public.neighborhoods (slug, name, description)
  values ('mx0027-campaign', 'MX0027 Campaign', 'matrix only — rolled back')
  returning id into v_nb;

  insert into public.invite_tokens (max_uses, expires_at, neighborhood_id, label)
  values (5, now() + interval '30 days', v_nb, 'matrix 13c')
  returning id into v_tok;

  insert into public.invite_redemptions (token_id, email_normalized)
  values (v_tok, 'thirteen-c@mx0027.test');

  delete from public.neighborhoods where id = v_nb;

  select count(*) into n from public.invite_tokens where id = v_tok;
  if n <> 1 then
    raise exception 'MATRIX FAIL 13c: deleting the neighborhood deleted the token — invite history is not allowed to cascade'; end if;

  if (select neighborhood_id from public.invite_tokens where id = v_tok) is not null then
    raise exception 'MATRIX FAIL 13d: the token still points at a deleted neighborhood — it should have reverted to general-purpose'; end if;

  select count(*) into n from public.invite_redemptions where token_id = v_tok;
  if n <> 1 then
    raise exception 'MATRIX FAIL 13e: the redemption record went with the neighborhood (% rows left)', n; end if;
end $$;

-- 13f the column is a reference and nothing more. Routing is Phase 4, so no
--     function in this migration may read it — if one starts to, the "inert
--     column" claim in G-INV-6 has quietly stopped being true.
do $$ declare f text; begin
  foreach f in array array['public.redeem_invite(text,text)',
                           'public.purge_stale_invites(interval)']
  loop
    if pg_get_functiondef(f::regprocedure) ilike '%neighborhood_id%' then
      raise exception 'MATRIX FAIL 13f: % reads neighborhood_id — 0027 stores the reference, Phase 4 routes on it', f; end if;
  end loop;
end $$;

select 'MATRIX 0027 GREEN — all cases passed (concurrency proven out-of-band; see report)' as verdict;

rollback;
