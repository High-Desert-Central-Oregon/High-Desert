-- Migration 0018 dry-run matrix v2 — extended per the four-lens adversarial
-- review. Every case raises loudly on unexpected outcome; the whole run rolls
-- back. Personas: aida/ben (verified members), carla (maintainer of
-- dryrun-curated), esther (moderator; maintainer of dryrun-private), frank
-- (member of dryrun-private), diego (flipped unverified in setup).
-- aida maintains dryrun-public-board; ben is PENDING in dryrun-curated.
\set ON_ERROR_STOP on

begin;

-- ---- setup (owner) ----
select p.id as aida_id   from profiles p join auth.users u on u.id=p.id where u.email='aida@dryrun.test' \gset
select p.id as ben_id    from profiles p join auth.users u on u.id=p.id where u.email='ben@dryrun.test' \gset
select p.id as carla_id  from profiles p join auth.users u on u.id=p.id where u.email='carla@dryrun.test' \gset
select p.id as esther_id from profiles p join auth.users u on u.id=p.id where u.email='esther@dryrun.test' \gset
select p.id as frank_id  from profiles p join auth.users u on u.id=p.id where u.email='frank@dryrun.test' \gset
select p.id as diego_id  from profiles p join auth.users u on u.id=p.id where u.email='diego@dryrun.test' \gset
select id as everyone_id from groups where slug='everyone' \gset
select id as private_id  from groups where slug='dryrun-private' \gset
select id as board_id    from groups where slug='dryrun-public-board' \gset
select id as curated_id  from groups where slug='dryrun-curated' \gset

update profiles set verified=false where id = :'diego_id';

insert into posts (id, group_id, author_id, category, title, body)
values (gen_random_uuid(), :'everyone_id', :'aida_id', 'offer', 'P1 seed', 'Seed body one.')
returning id as p1 \gset
insert into posts (id, group_id, author_id, category, title, body)
values (gen_random_uuid(), :'private_id', :'frank_id', 'need', 'P2 private', 'Members-only body.')
returning id as p2 \gset
insert into posts (id, group_id, author_id, category, title, body)
values (gen_random_uuid(), :'everyone_id', :'esther_id', 'aid', 'P3 moderator-own', 'Moderator authored.')
returning id as p3 \gset
insert into posts (id, group_id, author_id, category, title, body)
values (gen_random_uuid(), :'board_id', :'ben_id', 'goods', 'P4 board', 'Board post.')
returning id as p4 \gset
insert into posts (id, group_id, author_id, category, title, body)
values (gen_random_uuid(), :'curated_id', :'carla_id', 'offer', 'P5 curated', 'Curated body.')
returning id as p5 \gset

select set_config('mx.aida', :'aida_id', false), set_config('mx.ben', :'ben_id', false),
       set_config('mx.carla', :'carla_id', false), set_config('mx.esther', :'esther_id', false),
       set_config('mx.frank', :'frank_id', false), set_config('mx.diego', :'diego_id', false),
       set_config('mx.everyone', :'everyone_id', false), set_config('mx.private', :'private_id', false),
       set_config('mx.board', :'board_id', false), set_config('mx.curated', :'curated_id', false),
       set_config('mx.p1', :'p1', false), set_config('mx.p2', :'p2', false),
       set_config('mx.p3', :'p3', false), set_config('mx.p4', :'p4', false),
       set_config('mx.p5', :'p5', false);

\echo '== 0  privilege determinism: no table-level INSERT/UPDATE/TRUNCATE on posts; pin columns ungranted'
do $$ declare n int; begin
  select count(*) into n from information_schema.role_table_grants
   where table_schema='public' and table_name='posts'
     and grantee in ('anon','authenticated')
     and privilege_type in ('INSERT','UPDATE','TRUNCATE');
  if n <> 0 then raise exception 'MATRIX FAIL 0a: % table-level write grants on posts', n; end if;
  select count(*) into n from information_schema.column_privileges
   where table_schema='public' and table_name='posts'
     and grantee='authenticated' and column_name in ('pinned_at','pinned_by','edited_at','created_at','id')
     and privilege_type in ('INSERT','UPDATE');
  if n <> 0 then raise exception 'MATRIX FAIL 0b: trust columns grantable (%)', n; end if;
  select count(*) into n from information_schema.role_table_grants
   where table_schema='public' and table_name='events'
     and grantee in ('anon','authenticated')
     and privilege_type in ('INSERT','UPDATE');
  if n <> 0 then raise exception 'MATRIX FAIL 0c: % blanket write grants remain on events', n; end if;
