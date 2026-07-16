-- Migration 0025 dry-run matrix — STUDIO-SAFE: pure SQL, no psql meta-commands;
-- failures raise loudly with case numbers; success = the script reaches
-- 'MATRIX 0025 GREEN'. One transaction, rolled back — writes NOTHING (starts from
-- a cleared counter and leaves it cleared). Run AFTER applying
-- migrations/0025_qr_print_variants.sql.
--
-- Proves the four-lens bar for the widened first-party, zero-PII qr_counts
-- aggregate counter (business cards + posters + compass seed card):
--   L1 read-path attack — qr_counts is deny-by-default (RLS on, NO policies):
--      neither anon nor a plain member can read the counter. There is no
--      client-callable read path — the SQL editor (owner) is the only reader.
--   L2 promise fidelity — the counter actually counts: increment_qr_count()
--      creates the row at 1 and atomically bumps it on conflict, for every one of
--      the six known variants × two kinds; garbage variant/kind is refused with
--      'invalid qr counter'; and the row shape is EXACTLY variant × kind × day ×
--      count — no IP, user-agent, cookie, or identifier column exists to hold PII
--      (CLAUDE.md invariant 8).
--   L3 invariant/regression — service-role-only posture holds: anon and
--      authenticated hold NEITHER execute on increment_qr_count() NOR any write
--      grant on qr_counts; a plain member's direct INSERT is refused; only
--      service_role can write. The three NEW variants are accepted; the two old
--      ones still are.
--   L4 rigor — RLS is enabled, the function is SECURITY INVOKER (not DEFINER),
--      the primary key is (variant, kind, day), and the CHECK constraint carries
--      all six variants and nothing else.
--
-- No personas needed: qr_counts has no uid-keyed policy, so the deny is by role,
-- not by identity. We write only inside the txn, via the owner, and roll back.

begin;

-- == 0  schema shape: table, RLS on, PK, SECURITY INVOKER, CHECK = 6 variants ==
do $$ declare n int; src text; begin
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='qr_counts') then
    raise exception 'MATRIX FAIL 0a: qr_counts table missing'; end if;
  -- RLS is enabled (deny-by-default; no policies)
  if not exists (select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
                  where ns.nspname='public' and c.relname='qr_counts' and c.relrowsecurity) then
    raise exception 'MATRIX FAIL 0b: RLS not enabled on qr_counts'; end if;
  select count(*) into n from pg_policies where schemaname='public' and tablename='qr_counts';
  if n <> 0 then raise exception 'MATRIX FAIL 0c: qr_counts has % policy(ies) — must stay deny-by-default', n; end if;
  -- primary key is (variant, kind, day)
  if not exists (
    select 1 from pg_index i join pg_class c on c.oid=i.indrelid
     where c.relname='qr_counts' and i.indisprimary
       and (select array_agg(a.attname order by a.attnum)
              from pg_attribute a where a.attrelid=c.oid and a.attnum = any(i.indkey))
           = array['variant','kind','day']::name[]) then
    raise exception 'MATRIX FAIL 0d: qr_counts primary key is not (variant, kind, day)'; end if;
  -- the increment function is SECURITY INVOKER, not DEFINER
  if exists (select 1 from pg_proc where proname='increment_qr_count' and prosecdef) then
    raise exception 'MATRIX FAIL 0e: increment_qr_count is SECURITY DEFINER — must run INVOKER'; end if;
  -- CHECK constraint carries all six variants and no stray ones
  select pg_get_constraintdef(oid) into src from pg_constraint
    where conrelid='public.qr_counts'::regclass and conname='qr_counts_variant_check';
  if src is null then raise exception 'MATRIX FAIL 0f: qr_counts_variant_check missing'; end if;
  if src not like '%quiet%' or src not like '%square%'
     or src not like '%poster_owned%' or src not like '%poster_built%'
     or src not like '%poster_common%' or src not like '%seed_card%' then
    raise exception 'MATRIX FAIL 0g: variant CHECK is missing one of the six known variants: %', src; end if;
end $$;

-- == 1  zero-PII shape: columns are EXACTLY {variant, kind, day, count} =========
--     Invariant 8: there is nowhere in the row to put an IP, user-agent, cookie,
--     or identifier — the privacy guarantee is structural, not a promise.
do $$ declare cols text; begin
  select string_agg(column_name, ',' order by column_name) into cols
    from information_schema.columns
   where table_schema='public' and table_name='qr_counts';
  if cols <> 'count,day,kind,variant' then
    raise exception 'MATRIX FAIL 1a: qr_counts columns are % — expected exactly count,day,kind,variant', cols; end if;
end $$;

-- == 2  promise fidelity: the counter counts, for every known variant × kind ====
--     (owner context: the owner holds the write grant and is not subject to RLS —
--     this exercises the FUNCTION's create-then-bump logic, not the grant posture,
--     which lens 3 checks separately.)
do $$
declare
  v text; k text; c int;
  variants text[] := array['quiet','square','poster_owned','poster_built','poster_common','seed_card'];
  kinds    text[] := array['scan','join'];
