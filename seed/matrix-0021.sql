-- Migration 0021 dry-run matrix — STUDIO-SAFE: pure SQL, no psql
-- meta-commands; ids ride GUCs; failures raise loudly with case numbers;
-- success = the script reaches 'MATRIX 0021 GREEN'. One transaction, rolled
-- back. Run AFTER applying migrations/0021_reports.sql.
-- Personas (seed/dryrun): aida/ben (verified members), esther (moderator),
-- frank (ACTIVE member of dryrun-private), diego (flipped unverified here).

begin;

select
  set_config('mx.aida',   (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'aida@dryrun.test'),   false),
  set_config('mx.ben',    (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'ben@dryrun.test'),    false),
  set_config('mx.esther', (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'esther@dryrun.test'), false),
  set_config('mx.frank',  (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'frank@dryrun.test'),  false),
  set_config('mx.diego',  (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'diego@dryrun.test'),  false),
  set_config('mx.everyone', (select id::text from groups where slug = 'everyone'),       false),
  set_config('mx.private',  (select id::text from groups where slug = 'dryrun-private'), false);

update profiles set verified = false where id = current_setting('mx.diego')::uuid;

-- Targets: an Everyone post + event (readable by all verified members) and a
-- members-only post in dryrun-private (readable by frank/esther only).
insert into posts (group_id, author_id, category, title, body)
values (current_setting('mx.everyone')::uuid, current_setting('mx.ben')::uuid,
        'offer', 'MX report target', 'Reportable body.')
returning set_config('mx.p_pub', id::text, false);

insert into events (creator_id, group_id, title, starts_at)
values (current_setting('mx.ben')::uuid, current_setting('mx.everyone')::uuid,
        'MX report event', now() + interval '2 days')
returning set_config('mx.e_pub', id::text, false);

insert into posts (group_id, author_id, category, title, body)
values (current_setting('mx.private')::uuid, current_setting('mx.frank')::uuid,
        'need', 'MX private target', 'Members-only body.')
returning set_config('mx.p_prv', id::text, false);

-- A members-only EVENT too, so the event arm of rp_insert gets a cross-board
-- deny (not just the allow path) — symmetry with the post arm.
insert into events (creator_id, group_id, title, starts_at)
values (current_setting('mx.frank')::uuid, current_setting('mx.private')::uuid,
        'MX private event', now() + interval '4 days')
returning set_config('mx.e_prv', id::text, false);

-- == 0  privilege determinism ================================================
do $$ declare n int; begin
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'reports'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE');
  if n <> 0 then raise exception 'MATRIX FAIL 0a: % write grants beyond insert', n; end if;
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'reports' and grantee = 'anon';
  if n <> 0 then raise exception 'MATRIX FAIL 0b: anon holds grants on reports'; end if;
  select count(distinct column_name) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'reports'
     and grantee = 'authenticated' and privilege_type = 'INSERT';
  if n <> 4 then raise exception 'MATRIX FAIL 0c: insertable columns = % (want 4)', n; end if;
  select count(*) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'reports'
     and grantee = 'authenticated' and privilege_type = 'INSERT'
     and column_name in ('resolved_by', 'resolved_at', 'outcome', 'created_at');
  if n <> 0 then raise exception 'MATRIX FAIL 0d: resolution/clock columns insertable'; end if;
  if has_function_privilege('anon', 'public.resolve_report(uuid, text)', 'execute') then
    raise exception 'MATRIX FAIL 0e: anon can execute resolve_report'; end if;
  if not has_function_privilege('authenticated', 'public.resolve_report(uuid, text)', 'execute') then
    raise exception 'MATRIX FAIL 0f: authenticated cannot execute resolve_report'; end if;
end $$;

-- == 1  anon: everything refused =============================================
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$ begin
  perform count(id) from reports;
  raise exception 'MATRIX FAIL 1a: anon read reports';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into reports (reporter_id, target_type, target_id, body)
  values (gen_random_uuid(), 'post', gen_random_uuid(), 'x');
  raise exception 'MATRIX FAIL 1b: anon filed a report';
exception when insufficient_privilege then null; end $$;
reset role;

-- == 2  unverified member cannot file ========================================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.diego'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  insert into reports (reporter_id, target_type, target_id, body)
  values (current_setting('mx.diego')::uuid, 'post', current_setting('mx.p_pub')::uuid, 'x');
  raise exception 'MATRIX FAIL 2: unverified member filed a report';
exception when insufficient_privilege then null; end $$;
reset role;

-- == 3  aida files on post + event (allow); forged reporter refused ==========
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into reports (reporter_id, target_type, target_id, body)
values (current_setting('mx.aida')::uuid, 'post', current_setting('mx.p_pub')::uuid,
        'MX: this looks like spam')
returning set_config('mx.r1', id::text, true);
insert into reports (reporter_id, target_type, target_id, body)
values (current_setting('mx.aida')::uuid, 'event', current_setting('mx.e_pub')::uuid,
        'MX: event concern')
returning set_config('mx.r2', id::text, true);
do $$ begin
  insert into reports (reporter_id, target_type, target_id, body)
  values (current_setting('mx.ben')::uuid, 'post', current_setting('mx.p_pub')::uuid, 'forged');
  raise exception 'MATRIX FAIL 3a: forged reporter accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into reports (reporter_id, target_type, target_id, body)
  values (current_setting('mx.aida')::uuid, 'post', gen_random_uuid(), 'bogus target');
  raise exception 'MATRIX FAIL 3b: bogus target accepted';
