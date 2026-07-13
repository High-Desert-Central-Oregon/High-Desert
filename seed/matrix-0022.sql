-- Migration 0022 dry-run matrix (messages-m1-spec §3.6) — STUDIO-SAFE: pure
-- SQL, no psql meta-commands; failures raise loudly with case numbers;
-- success = 'MATRIX 0022 GREEN'. One transaction, rolled back. Run AFTER
-- applying 0021 and 0022.
-- Personas: aida/ben/carla (verified members), esther (moderator; maintainer
-- of dryrun-private), frank (moderator globally; active member of
-- dryrun-private), diego (unverified). ORDERING: 14 (leave) before 9 (blocks);
-- 10 tombstones carla; case 12's non-participant probe uses LIVE frank (not
-- carla), so it is order-independent of 10; 13 (ben's deletion, M-G2) LAST.

begin;

select
  set_config('mx.aida',   (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'aida@dryrun.test'),   false),
  set_config('mx.ben',    (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'ben@dryrun.test'),    false),
  set_config('mx.carla',  (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'carla@dryrun.test'),  false),
  set_config('mx.esther', (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'esther@dryrun.test'), false),
  set_config('mx.frank',  (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'frank@dryrun.test'),  false),
  set_config('mx.diego',  (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'diego@dryrun.test'),  false),
  set_config('mx.everyone', (select id::text from groups where slug = 'everyone'),       false),
  set_config('mx.private',  (select id::text from groups where slug = 'dryrun-private'), false);

update profiles set verified = false where id = current_setting('mx.diego')::uuid;

-- Contexts (POST-anchored only — the event door is M-G5-deferred): ben's
-- Everyone post (aida's door), carla's Everyone post (the deleted-counterpart
-- no-oracle anchor), frank's members-only post (unreadable to aida), a hidden
-- Everyone post.
insert into posts (group_id, author_id, category, title, body)
values (current_setting('mx.everyone')::uuid, current_setting('mx.ben')::uuid,
        'offer', 'MX msg context', 'Context body.')
returning set_config('mx.p_ben', id::text, false);
insert into posts (group_id, author_id, category, title, body)
values (current_setting('mx.everyone')::uuid, current_setting('mx.carla')::uuid,
        'offer', 'MX carla post', 'Carla body.')
returning set_config('mx.p_carla', id::text, false);
insert into posts (group_id, author_id, category, title, body)
values (current_setting('mx.private')::uuid, current_setting('mx.frank')::uuid,
        'need', 'MX private ctx', 'Members-only.')
returning set_config('mx.p_frank', id::text, false);
insert into posts (group_id, author_id, category, title, body)
values (current_setting('mx.everyone')::uuid, current_setting('mx.ben')::uuid,
        'offer', 'MX hidden ctx', 'Hidden body.')
returning set_config('mx.p_hidden', id::text, false);
insert into moderation_actions (target_type, target_id, actor_id, action, reason)
values ('post', current_setting('mx.p_hidden')::uuid,
        current_setting('mx.esther')::uuid, 'remove', 'matrix: hidden ctx');

-- == 0  privilege determinism ================================================
do $$ declare n int; begin
  -- messages/threads: immutable — no UPDATE/DELETE grants anywhere
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('messages', 'threads')
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE');
  if n <> 0 then raise exception 'MATRIX FAIL 0a: % mutate grants on messages/threads', n; end if;
  -- no INSERT grants on threads/thread_state (start_thread only)
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('threads', 'thread_state')
     and grantee in ('anon', 'authenticated') and privilege_type = 'INSERT';
  if n <> 0 then raise exception 'MATRIX FAIL 0b: client INSERT grants on threads/state'; end if;
  select count(*) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'thread_state'
     and grantee = 'authenticated' and privilege_type = 'UPDATE';
  if n <> 3 then raise exception 'MATRIX FAIL 0c: thread_state updatable columns = % (want 3)', n; end if;
  select count(*) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'messages'
     and grantee = 'authenticated' and privilege_type = 'INSERT';
  if n <> 3 then raise exception 'MATRIX FAIL 0d: messages insertable columns = % (want 3)', n; end if;
  select count(*) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'messages'
     and grantee = 'authenticated' and privilege_type = 'INSERT'
     and column_name = 'created_at';
  if n <> 0 then raise exception 'MATRIX FAIL 0e: created_at insertable'; end if;
  -- anon: nothing on any of the four
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('threads', 'thread_state', 'messages', 'member_blocks')
     and grantee = 'anon';
  if n <> 0 then raise exception 'MATRIX FAIL 0f: anon holds grants'; end if;
  if has_function_privilege('anon', 'public.start_thread(uuid, text, uuid)', 'execute') then
    raise exception 'MATRIX FAIL 0g: anon can execute start_thread'; end if;
  if not has_function_privilege('authenticated', 'public.start_thread(uuid, text, uuid)', 'execute') then
    raise exception 'MATRIX FAIL 0h: authenticated cannot execute start_thread'; end if;
end $$;

-- == 0b  ZERO-READ PIN, structural half: no moderator term in any policy =====
do $$ declare n int; begin
  select count(*) into n from pg_policies
   where schemaname = 'public'
     and tablename in ('threads', 'thread_state', 'messages', 'member_blocks')
     and (coalesce(qual, '') ilike '%is_moderator%'
       or coalesce(with_check, '') ilike '%is_moderator%');
  if n <> 0 then raise exception 'MATRIX FAIL 0b-1: a message-layer policy mentions is_moderator'; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'threads';
  if n <> 1 then raise exception 'MATRIX FAIL 0b-2: threads has % policies (want 1)', n; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'messages';
  if n <> 2 then raise exception 'MATRIX FAIL 0b-3: messages has % policies (want 2)', n; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'thread_state';
  if n <> 2 then raise exception 'MATRIX FAIL 0b-4: thread_state has % policies (want 2)', n; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'member_blocks';
  if n <> 3 then raise exception 'MATRIX FAIL 0b-5: member_blocks has % policies (want 3)', n; end if;
end $$;

-- == 1  anon: everything refused =============================================
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$ begin
  perform count(id) from threads;
  raise exception 'MATRIX FAIL 1a: anon read threads';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform count(id) from messages;
  raise exception 'MATRIX FAIL 1b: anon read messages';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.start_thread(gen_random_uuid(), 'x');
  raise exception 'MATRIX FAIL 1c: anon started a thread';
exception when insufficient_privilege then null; end $$;
reset role;

-- == 2  unverified: cannot start, cannot block ===============================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.diego'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform public.start_thread(current_setting('mx.ben')::uuid, 'hello',
                              current_setting('mx.p_ben')::uuid);
  raise exception 'MATRIX FAIL 2a: unverified member started a thread';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%verified members%' then raise; end if;
end $$;
do $$ begin
  insert into member_blocks (blocker_id, blocked_id)
  values (current_setting('mx.diego')::uuid, current_setting('mx.ben')::uuid);
  raise exception 'MATRIX FAIL 2b: unverified member blocked';
exception when insufficient_privilege then null; end $$;
reset role;

-- == 3  aida starts a thread with ben (post door); restart is the same thread
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('mx.th1',
  public.start_thread(current_setting('mx.ben')::uuid,
                      'Are the tomato starts still free?',
                      current_setting('mx.p_ben')::uuid)::text, true);
-- Structural assertions as OWNER (ts_read is own-row, so a participant can't
-- count both state rows — that's correct RLS, not a defect).
reset role;
do $$ declare t record; n int; begin
  select * into t from threads where id = current_setting('mx.th1')::uuid;
  if t.member_a >= t.member_b then raise exception 'MATRIX FAIL 3a: pair not canonical'; end if;
  if t.about_post_id <> current_setting('mx.p_ben')::uuid then
    raise exception 'MATRIX FAIL 3b: anchor wrong'; end if;
  if t.started_by <> current_setting('mx.aida')::uuid then
    raise exception 'MATRIX FAIL 3b2: started_by wrong'; end if;
  select count(*) into n from thread_state where thread_id = t.id;
  if n <> 2 then raise exception 'MATRIX FAIL 3c: % state rows (want 2)', n; end if;
  select count(*) into n from messages where thread_id = t.id;
  if n <> 1 then raise exception 'MATRIX FAIL 3d: % messages (want 1)', n; end if;
  if (select last_read_at from thread_state
       where thread_id = t.id and member_id = current_setting('mx.aida')::uuid) is null then
    raise exception 'MATRIX FAIL 3e: starter''s read cursor not set'; end if;
end $$;
set local role authenticated;
do $$ declare th2 uuid; n int; begin
  th2 := public.start_thread(current_setting('mx.ben')::uuid, 'Second note.',
                             current_setting('mx.p_ben')::uuid);
  if th2 <> current_setting('mx.th1')::uuid then
    raise exception 'MATRIX FAIL 3f: second start made a second thread'; end if;
  select count(*) into n from messages where thread_id = th2;
  if n <> 2 then raise exception 'MATRIX FAIL 3g: restart did not append'; end if;
end $$;

-- == 4  context law: one structural refusal, whatever the failure ============
-- (Post-anchored only — the event door is M-G5-deferred, so there is no
-- two-anchor case; five failure modes must still collapse to one message.)
do $$
declare msgs text[] := '{}';
begin
  begin  -- 4a: no context
    perform public.start_thread(current_setting('mx.ben')::uuid, 'x');
    raise exception 'MATRIX FAIL 4a: no-context start accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm like 'MATRIX FAIL%' then raise; end if; msgs := msgs || sqlerrm;
  end;
  begin  -- 4b: bogus post id
    perform public.start_thread(current_setting('mx.ben')::uuid, 'x', gen_random_uuid());
    raise exception 'MATRIX FAIL 4b: bogus context accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm like 'MATRIX FAIL%' then raise; end if; msgs := msgs || sqlerrm;
  end;
  begin  -- 4c: post the caller cannot read (members-only)
    perform public.start_thread(current_setting('mx.frank')::uuid, 'x',
                                current_setting('mx.p_frank')::uuid);
    raise exception 'MATRIX FAIL 4c: unreadable context accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm like 'MATRIX FAIL%' then raise; end if; msgs := msgs || sqlerrm;
  end;
  begin  -- 4d: post not authored by the addressee
    perform public.start_thread(current_setting('mx.carla')::uuid, 'x',
                                current_setting('mx.p_ben')::uuid);
    raise exception 'MATRIX FAIL 4d: author-mismatch context accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm like 'MATRIX FAIL%' then raise; end if; msgs := msgs || sqlerrm;
  end;
  begin  -- 4e: hidden (moderator-removed) post
    perform public.start_thread(current_setting('mx.ben')::uuid, 'x',
                                current_setting('mx.p_hidden')::uuid);
    raise exception 'MATRIX FAIL 4e: hidden context accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm like 'MATRIX FAIL%' then raise; end if; msgs := msgs || sqlerrm;
  end;
  -- one message, five ways (no readability oracle)
  if (select count(distinct m) from unnest(msgs) m) <> 1 then
    raise exception 'MATRIX FAIL 4f: context refusals differ: %', msgs; end if;
end $$;

-- == 5  self-message and empty body refused ==================================
do $$ begin
  perform public.start_thread(current_setting('mx.aida')::uuid, 'hi',
                              current_setting('mx.p_ben')::uuid);
  raise exception 'MATRIX FAIL 5a: messaged self';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%yourself%' then raise; end if;
end $$;
do $$ begin
  perform public.start_thread(current_setting('mx.ben')::uuid, '   ',
                              current_setting('mx.p_ben')::uuid);
  raise exception 'MATRIX FAIL 5b: empty body accepted';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%message first%' then raise; end if;
end $$;
reset role;

-- == 6  sending: participant replies; forged sender + outsider refused =======
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into messages (thread_id, sender_id, body)
values (current_setting('mx.th1')::uuid, current_setting('mx.ben')::uuid,
        'Yes — porch pickup.');
do $$ begin
  insert into messages (thread_id, sender_id, body)
  values (current_setting('mx.th1')::uuid, current_setting('mx.aida')::uuid, 'forged');
  raise exception 'MATRIX FAIL 6a: forged sender accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into messages (thread_id, sender_id, body, created_at)
  values (current_setting('mx.th1')::uuid, current_setting('mx.ben')::uuid, 'backdated',
          now() - interval '10 days');
  raise exception 'MATRIX FAIL 6b: backdated message accepted';
exception when insufficient_privilege then null; end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.carla'), 'role', 'authenticated')::text, true);
set local role authenticated;
-- Positive session control FIRST: prove carla's JWT resolves to carla (else
-- the deny assertions below pass vacuously on a null uid). She can read her
-- own Everyone post via po_read (is_group_member(everyone) ≡ is_verified).
do $$ declare n int; begin
  select count(id) into n from posts where id = current_setting('mx.p_carla')::uuid;
  if n <> 1 then raise exception 'MATRIX FAIL 6c0: carla''s session does not resolve (control)'; end if;
end $$;
do $$ declare n int; begin
  select count(id) into n from threads where id = current_setting('mx.th1')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 6c: outsider sees the thread'; end if;
  select count(id) into n from messages where thread_id = current_setting('mx.th1')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 6d: outsider reads messages'; end if;
end $$;
do $$ begin
  insert into messages (thread_id, sender_id, body)
  values (current_setting('mx.th1')::uuid, current_setting('mx.carla')::uuid, 'intrude');
  raise exception 'MATRIX FAIL 6e: outsider sent into the thread';
exception when insufficient_privilege then null; end $$;
reset role;

-- == 6f  thread_state allow-arm + forge refusal (aida, a participant) ========
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from thread_state
   where thread_id = current_setting('mx.th1')::uuid;
  if n <> 1 then raise exception 'MATRIX FAIL 6f: participant reads % state rows (want her 1)', n; end if;
  if (select last_read_at from thread_state
       where thread_id = current_setting('mx.th1')::uuid
         and member_id = current_setting('mx.aida')::uuid) is null then
    raise exception 'MATRIX FAIL 6f2: own read cursor not visible'; end if;
end $$;
do $$ begin  -- can't move my state row onto another member (member_id ungranted)
  update thread_state set member_id = current_setting('mx.ben')::uuid
   where thread_id = current_setting('mx.th1')::uuid
     and member_id = current_setting('mx.aida')::uuid;
  raise exception 'MATRIX FAIL 6g: forged thread_state ownership accepted';
exception when insufficient_privilege then null; end $$;
reset role;

-- == 7  ZERO-READ PIN, behavioral half: the moderator reads NOTHING ==========
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.esther'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(id) into n from threads where id = current_setting('mx.th1')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 7a: MODERATOR sees a thread (zero-read pin broken)'; end if;
  select count(id) into n from messages where thread_id = current_setting('mx.th1')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 7b: MODERATOR reads messages (zero-read pin broken)'; end if;
  select count(thread_id) into n from thread_state
   where thread_id = current_setting('mx.th1')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 7c: MODERATOR reads thread state'; end if;
end $$;
do $$ declare n int; begin
  update thread_state set muted_at = now()
   where thread_id = current_setting('mx.th1')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'MATRIX FAIL 7d: MODERATOR mutated thread state'; end if;
end $$;
reset role;

-- == 8  immutability: participants cannot edit history ======================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  update messages set body = 'rewritten'
   where thread_id = current_setting('mx.th1')::uuid;
  raise exception 'MATRIX FAIL 8a: message edited';
exception when insufficient_privilege then null; end $$;
do $$ begin
  delete from messages where thread_id = current_setting('mx.th1')::uuid;
  raise exception 'MATRIX FAIL 8b: message deleted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update threads set about_post_id = null where id = current_setting('mx.th1')::uuid;
  raise exception 'MATRIX FAIL 8c: thread re-anchored';
exception when insufficient_privilege then null; end $$;

-- == 14  leave = archive; restarting resets my left_at ======================
update thread_state set left_at = now()
 where thread_id = current_setting('mx.th1')::uuid
   and member_id = current_setting('mx.aida')::uuid;
do $$ begin
  if (select left_at from thread_state
       where thread_id = current_setting('mx.th1')::uuid
         and member_id = current_setting('mx.aida')::uuid) is null then
    raise exception 'MATRIX FAIL 14a: leave did not stick'; end if;
end $$;
do $$ declare th uuid; begin
  th := public.start_thread(current_setting('mx.ben')::uuid, 'Back again.',
                            current_setting('mx.p_ben')::uuid);
  if (select left_at from thread_state
       where thread_id = th and member_id = current_setting('mx.aida')::uuid) is not null then
    raise exception 'MATRIX FAIL 14b: restart did not un-archive'; end if;
end $$;
reset role;

-- == 9  blocks: symmetric freeze, silent, reversible =========================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into member_blocks (blocker_id, blocked_id)
values (current_setting('mx.ben')::uuid, current_setting('mx.aida')::uuid);
-- bl_read allow-arm: the blocker sees his own block (so the UI can undo it)
do $$ declare n int; begin
  select count(*) into n from member_blocks
   where blocker_id = current_setting('mx.ben')::uuid;
  if n <> 1 then raise exception 'MATRIX FAIL 9a0: blocker cannot see his own block'; end if;
end $$;
do $$ begin
  insert into messages (thread_id, sender_id, body)
  values (current_setting('mx.th1')::uuid, current_setting('mx.ben')::uuid, 'frozen for me too');
  raise exception 'MATRIX FAIL 9a: blocker still sent (freeze not symmetric)';
exception when insufficient_privilege then null; end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  insert into messages (thread_id, sender_id, body)
  values (current_setting('mx.th1')::uuid, current_setting('mx.aida')::uuid, 'through the wall');
  raise exception 'MATRIX FAIL 9b: blocked member sent';
exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin
  select count(*) into n from member_blocks;   -- bl_read: own rows only
  if n <> 0 then raise exception 'MATRIX FAIL 9c: the blocked member can see the block'; end if;
end $$;
select set_config('mx.err_blocked', '', true);
do $$ begin
  perform public.start_thread(current_setting('mx.ben')::uuid, 'hello?',
                              current_setting('mx.p_ben')::uuid);
  raise exception 'MATRIX FAIL 9d: blocked start accepted';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' then raise; end if;
  perform set_config('mx.err_blocked', sqlerrm, true);
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
delete from member_blocks
 where blocker_id = current_setting('mx.ben')::uuid
   and blocked_id = current_setting('mx.aida')::uuid;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into messages (thread_id, sender_id, body)
values (current_setting('mx.th1')::uuid, current_setting('mx.aida')::uuid,
        'Unblocked — sending again.');
reset role;

-- == 10  no oracle: blocked refusal ≡ deleted-counterpart refusal ============
select set_config('request.jwt.claims', '', true);
update profiles set deleted_at = now() where id = current_setting('mx.carla')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  -- Post anchor is VALID (carla's Everyone post is readable, authored by
  -- carla) so the context check passes; the reachability check then fails on
  -- carla's deleted_at — the same no-oracle message as a block.
  perform public.start_thread(current_setting('mx.carla')::uuid, 'hello?',
                              current_setting('mx.p_carla')::uuid);
  raise exception 'MATRIX FAIL 10a: reached a deleted member';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' then raise; end if;
  if sqlerrm <> current_setting('mx.err_blocked') then
    raise exception 'MATRIX FAIL 10b: deleted-refusal differs from blocked-refusal (oracle): % vs %',
      sqlerrm, current_setting('mx.err_blocked');
  end if;
end $$;
reset role;

-- == 11  rate valve: 10 new pairs/day; replies and re-starts exempt ==========
select set_config('request.jwt.claims', '', true);
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
  'authenticated', 'mx-rate-' || i || '@dryrun.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', 'MX Rate ' || i), now(), now(), '', '', '', ''