end $$;

\echo '== 1  aida inserts to Everyone (allow)'
select set_config('request.jwt.claims', json_build_object('sub', :'aida_id'::text, 'role','authenticated')::text, true);
set local role authenticated;
insert into posts (group_id, author_id, category, title, body)
values (:'everyone_id', :'aida_id', 'offer', 'A1 by aida', 'Hello Everyone.')
returning id as a1 \gset
select set_config('mx.a1', :'a1', true);

\echo '== 2  aida forges author_id=ben (deny)'
do $$ begin
  insert into posts (group_id, author_id, category, title, body)
  values (current_setting('mx.everyone')::uuid, current_setting('mx.ben')::uuid, 'offer', 'forged', 'x');
  raise exception 'MATRIX FAIL 2: forged author accepted';
exception when insufficient_privilege then null; end $$;

\echo '== 3  aida inserts born-pinned (deny — no column privilege)'
do $$ begin
  insert into posts (group_id, author_id, category, title, body, pinned_at)
  values (current_setting('mx.everyone')::uuid, current_setting('mx.aida')::uuid, 'offer', 'born pinned', 'x', now());
  raise exception 'MATRIX FAIL 3: pinned_at insert accepted';
exception when insufficient_privilege then null; end $$;

\echo '== 4  aida backdates created_at at insert (deny — chronological feed, invariant 7)'
do $$ begin
  insert into posts (group_id, author_id, category, title, body, created_at)
  values (current_setting('mx.everyone')::uuid, current_setting('mx.aida')::uuid, 'offer', 'backdated', 'x', now() - interval '30 days');
  raise exception 'MATRIX FAIL 4: created_at insert accepted';
exception when insufficient_privilege then null; end $$;

\echo '== 5  aida edits own title (allow); edited_at stamped; group frozen'
update posts set title = 'A1 edited' where id = :'a1';
reset role;
do $$ begin
  if (select edited_at from posts where id = current_setting('mx.a1')::uuid) is null then
    raise exception 'MATRIX FAIL 5a: edited_at not stamped'; end if;
  if (select group_id from posts where id = current_setting('mx.a1')::uuid) <> current_setting('mx.everyone')::uuid then
    raise exception 'MATRIX FAIL 5b: group_id moved'; end if;
end $$;

\echo '== 6  aida updates group_id / pinned_at / edited_at (deny each — no column privilege)'
select set_config('request.jwt.claims', json_build_object('sub', :'aida_id'::text, 'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  update posts set group_id = current_setting('mx.private')::uuid where id = current_setting('mx.a1')::uuid;
  raise exception 'MATRIX FAIL 6a: group_id update accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update posts set pinned_at = now() where id = current_setting('mx.a1')::uuid;
  raise exception 'MATRIX FAIL 6b: self-pin accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update posts set edited_at = null where id = current_setting('mx.a1')::uuid;
  raise exception 'MATRIX FAIL 6c: edited_at update accepted';
exception when insufficient_privilege then null; end $$;

\echo '== 7  ben edits aida''s post (0 rows via RLS)'
select set_config('request.jwt.claims', json_build_object('sub', :'ben_id'::text, 'role','authenticated')::text, true);
do $$ declare n int; begin
  update posts set title='hijack' where id = current_setting('mx.a1')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'MATRIX FAIL 7: cross-member update hit % rows', n; end if;
end $$;

\echo '== 8  ben deletes aida''s post (0 rows); aida deletes own (1 row)'
do $$ declare n int; begin
  delete from posts where id = current_setting('mx.a1')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'MATRIX FAIL 8a: cross-member delete hit % rows', n; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'aida_id'::text, 'role','authenticated')::text, true);
do $$ declare n int; begin
  delete from posts where id = current_setting('mx.a1')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'MATRIX FAIL 8b: own delete hit % rows', n; end if;