begin
  foreach v in array variants loop
    foreach k in array kinds loop
      perform public.increment_qr_count(v, k);
      select count into c from public.qr_counts where variant=v and kind=k and day=current_date;
      if c is distinct from 1 then
        raise exception 'MATRIX FAIL 2a: first increment of (%, %) gave % — expected 1', v, k, c; end if;
    end loop;
  end loop;
  -- atomic on-conflict bump: a second call on the same key increments, not inserts
  perform public.increment_qr_count('seed_card', 'scan');
  select count into c from public.qr_counts where variant='seed_card' and kind='scan' and day=current_date;
  if c is distinct from 2 then
    raise exception 'MATRIX FAIL 2b: second increment did not bump to 2 (got %)', c; end if;
  -- exactly one row per (variant, kind, day) — the bump reused the row
  select count(*) into c from public.qr_counts where variant='seed_card' and kind='scan' and day=current_date;
  if c <> 1 then raise exception 'MATRIX FAIL 2c: on-conflict inserted a duplicate row (% rows)', c; end if;
end $$;

-- == 3  garbage is refused with 'invalid qr counter' ===========================
do $$ begin
  perform public.increment_qr_count('bogus', 'scan');
  raise exception 'MATRIX FAIL 3a: an unknown variant was accepted';
exception
  when others then
    if sqlerrm not like '%invalid qr counter%' then
      raise exception 'MATRIX FAIL 3b: unknown variant refused by wrong error: % (%)', sqlerrm, sqlstate; end if;
end $$;
do $$ begin
  perform public.increment_qr_count('seed_card', 'view');
  raise exception 'MATRIX FAIL 3c: an unknown kind was accepted';
exception
  when others then
    if sqlerrm not like '%invalid qr counter%' then
      raise exception 'MATRIX FAIL 3d: unknown kind refused by wrong error: % (%)', sqlerrm, sqlstate; end if;
end $$;

-- == 4  read-path attack — anon and member cannot READ the counter =============
--     Rows exist (inserted above), but the counter grants SELECT to NO client
--     role: anon and authenticated hold no read grant at all, so the read is
--     refused with insufficient_privilege before RLS is even consulted. Stronger
--     than deny-by-default filtering — the counter is structurally unreadable by
--     any non-service role. The SQL editor (owner) is the only reader.
set local role anon;
do $$ declare n int; begin
  select count(*) into n from public.qr_counts;
  raise exception 'MATRIX FAIL 4a: anon read the counter (% rows) — it must hold no read grant', n;
exception
  when insufficient_privilege then null;   -- no SELECT grant → refused, as designed
  when others then
    raise exception 'MATRIX FAIL 4a2: anon read blocked by wrong error: % (%)', sqlerrm, sqlstate;
end $$;
reset role;

set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.qr_counts;
  raise exception 'MATRIX FAIL 4b: a plain member read the counter (% rows) — it must hold no read grant', n;
exception
  when insufficient_privilege then null;   -- no SELECT grant → refused, as designed
  when others then
    raise exception 'MATRIX FAIL 4b2: member read blocked by wrong error: % (%)', sqlerrm, sqlstate;
end $$;
reset role;

-- == 5  write-path posture — only service_role may write ========================
--     (a) grant posture, checked directly:
do $$ begin
  -- execute on the increment function: service_role yes; anon/authenticated no
  if not has_function_privilege('service_role', 'public.increment_qr_count(text, text)', 'execute') then
    raise exception 'MATRIX FAIL 5a: service_role cannot execute increment_qr_count'; end if;
  if has_function_privilege('anon', 'public.increment_qr_count(text, text)', 'execute') then
    raise exception 'MATRIX FAIL 5b: anon can execute increment_qr_count'; end if;
  if has_function_privilege('authenticated', 'public.increment_qr_count(text, text)', 'execute') then
    raise exception 'MATRIX FAIL 5c: authenticated can execute increment_qr_count'; end if;
  -- table writes: service_role yes; anon/authenticated no
  if not has_table_privilege('service_role', 'public.qr_counts', 'insert')
     or not has_table_privilege('service_role', 'public.qr_counts', 'update') then
    raise exception 'MATRIX FAIL 5d: service_role lacks insert/update on qr_counts'; end if;
  if has_table_privilege('anon', 'public.qr_counts', 'insert')
     or has_table_privilege('authenticated', 'public.qr_counts', 'insert') then
    raise exception 'MATRIX FAIL 5e: anon or authenticated holds an insert grant on qr_counts'; end if;
end $$;

--     (b) a plain member's direct INSERT is refused (no grant → insufficient_privilege):
set local role authenticated;
do $$ begin
  insert into public.qr_counts (variant, kind) values ('quiet', 'scan');
  raise exception 'MATRIX FAIL 5f: a plain member wrote the counter directly';
exception
  when insufficient_privilege then null;   -- missing write grant blocked it
  when others then
    raise exception 'MATRIX FAIL 5g: member write blocked by wrong error: % (%)', sqlerrm, sqlstate;
end $$;
reset role;

--     (c) a plain member cannot call the increment function either:
set local role authenticated;
do $$ begin
  perform public.increment_qr_count('quiet', 'scan');
  raise exception 'MATRIX FAIL 5h: a plain member executed increment_qr_count';
exception
  when insufficient_privilege then null;   -- EXECUTE not granted
  when others then
    raise exception 'MATRIX FAIL 5i: member execute blocked by wrong error: % (%)', sqlerrm, sqlstate;
end $$;
reset role;

select 'MATRIX 0025 GREEN — all cases passed (counter counts; six variants; deny-by-default; service-role-only; zero-PII shape)' as verdict;

rollback;