from generate_series(1, 9) i;
-- pair aida with each (canonical order), started_by aida — 9 seeded + th1 = 10
insert into threads (member_a, member_b, started_by)
select least(current_setting('mx.aida')::uuid, u.id),
       greatest(current_setting('mx.aida')::uuid, u.id),
       current_setting('mx.aida')::uuid
  from auth.users u where u.email like 'mx-rate-%@dryrun.test';
-- The valid rate probe needs a readable context to a NEW counterpart: a
-- fresh Everyone post authored by esther (aida has started no thread to her).
insert into posts (group_id, author_id, category, title, body)
values (current_setting('mx.everyone')::uuid, current_setting('mx.esther')::uuid,
        'offer', 'MX rate ctx', 'Rate probe.')
returning set_config('mx.p_esther', id::text, false);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform public.start_thread(current_setting('mx.esther')::uuid, 'eleventh',
                              current_setting('mx.p_esther')::uuid);
  raise exception 'MATRIX FAIL 11a: eleventh new conversation accepted';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%plenty%' then raise; end if;
end $$;
-- replies and existing-pair restarts are exempt at cap
insert into messages (thread_id, sender_id, body)
values (current_setting('mx.th1')::uuid, current_setting('mx.aida')::uuid,
        'Replying at the cap.');