end $$;

\echo '== 9  read scoping: aida sees 0 of dryrun-private; frank sees it'
do $$ declare n int; begin
  select count(*) into n from posts where group_id = current_setting('mx.private')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 9a: non-member read % private rows', n; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'frank_id'::text, 'role','authenticated')::text, true);
do $$ declare n int; begin
  select count(*) into n from posts where group_id = current_setting('mx.private')::uuid;
  if n < 1 then raise exception 'MATRIX FAIL 9b: active member reads 0 private rows'; end if;
end $$;

\echo '== 10 WRITE scoping: aida (non-member) posts + events into dryrun-private (deny both)'
select set_config('request.jwt.claims', json_build_object('sub', :'aida_id'::text, 'role','authenticated')::text, true);
do $$ begin
  insert into posts (group_id, author_id, category, title, body)
  values (current_setting('mx.private')::uuid, current_setting('mx.aida')::uuid, 'offer', 'intrude', 'x');
  raise exception 'MATRIX FAIL 10a: cross-group post insert accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into events (group_id, creator_id, title, starts_at)
  values (current_setting('mx.private')::uuid, current_setting('mx.aida')::uuid, 'intrude ev', now() + interval '1 day');
  raise exception 'MATRIX FAIL 10b: cross-group event insert accepted';
exception when insufficient_privilege then null; end $$;

\echo '== 11 pending membership is NOT membership: ben (pending in curated) reads 0, insert denied'
select set_config('request.jwt.claims', json_build_object('sub', :'ben_id'::text, 'role','authenticated')::text, true);
do $$ declare n int; begin
  select count(*) into n from posts where group_id = current_setting('mx.curated')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 11a: pending member read % curated rows', n; end if;
end $$;
do $$ begin
  insert into posts (group_id, author_id, category, title, body)
  values (current_setting('mx.curated')::uuid, current_setting('mx.ben')::uuid, 'offer', 'pending write', 'x');
  raise exception 'MATRIX FAIL 11b: pending member insert accepted';
exception when insufficient_privilege then null; end $$;

\echo '== 12 diego (unverified): insert denied; Everyone posts AND events read as 0 rows (G-2 boundary)'
select set_config('request.jwt.claims', json_build_object('sub', :'diego_id'::text, 'role','authenticated')::text, true);
do $$ begin
  insert into posts (group_id, author_id, category, title, body)
  values (current_setting('mx.everyone')::uuid, current_setting('mx.diego')::uuid, 'offer', 'unverified', 'x');
  raise exception 'MATRIX FAIL 12a: unverified insert accepted';
exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin
  select count(*) into n from posts where group_id = current_setting('mx.everyone')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 12b: unverified read % Everyone posts', n; end if;
  select count(*) into n from events where group_id = current_setting('mx.everyone')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 12c: unverified read % Everyone events', n; end if;
end $$;

\echo '== 13 anon: SELECT denied outright; set_post_pin refused by the internal gate, no audit row'
reset role;
set local role anon;
do $$ declare n int; begin
  select count(*) into n from posts;
  raise exception 'MATRIX FAIL 13a: anon read succeeded (% rows)', n;
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform set_post_pin(current_setting('mx.p1')::uuid, true);
  raise exception 'MATRIX FAIL 13b: anon pinned';
exception when others then
  if sqlerrm not like '%moderator%' then raise; end if;
end $$;
reset role;
do $$ declare n int; begin
  select count(*) into n from audit_log where action='post.pinned' and entity_id = current_setting('mx.p1')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 13c: anon pin attempt wrote audit'; end if;
end $$;

\echo '== 14 Everyone pin lifecycle: member denied; moderator pins (audit); dup-board loud; re-pin loud; unpin (audit); re-unpin loud'
select set_config('request.jwt.claims', json_build_object('sub', :'ben_id'::text, 'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform set_post_pin(current_setting('mx.p1')::uuid, true);
  raise exception 'MATRIX FAIL 14a: plain member pinned the board';
exception when others then
  if sqlerrm not like '%moderator%' then raise; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'esther_id'::text, 'role','authenticated')::text, true);