exception when insufficient_privilege then null; end $$;
-- == 4  cross-board: aida cannot report what she cannot read (post AND event)
do $$ begin
  insert into reports (reporter_id, target_type, target_id, body)
  values (current_setting('mx.aida')::uuid, 'post', current_setting('mx.p_prv')::uuid, 'probe');
  raise exception 'MATRIX FAIL 4a: reported an unreadable members-only post';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into reports (reporter_id, target_type, target_id, body)
  values (current_setting('mx.aida')::uuid, 'event', current_setting('mx.e_prv')::uuid, 'probe');
  raise exception 'MATRIX FAIL 4b: reported an unreadable members-only event';
exception when insufficient_privilege then null; end $$;
-- == 3c  filing left NO permanent-record trace (doctrine: filing not audited)
do $$ declare n int; begin
  select count(*) into n from audit_log
   where entity = 'report'
     and entity_id in (current_setting('mx.r1')::uuid, current_setting('mx.r2')::uuid);
  if n <> 0 then raise exception 'MATRIX FAIL 3c: filing wrote % audit rows', n; end if;
end $$;
-- == 3d  rp_read ALLOW arm: aida reads exactly her own two reports ============
do $$ declare n int; begin
  select count(*) into n from reports;
  if n <> 2 then raise exception 'MATRIX FAIL 3d: reporter sees % reports (want her 2)', n; end if;
  select count(*) into n from reports where reporter_id <> current_setting('mx.aida')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 3e: reporter sees another''s report'; end if;
end $$;
-- == 7  immutability: reporter cannot edit or retract ========================
do $$ begin
  update reports set body = 'edited' where id = current_setting('mx.r1')::uuid;
  raise exception 'MATRIX FAIL 7a: reporter edited a report';
exception when insufficient_privilege then null; end $$;
do $$ begin
  delete from reports where id = current_setting('mx.r1')::uuid;
  raise exception 'MATRIX FAIL 7b: reporter deleted a report';
exception when insufficient_privilege then null; end $$;
reset role;

-- == 5  read scope: own rows only; moderators see all ========================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(id) into n from reports where id = current_setting('mx.r1')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 5a: ben read aida''s report'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.esther'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(id) into n from reports
   where id in (current_setting('mx.r1')::uuid, current_setting('mx.r2')::uuid);
  if n <> 2 then raise exception 'MATRIX FAIL 5b: moderator sees % of 2 reports', n; end if;
end $$;

-- == 6  resolution: moderator-only, whole, once, audited =====================
select public.resolve_report(current_setting('mx.r1')::uuid, 'actioned');
do $$ begin
  perform public.resolve_report(current_setting('mx.r1')::uuid, 'dismissed');
  raise exception 'MATRIX FAIL 6a: report resolved twice';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%already resolved%' then raise; end if;
end $$;
do $$ begin
  perform public.resolve_report(current_setting('mx.r2')::uuid, 'shrugged');
  raise exception 'MATRIX FAIL 6b: invalid outcome accepted';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%actioned or dismissed%' then raise; end if;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform public.resolve_report(current_setting('mx.r2')::uuid, 'dismissed');
  raise exception 'MATRIX FAIL 6c: non-moderator resolved a report';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%moderators%' then raise; end if;
end $$;
reset role;
do $$ declare r record; n int; begin
  select * into r from reports where id = current_setting('mx.r1')::uuid;
  if r.resolved_by <> current_setting('mx.esther')::uuid
     or r.resolved_at is null or r.outcome <> 'actioned' then
    raise exception 'MATRIX FAIL 6d: resolution fields wrong';
  end if;
  select count(*) into n from audit_log
   where action = 'report.resolved' and entity_id = current_setting('mx.r1')::uuid;
  if n <> 1 then raise exception 'MATRIX FAIL 6e: resolution not audited'; end if;
end $$;

-- == 6f  reports_resolution_whole: a partial resolution is refused ============
-- (Owner context — column-writable only here; clients can't reach these
-- columns at all. Pins the named all-or-nothing CHECK.)
do $$ begin
  update reports set resolved_at = now() where id = current_setting('mx.r2')::uuid;
  raise exception 'MATRIX FAIL 6f: partial resolution accepted';
exception when check_violation then null; end $$;

-- == 6g  reporter reads her OWN resolved report — outcome + resolver visible
-- (Decision 2026-07-13: consistent with named-moderator accountability; the
-- no-oracle guarantee is the FILING confirmation, not lifelong opacity.)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare r record; begin
  select * into r from reports where id = current_setting('mx.r1')::uuid;
  if r.outcome <> 'actioned' or r.resolved_by <> current_setting('mx.esther')::uuid then
    raise exception 'MATRIX FAIL 6g: reporter cannot read her own resolution';
  end if;
end $$;
reset role;

-- == 8  purge-on-delete: reports leave with the reporter =====================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.delete_my_account();
reset role;
select set_config('request.jwt.claims', '', true);
do $$ declare n int; begin
  select count(*) into n from reports
   where reporter_id = current_setting('mx.aida')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 8: % reports survived account deletion', n; end if;
end $$;

select 'MATRIX 0021 GREEN — all cases passed' as verdict;

rollback;