do $$ declare th uuid; begin
  th := public.start_thread(current_setting('mx.ben')::uuid, 'Restart at the cap.',
                            current_setting('mx.p_ben')::uuid);
  if th <> current_setting('mx.th1')::uuid then
    raise exception 'MATRIX FAIL 11b: restart minted a new thread at cap'; end if;
end $$;

-- == 12  thread reports: participant-only; excerpt scoped ====================
select set_config('mx.report_excerpt',
  'aida: Are the tomato starts still free? / ben: Yes — porch pickup.', true);
insert into reports (reporter_id, target_type, target_id, body, quoted_excerpt)
values (current_setting('mx.aida')::uuid, 'message_thread',
        current_setting('mx.th1')::uuid, 'MX: testing thread report',
        current_setting('mx.report_excerpt'))
returning set_config('mx.r_thread', id::text, true);
-- a plain post report still works post-0022 (the widened constraint holds)…
insert into reports (reporter_id, target_type, target_id, body)
values (current_setting('mx.aida')::uuid, 'post',
        current_setting('mx.p_ben')::uuid, 'MX: plain post report post-0022');
-- …but an excerpt on a non-thread report is refused at the source:
do $$ begin
  insert into reports (reporter_id, target_type, target_id, body, quoted_excerpt)
  values (current_setting('mx.aida')::uuid, 'post',
          current_setting('mx.p_ben')::uuid, 'x', 'excerpt on a post');
  raise exception 'MATRIX FAIL 12a: excerpt accepted on a non-thread report';