select set_post_pin(:'p1'::uuid, true);
do $$ begin
  perform set_post_pin(current_setting('mx.p3')::uuid, true);
  raise exception 'MATRIX FAIL 14b: second pin on the same board accepted';
exception when others then
  if sqlerrm not like '%already pinned on this board%' then raise; end if;
end $$;
do $$ begin
  perform set_post_pin(current_setting('mx.p1')::uuid, true);
  raise exception 'MATRIX FAIL 14c: no-op re-pin accepted';
exception when others then
  if sqlerrm not like '%already pinned' then raise; end if;
end $$;
reset role;
do $$ begin
  if (select pinned_by from posts where id = current_setting('mx.p1')::uuid) <> current_setting('mx.esther')::uuid then
    raise exception 'MATRIX FAIL 14d: pinned_by wrong'; end if;
  if not exists (select 1 from audit_log where action='post.pinned' and entity_id = current_setting('mx.p1')::uuid) then
    raise exception 'MATRIX FAIL 14e: pin not audited'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'esther_id'::text, 'role','authenticated')::text, true);
set local role authenticated;
select set_post_pin(:'p1'::uuid, false);
do $$ begin
  perform set_post_pin(current_setting('mx.p1')::uuid, false);
  raise exception 'MATRIX FAIL 14f: no-op unpin accepted (false audit row risk)';
exception when others then
  if sqlerrm not like '%not pinned%' then raise; end if;
end $$;
reset role;
do $$ declare n int; begin
  if (select pinned_at from posts where id = current_setting('mx.p1')::uuid) is not null then
    raise exception 'MATRIX FAIL 14g: unpin did not clear'; end if;
  select count(*) into n from audit_log where action='post.unpinned' and entity_id = current_setting('mx.p1')::uuid;
  if n <> 1 then raise exception 'MATRIX FAIL 14h: expected exactly 1 unpin audit row, got %', n; end if;
end $$;

\echo '== 15 group-board pin: maintainer pins; member denied; moderator may NOT pin but MAY unpin (hostage rule)'
select set_config('request.jwt.claims', json_build_object('sub', :'aida_id'::text, 'role','authenticated')::text, true);
set local role authenticated;
select set_post_pin(:'p4'::uuid, true);
select set_config('request.jwt.claims', json_build_object('sub', :'ben_id'::text, 'role','authenticated')::text, true);
do $$ begin
  perform set_post_pin(current_setting('mx.p4')::uuid, false);
  raise exception 'MATRIX FAIL 15a: plain member unpinned a group board';
exception when others then
  if sqlerrm not like '%maintainer%' then raise; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'esther_id'::text, 'role','authenticated')::text, true);
do $$ begin
  perform set_post_pin(current_setting('mx.p4')::uuid, true);
  raise exception 'MATRIX FAIL 15b: platform moderator PINNED inside a group (G9)';
exception when others then
  if sqlerrm not like '%maintainer%' then raise; end if;
end $$;
select set_post_pin(:'p4'::uuid, false);  -- moderator UNPIN anywhere: allowed
reset role;
do $$ begin
  if (select pinned_at from posts where id = current_setting('mx.p4')::uuid) is not null then
    raise exception 'MATRIX FAIL 15c: moderator unpin did not clear'; end if;
  if not exists (select 1 from audit_log where action='post.unpinned' and entity_id = current_setting('mx.p4')::uuid) then
    raise exception 'MATRIX FAIL 15d: moderator unpin not audited'; end if;
end $$;

