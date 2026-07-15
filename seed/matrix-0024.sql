-- Migration 0024 dry-run matrix — STUDIO-SAFE: pure SQL, no psql meta-commands;
-- ids/roles ride GUCs + role impersonation; failures raise loudly with case
-- numbers; success = the script reaches 'MATRIX 0024 GREEN'. One transaction,
-- rolled back — writes nothing. Run AFTER applying migrations/0024_invited_emails.sql.
--
-- Proves the four-lens bar for the invite-only signup gate:
--   L1 read-path attack — the roster is moderator-only: anon and a plain member
--      cannot read invited_emails; a moderator can. No client-callable predicate
--      exists (no enumeration oracle at the DB).
--   L2 promise fidelity — the gate actually gates: the enforcement predicate is
--      correct (allowlisted present / non-allowlisted absent) and the function
--      keys on session_user. The LIVE auth.users block (non-allowlisted refused,
--      allowlisted allowed) is proven OUT-OF-BAND — a second connection AS
--      supabase_auth_admin, since session_user is fixed per connection and this
--      single owner-connection matrix cannot assume it. Normalization is canonical.
--   L3 invariant/regression — owner/service inserts are not gated (seeds keep
--      working, G-INV-b); a plain member cannot write the roster.
--   L4 rigor — table shape, normalize trigger, and the auth.users enforcement
--      trigger are all wired.
--
-- Personas (seed/dry-run-accounts.sql): ben (b2, verified member),
-- esther (e5, moderator). We add/remove allowlist rows only inside the txn.

begin;

select
  set_config('mx.ben',    (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'ben@dryrun.test'),    false),
  set_config('mx.esther', (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'esther@dryrun.test'), false);

-- == 0  schema shape: table, normalize trigger, enforcement trigger ===========
do $$ declare n int; begin
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='invited_emails') then
    raise exception 'MATRIX FAIL 0a: invited_emails table missing'; end if;
  -- email is the primary key
  if not exists (
    select 1 from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
     where tc.table_name='invited_emails' and tc.constraint_type='PRIMARY KEY'
       and kcu.column_name='email') then
    raise exception 'MATRIX FAIL 0b: invited_emails.email is not the primary key'; end if;
  -- normalize trigger on invited_emails
  if not exists (select 1 from pg_trigger where tgname='trg_normalize_invited_email') then
    raise exception 'MATRIX FAIL 0c: normalize trigger missing'; end if;
  -- enforcement trigger on auth.users
  select count(*) into n from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace ns on ns.oid = c.relnamespace
   where t.tgname='trg_enforce_invited_signup' and ns.nspname='auth' and c.relname='users';
  if n <> 1 then raise exception 'MATRIX FAIL 0d: enforce trigger not on auth.users (% found)', n; end if;
end $$;

-- == 1  normalization: writes are canonicalized (owner context) ===============
insert into public.invited_emails (email, note) values ('  Cohort.One@DryRun.TEST ', 'mx');
do $$ declare stored text; begin
  select email into stored from public.invited_emails where email = 'cohort.one@dryrun.test';
  if stored is null then
    raise exception 'MATRIX FAIL 1a: email not normalized to lower/trimmed on write'; end if;
end $$;

-- == 2  RLS read: member CANNOT read the roster; moderator CAN ================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.invited_emails;
  if n <> 0 then raise exception 'MATRIX FAIL 2a: a plain member read the roster (% rows)', n; end if;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.esther'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  if not public.is_moderator() then raise exception 'MATRIX FAIL 2z: esther is not a moderator (seed drift)'; end if;
  select count(*) into n from public.invited_emails where email = 'cohort.one@dryrun.test';
  if n <> 1 then raise exception 'MATRIX FAIL 2b: moderator cannot read the roster'; end if;
end $$;
reset role;

-- == 3  RLS write: a plain member cannot add to the roster ====================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  insert into public.invited_emails (email) values ('sneak@dryrun.test');
  raise exception 'MATRIX FAIL 3a: a plain member wrote the roster';
exception
  when insufficient_privilege then null;   -- RLS with-check / missing grant blocked it
  when others then
    raise exception 'MATRIX FAIL 3b: member write blocked by wrong error: % (%)', sqlerrm, sqlstate;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- == 4  the gate PREDICATE — the exact exists() the trigger raises on =========
--     The enforcement keys on session_user='supabase_auth_admin', which a single
--     matrix connection (running as the owner) cannot simulate — session_user is
--     fixed per connection and set-role does not change it. So the LIVE block is
--     an OUT-OF-BAND test (a second connection AS supabase_auth_admin; see the
--     branch report / docs). Here we prove the two things that make the trigger
--     deterministic: (a) the predicate is correct, and (b) the trigger is wired
--     BEFORE INSERT on auth.users to the enforcing function (case 0d).
do $$ begin
  -- allowlisted (case 1) → present; the gate would ALLOW it
  if not exists (select 1 from public.invited_emails where email = lower(btrim('Cohort.One@DryRun.TEST'))) then
    raise exception 'MATRIX FAIL 4a: allowlisted email not found by the gate predicate'; end if;
  -- non-allowlisted → absent; the gate would REFUSE it
  if exists (select 1 from public.invited_emails where email = lower(btrim('ghost@notinvited.test'))) then
    raise exception 'MATRIX FAIL 4b: a non-allowlisted email matched the gate predicate'; end if;
end $$;

-- == 5  the enforcing function keys on session_user, not current_user =========
--     (SECURITY DEFINER makes current_user the definer; only session_user names
--     the real caller — the fix that makes the gate actually fire under GoTrue.)
do $$ declare src text; begin
  select pg_get_functiondef(oid) into src from pg_proc where proname = 'enforce_invited_signup';
  if src not ilike '%session_user%' then
    raise exception 'MATRIX FAIL 5a: enforce_invited_signup does not key on session_user'; end if;
  if src ilike '%current_user =%' then
    raise exception 'MATRIX FAIL 5b: enforce_invited_signup still keys on current_user (never fires under SECURITY DEFINER)'; end if;
end $$;

-- == 6  regression: owner/seed inserts are NOT gated (G-INV-b) =================
--     As the owner (session_user = owner, not the auth service), a non-allowlisted
--     auth.users insert must NOT hit our invite rule — this is what keeps
--     `supabase db reset` + dry-run seeding working. The BEFORE trigger fires
--     first, so if our rule wrongly applied we'd see check_violation here.
savepoint owner_ok;
do $$ begin
  insert into auth.users (id, email) values (gen_random_uuid(), 'ownerpath@notinvited.test');
exception
  when check_violation then
    raise exception 'MATRIX FAIL 6a: owner/seed insert was wrongly gated by the invite rule';
  when others then null;                   -- not our gate; other auth.users constraints acceptable
end $$;
rollback to savepoint owner_ok;

select 'MATRIX 0024 GREEN — all cases passed (live auth-service block is out-of-band; see report)' as verdict;

rollback;
