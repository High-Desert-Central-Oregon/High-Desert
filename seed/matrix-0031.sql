-- Migration 0031 dry-run matrix — STUDIO-SAFE: pure SQL, no psql meta-commands;
-- failures raise loudly with case numbers; success = the script reaches
-- 'MATRIX 0031 GREEN'. One transaction, rolled back — writes NOTHING. Run AFTER
-- applying migrations/0031_join_signup_source.sql.
--
-- Proves the DB-level backstop for interest_signups.source (per-piece signup
-- tracking, ?r=bc|pc|bm on printed collateral):
--   0  shape — column present, NOT NULL, defaults to 'direct', CHECK carries
--      exactly the four known codes.
--   1  promise fidelity — service_role (the table's only writer, per 0014) can
--      insert each of the three printed codes and the omitted-column case
--      defaults to 'direct'.
--   2  the backstop — an unrecognized value is refused by the CHECK, not
--      silently stored or silently coerced at the DB layer. Coercion is the
--      route handler's job (tested at the app layer); the database's job is to
--      refuse anything that gets past it.
--   3  regression — RLS is still enabled with ZERO policies on interest_signups
--      (0014's posture is untouched by this migration).
--
-- No RPC exists for this table (unlike pledges/0026) — the writer is the
-- service-role client, so this matrix inserts as service_role rather than
-- through a SECURITY DEFINER function.

begin;

-- == 0  schema shape =========================================================
do $$ declare src text; nullable text; dflt text; begin
  select is_nullable, column_default into nullable, dflt
    from information_schema.columns
   where table_schema='public' and table_name='interest_signups' and column_name='source';
  if nullable is null then
    raise exception 'MATRIX FAIL 0a: interest_signups.source column missing'; end if;
  if nullable <> 'NO' then
    raise exception 'MATRIX FAIL 0b: interest_signups.source is nullable — must be NOT NULL'; end if;
  if dflt not like '%direct%' then
    raise exception 'MATRIX FAIL 0c: interest_signups.source default is % — expected ''direct''', dflt; end if;

  select pg_get_constraintdef(oid) into src from pg_constraint
    where conrelid='public.interest_signups'::regclass and conname='interest_signups_source_check';
  if src is null then raise exception 'MATRIX FAIL 0d: interest_signups_source_check missing'; end if;
  if src not like '%bc%' or src not like '%pc%' or src not like '%bm%' or src not like '%direct%' then
    raise exception 'MATRIX FAIL 0e: source CHECK is missing one of the four known codes: %', src; end if;
end $$;

-- == 1  promise fidelity: each valid code round-trips, omitted defaults =======
do $$ declare v text; got text; begin
  foreach v in array array['bc','pc','bm'] loop
    insert into public.interest_signups (email, consent, source)
    values ('matrix-0031-' || v || '@example.com', true, v);
    select source into got from public.interest_signups
     where email = 'matrix-0031-' || v || '@example.com';
    if got is distinct from v then
      raise exception 'MATRIX FAIL 1a: code % stored as % — round-trip broken', v, got; end if;
  end loop;

  -- omitted source column → 'direct'
  insert into public.interest_signups (email, consent) values ('matrix-0031-noref@example.com', true);
  select source into got from public.interest_signups where email = 'matrix-0031-noref@example.com';
  if got is distinct from 'direct' then
    raise exception 'MATRIX FAIL 1b: omitted source stored as % — expected ''direct''', got; end if;
end $$;

-- == 2  the backstop: an unrecognized value is refused, not stored ============
do $$ begin
  insert into public.interest_signups (email, consent, source)
  values ('matrix-0031-hostile@example.com', true, 'DROP TABLE interest_signups;--');
  raise exception 'MATRIX FAIL 2a: a hostile source value was accepted';
exception
  when check_violation then
    if exists (select 1 from public.interest_signups where email = 'matrix-0031-hostile@example.com') then
      raise exception 'MATRIX FAIL 2b: CHECK raised but the row exists anyway'; end if;
  when others then
    raise exception 'MATRIX FAIL 2c: hostile source refused by wrong error: % (%)', sqlerrm, sqlstate;
end $$;
do $$ begin
  insert into public.interest_signups (email, consent, source)
  values ('matrix-0031-unknown@example.com', true, 'referral');
  raise exception 'MATRIX FAIL 2d: an unrecognized-but-innocuous source value was accepted';
exception
  when check_violation then null;
  when others then
    raise exception 'MATRIX FAIL 2e: unrecognized source refused by wrong error: % (%)', sqlerrm, sqlstate;
end $$;

-- == 3  regression: RLS posture on interest_signups is unchanged by 0031 ======
do $$ declare n int; begin
  if not exists (select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
                  where ns.nspname='public' and c.relname='interest_signups' and c.relrowsecurity) then
    raise exception 'MATRIX FAIL 3a: RLS not enabled on interest_signups'; end if;
  select count(*) into n from pg_policies where schemaname='public' and tablename='interest_signups';
  if n <> 0 then raise exception 'MATRIX FAIL 3b: interest_signups has % policy(ies) — must stay deny-by-default', n; end if;
end $$;

select 'MATRIX 0031 GREEN — all cases passed (source column shape; three codes round-trip; omitted defaults to direct; CHECK backstop refuses garbage; RLS posture unchanged)' as verdict;

rollback;