exception when check_violation then null; end $$;
reset role;
-- 12b: a LIVE verified non-participant cannot file a thread report. Frank is
-- used deliberately — he's a MODERATOR globally, so this also proves the
-- participant gate isn't bypassed by moderator status (rp_insert has no
-- is_moderator term). Positive control first: frank resolves and reads his
-- own members-only post, so the deny below isn't a vacuous null-uid pass.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.frank'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(id) into n from posts where id = current_setting('mx.p_frank')::uuid;
  if n <> 1 then raise exception 'MATRIX FAIL 12b0: frank''s session does not resolve (control)'; end if;
end $$;
do $$ begin
  insert into reports (reporter_id, target_type, target_id, body)
  values (current_setting('mx.frank')::uuid, 'message_thread',
          current_setting('mx.th1')::uuid, 'outsider report');
  raise exception 'MATRIX FAIL 12b: non-participant (moderator) reported a thread';
exception when insufficient_privilege then null; end $$;
reset role;
-- the moderator sees the EXCERPT (the consent-based door) but not the thread
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.esther'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare r record; n int; begin
  select * into r from reports where id = current_setting('mx.r_thread')::uuid;
  if not found or r.quoted_excerpt <> current_setting('mx.report_excerpt') then
    raise exception 'MATRIX FAIL 12c: moderator cannot read the reported excerpt'; end if;
  select count(id) into n from messages where thread_id = r.target_id;
  if n <> 0 then raise exception 'MATRIX FAIL 12d: the report opened the thread to the moderator'; end if;