\echo '== 16 maintainer power is confined to their OWN group: aida pin into dryrun-private (deny)'
select set_config('request.jwt.claims', json_build_object('sub', :'aida_id'::text, 'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform set_post_pin(current_setting('mx.p2')::uuid, true);
  raise exception 'MATRIX FAIL 16: wrong-group maintainer pinned (G12 deputy confusion)';
exception when others then
  if sqlerrm not like '%maintainer%' then raise; end if;
end $$;

\echo '== 17 spec-hole: moderator pins their OWN post — sticks; edited_at stays null'
select set_config('request.jwt.claims', json_build_object('sub', :'esther_id'::text, 'role','authenticated')::text, true);
select set_post_pin(:'p3'::uuid, true);
reset role;
do $$ begin
  if (select pinned_at from posts where id = current_setting('mx.p3')::uuid) is null then
    raise exception 'MATRIX FAIL 17a: moderator own-post pin was stripped'; end if;
  if (select edited_at from posts where id = current_setting('mx.p3')::uuid) is not null then
    raise exception 'MATRIX FAIL 17b: pin stamped edited_at (post would display as edited)'; end if;
end $$;

\echo '== 18 events: insert WITHOUT group_id defaults to Everyone; re-home + creator frozen; created_at not insertable'
select set_config('request.jwt.claims', json_build_object('sub', :'aida_id'::text, 'role','authenticated')::text, true);
set local role authenticated;
insert into events (creator_id, title, starts_at)
values (:'aida_id', 'E2 by aida (no group sent)', now() + interval '3 days')
returning id as e2 \gset
select set_config('mx.e2', :'e2', true);
reset role;
do $$ begin
  if (select group_id from events where id = current_setting('mx.e2')::uuid) <> current_setting('mx.everyone')::uuid then
    raise exception 'MATRIX FAIL 18a: null group_id did not default to Everyone'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'aida_id'::text, 'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  update events set group_id = current_setting('mx.private')::uuid where id = current_setting('mx.e2')::uuid;
  raise exception 'MATRIX FAIL 18b: event group_id update accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update events set creator_id = current_setting('mx.ben')::uuid where id = current_setting('mx.e2')::uuid;
  raise exception 'MATRIX FAIL 18c: event creator_id update accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into events (creator_id, title, starts_at, created_at)
  values (current_setting('mx.aida')::uuid, 'backdated ev', now(), now() - interval '10 days');
  raise exception 'MATRIX FAIL 18d: event created_at insert accepted';
exception when insufficient_privilege then null; end $$;
update events set title = 'E2 renamed' where id = :'e2';
reset role;
do $$ begin
  if (select title from events where id = current_setting('mx.e2')::uuid) <> 'E2 renamed' then
    raise exception 'MATRIX FAIL 18e: legitimate event edit lost'; end if;
end $$;

\echo '== 19 moderation: removal hides at the DB for members; author + moderator keep the row (P7); hidden post refuses pin'
select set_config('request.jwt.claims', json_build_object('sub', :'esther_id'::text, 'role','authenticated')::text, true);
set local role authenticated;
insert into moderation_actions (target_type, target_id, action, reason, actor_id)
values ('post', :'p1', 'remove', 'matrix test', :'esther_id');
do $$ begin
  if not is_content_hidden('post', current_setting('mx.p1')::uuid) then
    raise exception 'MATRIX FAIL 19a: removed post not hidden'; end if;
end $$;
do $$ begin
  perform set_post_pin(current_setting('mx.p1')::uuid, true);
  raise exception 'MATRIX FAIL 19b: pinned a removed post';
exception when others then
  if sqlerrm not like '%removed%' then raise; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'ben_id'::text, 'role','authenticated')::text, true);
do $$ declare n int; begin
  select count(*) into n from posts where id = current_setting('mx.p1')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 19c: ordinary member reads a removed post'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'aida_id'::text, 'role','authenticated')::text, true);
do $$ declare n int; begin
  select count(*) into n from posts where id = current_setting('mx.p1')::uuid;
  if n <> 1 then raise exception 'MATRIX FAIL 19d: author cannot see own removed post (P7)'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'esther_id'::text, 'role','authenticated')::text, true);
do $$ declare n int; begin
  select count(*) into n from posts where id = current_setting('mx.p1')::uuid;
  if n <> 1 then raise exception 'MATRIX FAIL 19e: moderator cannot see removed post'; end if;
end $$;

\echo '== 20 ev_read preserved: ben still reads Everyone events'
select set_config('request.jwt.claims', json_build_object('sub', :'ben_id'::text, 'role','authenticated')::text, true);
do $$ declare n int; begin
  select count(*) into n from events where group_id = current_setting('mx.everyone')::uuid;
  if n < 1 then raise exception 'MATRIX FAIL 20: member reads 0 Everyone events'; end if;
end $$;

reset role;
\echo '== MATRIX v2 COMPLETE — all 21 case groups passed; rolling back =='
rollback;