end $$;
reset role;

-- == 13  M-G2 (LAST): deletion purges state, keeps words =====================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into member_blocks (blocker_id, blocked_id)
values (current_setting('mx.ben')::uuid, current_setting('mx.frank')::uuid);
select set_config('mx.msgs_before',
  (select count(*)::text from messages where thread_id = current_setting('mx.th1')::uuid), true);
select public.delete_my_account();
reset role;
select set_config('request.jwt.claims', '', true);
do $$ declare n int; begin
  select count(*) into n from thread_state
   where member_id = current_setting('mx.ben')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 13a: state survived deletion'; end if;
  select count(*) into n from member_blocks
   where blocker_id = current_setting('mx.ben')::uuid
      or blocked_id = current_setting('mx.ben')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 13b: blocks survived deletion'; end if;
  select count(*) into n from messages
   where thread_id = current_setting('mx.th1')::uuid;
  if n <> current_setting('mx.msgs_before')::int then
    raise exception 'MATRIX FAIL 13c: messages did not survive deletion (M-G2)'; end if;
  if not exists (select 1 from threads where id = current_setting('mx.th1')::uuid) then
    raise exception 'MATRIX FAIL 13d: thread erased'; end if;
end $$;
-- the counterpart still reads the whole conversation; sending fails closed
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(id) into n from messages
   where thread_id = current_setting('mx.th1')::uuid
     and sender_id = current_setting('mx.ben')::uuid;
  if n < 1 then raise exception 'MATRIX FAIL 13e: counterpart lost the leaver''s words'; end if;
end $$;
do $$ begin
  insert into messages (thread_id, sender_id, body)
  values (current_setting('mx.th1')::uuid, current_setting('mx.aida')::uuid, 'into the void');
  raise exception 'MATRIX FAIL 13f: sent to a deleted account';
exception when insufficient_privilege then null; end $$;
reset role;

select 'MATRIX 0022 GREEN — all cases passed' as verdict;

rollback;
