-- Migration 0020 dry-run matrix (calendar-c1-spec §5.4) — STUDIO-SAFE:
-- pure SQL, no psql meta-commands (ids ride GUCs via set_config; failures
-- raise loudly with case numbers; success = the script reaches the final
-- 'MATRIX 0020 GREEN' select). The whole run is one transaction and rolls
-- back. Run AFTER applying migrations/0020_calendar_feeds.sql.
--
-- Personas (seed/dryrun): aida/ben (verified members), carla (maintainer of
-- dryrun-curated), esther (moderator; maintainer of dryrun-private), frank
-- (member of dryrun-private), diego (flipped unverified in setup).
-- Memberships that matter: aida ACTIVE in dryrun-curated + maintainer of
-- dryrun-public-board; ben ACTIVE in dryrun-public-board, PENDING in
-- dryrun-curated; frank ACTIVE in dryrun-private only.

begin;

-- ---- setup (owner): publish ids as GUCs -------------------------------------
select
  set_config('mx.aida',   (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'aida@dryrun.test'),   false),
  set_config('mx.ben',    (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'ben@dryrun.test'),    false),
  set_config('mx.carla',  (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'carla@dryrun.test'),  false),
  set_config('mx.esther', (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'esther@dryrun.test'), false),
  set_config('mx.frank',  (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'frank@dryrun.test'),  false),
  set_config('mx.diego',  (select p.id::text from profiles p join auth.users u on u.id = p.id where u.email = 'diego@dryrun.test'),  false),
  set_config('mx.everyone', (select id::text from groups where slug = 'everyone'),            false),
  set_config('mx.private',  (select id::text from groups where slug = 'dryrun-private'),      false),
  set_config('mx.board',    (select id::text from groups where slug = 'dryrun-public-board'), false),
  set_config('mx.curated',  (select id::text from groups where slug = 'dryrun-curated'),      false);

update profiles set verified = false where id = current_setting('mx.diego')::uuid;

-- Seed events across scopes and windows (owner writes; ends_at exercises 0020).
insert into events (creator_id, group_id, title, starts_at, ends_at, location, status)
values (current_setting('mx.aida')::uuid, current_setting('mx.everyone')::uuid,
        'MX everyone +7d', now() + interval '7 days', now() + interval '7 days 2 hours', 'Sam Johnson Park', 'active')
returning set_config('mx.e_ev1', id::text, false);

insert into events (creator_id, group_id, title, starts_at, location, status)
values (current_setting('mx.esther')::uuid, current_setting('mx.everyone')::uuid,
        'MX everyone -10d (in window)', now() - interval '10 days', 'Centennial Park', 'active')
returning set_config('mx.e_past', id::text, false);

insert into events (creator_id, group_id, title, starts_at, location, status)
values (current_setting('mx.esther')::uuid, current_setting('mx.everyone')::uuid,
        'MX everyone -40d (out of window)', now() - interval '40 days', 'City Hall', 'active')
returning set_config('mx.e_old', id::text, false);

insert into events (creator_id, group_id, title, starts_at, location, status)
values (current_setting('mx.aida')::uuid, current_setting('mx.everyone')::uuid,
        'MX everyone +2d cancelled', now() + interval '2 days', 'Library', 'cancelled')
returning set_config('mx.e_cxl', id::text, false);

insert into events (creator_id, group_id, title, starts_at, location, status)
values (current_setting('mx.aida')::uuid, current_setting('mx.everyone')::uuid,
        'MX everyone +4d hidden', now() + interval '4 days', 'Depot', 'active')
returning set_config('mx.e_hid', id::text, false);

insert into events (creator_id, group_id, title, starts_at, location, status)
values (current_setting('mx.frank')::uuid, current_setting('mx.private')::uuid,
        'MX private +3d', now() + interval '3 days', 'Grange Hall', 'active')
returning set_config('mx.e_prv', id::text, false);

insert into events (creator_id, group_id, title, starts_at, location, status)
values (current_setting('mx.aida')::uuid, current_setting('mx.board')::uuid,
        'MX board +5d', now() + interval '5 days', '7th & Evergreen', 'active')
returning set_config('mx.e_brd', id::text, false);

-- Hide one event through the real moderation path (append-only insert).
insert into moderation_actions (target_type, target_id, actor_id, action, reason)
values ('event', current_setting('mx.e_hid')::uuid,
        current_setting('mx.esther')::uuid, 'remove', 'matrix: hidden seed');

-- Give frank a consent row: case 15b regression-pins the 0020 repair of
-- delete_my_account (the 0009 body's consents delete has been refused by
-- 0012's append-only trigger — deletion aborted for every consenting member).
insert into consents (user_id, document_id)
select current_setting('mx.frank')::uuid, d.id from documents d limit 1;

-- RSVPs: aida proves the rsvp arm (incl. hidden/old exclusions); frank proves
-- rsvp'd-then-left; ben is uninvolved noise.
insert into event_rsvps (event_id, user_id, status) values
  (current_setting('mx.e_ev1')::uuid, current_setting('mx.aida')::uuid, 'going'),
  (current_setting('mx.e_cxl')::uuid, current_setting('mx.aida')::uuid, 'maybe'),
  (current_setting('mx.e_hid')::uuid, current_setting('mx.aida')::uuid, 'going'),
  (current_setting('mx.e_old')::uuid, current_setting('mx.aida')::uuid, 'going'),
  (current_setting('mx.e_prv')::uuid, current_setting('mx.frank')::uuid, 'going'),
  (current_setting('mx.e_ev1')::uuid, current_setting('mx.ben')::uuid,  'going');

-- == 0  privilege determinism ================================================
do $$ declare n int; begin
  -- 0a: no table-level writes on calendar_feeds for anon/authenticated
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'calendar_feeds'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'TRUNCATE');
  if n <> 0 then raise exception 'MATRIX FAIL 0a: % write grants on calendar_feeds', n; end if;
  -- 0b: anon has NOTHING on calendar_feeds
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'calendar_feeds' and grantee = 'anon';
  if n <> 0 then raise exception 'MATRIX FAIL 0b: anon holds grants on calendar_feeds'; end if;
  select count(*) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'calendar_feeds' and grantee = 'anon';
  if n <> 0 then raise exception 'MATRIX FAIL 0b2: anon holds column grants on calendar_feeds'; end if;
  -- 0c: authenticated SELECT columns are exactly the six; member_id absent;
  --     and no INSERT/UPDATE column privileges at all
  select count(*) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'calendar_feeds'
     and grantee = 'authenticated' and privilege_type = 'SELECT'
     and column_name = 'member_id';
  if n <> 0 then raise exception 'MATRIX FAIL 0c: member_id selectable'; end if;
  select count(distinct column_name) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'calendar_feeds'
     and grantee = 'authenticated' and privilege_type = 'SELECT';
  if n <> 6 then raise exception 'MATRIX FAIL 0c2: expected 6 selectable columns, got %', n; end if;
  select count(*) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'calendar_feeds'
     and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE');
  if n <> 0 then raise exception 'MATRIX FAIL 0c3: writable columns exist'; end if;
  -- 0d: events.ends_at joined both 0018 column-grant lists
  select count(*) into n from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'events'
     and grantee = 'authenticated' and column_name = 'ends_at'
     and privilege_type in ('INSERT', 'UPDATE');
  if n <> 2 then raise exception 'MATRIX FAIL 0d: ends_at grants incomplete (%)', n; end if;
  -- 0e: function ACLs — payload is service_role-only; mint/rotate authenticated
  if has_function_privilege('anon', 'public.calendar_feed_payload(text)', 'execute')
     or has_function_privilege('authenticated', 'public.calendar_feed_payload(text)', 'execute') then
    raise exception 'MATRIX FAIL 0e: payload executable below service_role';
  end if;
  if not has_function_privilege('service_role', 'public.calendar_feed_payload(text)', 'execute') then
    raise exception 'MATRIX FAIL 0e2: service_role cannot execute payload';
  end if;
  if not has_function_privilege('authenticated', 'public.mint_calendar_feed(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.rotate_calendar_feed(uuid)', 'execute') then
    raise exception 'MATRIX FAIL 0e3: mint/rotate not executable by authenticated';
  end if;
  if has_function_privilege('anon', 'public.mint_calendar_feed(uuid)', 'execute')
     or has_function_privilege('anon', 'public.rotate_calendar_feed(uuid)', 'execute') then
    raise exception 'MATRIX FAIL 0e4: anon can execute mint/rotate';
  end if;
end $$;

-- == 0f  ends_at sanity: end-before-start refused at the source =============
do $$ begin
  insert into events (creator_id, group_id, title, starts_at, ends_at)
  values (current_setting('mx.aida')::uuid, current_setting('mx.everyone')::uuid,
          'MX bad ends', now() + interval '1 day', now());
  raise exception 'MATRIX FAIL 0f: ends_at before starts_at accepted';
exception when check_violation then null; end $$;

-- == 1  anon: everything refused =============================================
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;
do $$ begin
  perform count(id) from calendar_feeds;
  raise exception 'MATRIX FAIL 1a: anon read calendar_feeds';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform * from public.mint_calendar_feed();
  raise exception 'MATRIX FAIL 1b: anon minted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.rotate_calendar_feed(gen_random_uuid());
  raise exception 'MATRIX FAIL 1c: anon rotated';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.calendar_feed_payload(repeat('a', 64));
  raise exception 'MATRIX FAIL 1d: anon called payload';
exception when insufficient_privilege then null; end $$;
reset role;

-- == 2  diego (unverified) cannot mint — personal OR group ===================
-- (Every refusal pins its message so a deny-for-the-wrong-reason can't pass.)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.diego'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform * from public.mint_calendar_feed();
  raise exception 'MATRIX FAIL 2a: unverified member minted';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%verified members%' then raise; end if;
end $$;
do $$ begin
  perform * from public.mint_calendar_feed(current_setting('mx.board')::uuid);
  raise exception 'MATRIX FAIL 2b: unverified member minted a group feed';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%verified members%' then raise; end if;
end $$;
reset role;

-- == 3  aida mints personal: 256-bit hex token; re-mint is idempotent ========
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('mx.feed_aida', m.feed_id::text, true),
       set_config('mx.tok_aida', m.feed_token, true)
  from public.mint_calendar_feed() m;
do $$ begin
  if current_setting('mx.tok_aida') !~ '^[0-9a-f]{64}$' then
    raise exception 'MATRIX FAIL 3a: token not 64-hex (%)', current_setting('mx.tok_aida');
  end if;
end $$;
do $$ declare f record; begin
  select * into f from public.mint_calendar_feed();
  if f.feed_id::text <> current_setting('mx.feed_aida')
     or f.feed_token <> current_setting('mx.tok_aida') then
    raise exception 'MATRIX FAIL 3b: re-mint rotated the feed';
  end if;
end $$;

-- == 4  group mints follow live membership ===================================
-- aida: board (maintainer → allow), everyone (verified → allow), private
-- (deny), nonexistent group (deny); board re-mint is idempotent.
select set_config('mx.tok_aida_brd', m.feed_token, true)
  from public.mint_calendar_feed(current_setting('mx.board')::uuid) m;
select set_config('mx.tok_aida_all', m.feed_token, true)
  from public.mint_calendar_feed(current_setting('mx.everyone')::uuid) m;
do $$ declare f record; begin
  select * into f from public.mint_calendar_feed(current_setting('mx.board')::uuid);
  if f.feed_token <> current_setting('mx.tok_aida_brd') then
    raise exception 'MATRIX FAIL 4-idem: group re-mint rotated the feed';
  end if;
end $$;
do $$ begin
  perform * from public.mint_calendar_feed(current_setting('mx.private')::uuid);
  raise exception 'MATRIX FAIL 4a: non-member minted a group feed';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%group members%' then raise; end if;
end $$;
do $$ begin
  perform * from public.mint_calendar_feed(gen_random_uuid());
  raise exception 'MATRIX FAIL 4c: minted for a nonexistent group';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%group members%' then raise; end if;
end $$;
reset role;

-- ben: personal (allow); curated (PENDING → deny)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('mx.feed_ben', m.feed_id::text, true),
       set_config('mx.tok_ben', m.feed_token, true)
  from public.mint_calendar_feed() m;
do $$ begin
  perform * from public.mint_calendar_feed(current_setting('mx.curated')::uuid);
  raise exception 'MATRIX FAIL 4b: PENDING member minted a group feed';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%group members%' then raise; end if;
end $$;
reset role;

-- carla: curated (maintainer → allow); frank: personal + private (allow)
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.carla'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('mx.tok_carla_crt', m.feed_token, true)
  from public.mint_calendar_feed(current_setting('mx.curated')::uuid) m;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.frank'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('mx.tok_frank', m.feed_token, true)
  from public.mint_calendar_feed() m;
select set_config('mx.tok_frank_prv', m.feed_token, true)
  from public.mint_calendar_feed(current_setting('mx.private')::uuid) m;
reset role;

-- == 5  cross-member isolation + behavioral write denial =====================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  select count(id) into n from calendar_feeds;
  if n <> 1 then raise exception 'MATRIX FAIL 5a: ben sees % feeds (want his 1)', n; end if;
end $$;
do $$ begin
  perform member_id from calendar_feeds;
  raise exception 'MATRIX FAIL 5b: member_id selectable';
exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin
  delete from calendar_feeds where id = current_setting('mx.feed_aida')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'MATRIX FAIL 5c: ben deleted aida''s feed'; end if;
end $$;
-- targeted probes: neither aida's row id nor her token is an oracle for ben
do $$ declare n int; begin
  select count(id) into n from calendar_feeds where id = current_setting('mx.feed_aida')::uuid;
  if n <> 0 then raise exception 'MATRIX FAIL 5e: aida''s row visible by id'; end if;
  select count(id) into n from calendar_feeds where token = current_setting('mx.tok_aida');
  if n <> 0 then raise exception 'MATRIX FAIL 5f: aida''s token probeable'; end if;
end $$;
-- behavioral write denial (the catalog checks in case 0 made flesh):
-- no INSERT/UPDATE policy or grant exists, so every write path is refused
do $$ begin
  insert into calendar_feeds (member_id, group_id, token)
  values (current_setting('mx.ben')::uuid, null, repeat('b', 64));
  raise exception 'MATRIX FAIL 5g: client inserted a feed row';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update calendar_feeds set token = repeat('c', 64)
   where id = current_setting('mx.feed_ben')::uuid;
  raise exception 'MATRIX FAIL 5h: client edited a token';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update calendar_feeds set last_fetched_at = null
   where id = current_setting('mx.feed_ben')::uuid;
  raise exception 'MATRIX FAIL 5i: client edited last_fetched_at';
exception when insufficient_privilege then null; end $$;
reset role;
do $$ begin
  if not exists (select 1 from calendar_feeds where id = current_setting('mx.feed_aida')::uuid) then
    raise exception 'MATRIX FAIL 5d: aida''s feed vanished';
  end if;
end $$;

-- == 6  rotation: owner only; old token dies =================================
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('mx.tok_aida2', public.rotate_calendar_feed(current_setting('mx.feed_aida')::uuid), true);
do $$ begin
  if current_setting('mx.tok_aida2') = current_setting('mx.tok_aida') then
    raise exception 'MATRIX FAIL 6a: rotation kept the token';
  end if;
  if current_setting('mx.tok_aida2') !~ '^[0-9a-f]{64}$' then
    raise exception 'MATRIX FAIL 6b: rotated token not 64-hex';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.ben'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform public.rotate_calendar_feed(current_setting('mx.feed_aida')::uuid);
  raise exception 'MATRIX FAIL 6c: ben rotated aida''s feed';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%Not your calendar link%' then raise; end if;
end $$;
do $$ begin
  perform public.rotate_calendar_feed(gen_random_uuid());
  raise exception 'MATRIX FAIL 6d: rotated a nonexistent feed';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%Not your calendar link%' then raise; end if;
end $$;

-- == 7  delete own ===========================================================
do $$ declare n int; begin
  delete from calendar_feeds where id = current_setting('mx.feed_ben')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'MATRIX FAIL 7: ben could not revoke his feed'; end if;
end $$;
reset role;

-- ============================================================================
-- PAYLOAD CASES — ordering constraints (do not reorder casually):
--   8 must precede 11 (the stamp assertion reads 8's serve);
--   14, 9, 10, 12 must precede 13 (13 unverifies aida — her tokens die);
--   15 runs LAST (15a tombstones aida; 15b deletes frank's account).
-- Dead-state assertions use FULL EQUALITY with '{"ok": false}' — the spec's
-- no-revocation-oracle promise means dead feeds return that exact object,
-- nothing more. ok-true checks use IS DISTINCT FROM (null-safe).
-- ============================================================================

-- == 8  personal payload scope (service_role) ================================
set local role service_role;
select set_config('mx.pay_aida', public.calendar_feed_payload(current_setting('mx.tok_aida2'))::text, true);
reset role;
do $$ declare j jsonb := current_setting('mx.pay_aida')::jsonb; begin
  if (j ->> 'ok') is distinct from 'true' then raise exception 'MATRIX FAIL 8a: personal feed not ok'; end if;
  if j ->> 'cal_name' <> 'Steppe — My calendar · Mi calendario' then
    raise exception 'MATRIX FAIL 8b: cal_name = %', j ->> 'cal_name'; end if;
  -- IN: rsvp'd Everyone (+7d, with ends_at), rsvp'd cancelled, explicit
  --     groups' events (board; curated has none)
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_ev1');
  if not found then raise exception 'MATRIX FAIL 8c: rsvp''d Everyone event missing'; end if;
  perform 1 from jsonb_array_elements(j -> 'events') e
    where e ->> 'id' = current_setting('mx.e_ev1') and (e ->> 'ends_at') is not null;
  if not found then raise exception 'MATRIX FAIL 8d: ends_at not carried'; end if;
  perform 1 from jsonb_array_elements(j -> 'events') e
    where e ->> 'id' = current_setting('mx.e_cxl') and e ->> 'status' = 'cancelled';
  if not found then raise exception 'MATRIX FAIL 8e: cancelled tombstone missing'; end if;
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_brd');
  if not found then raise exception 'MATRIX FAIL 8f: explicit-group event missing'; end if;
  -- OUT: hidden (despite RSVP), out-of-window (despite RSVP), other groups,
  --      un-RSVP'd Everyone
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_hid');
  if found then raise exception 'MATRIX FAIL 8g: hidden event served'; end if;
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_old');
  if found then raise exception 'MATRIX FAIL 8h: out-of-window event served'; end if;
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_prv');
  if found then raise exception 'MATRIX FAIL 8i: another group''s event served'; end if;
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_past');
  if found then raise exception 'MATRIX FAIL 8j: un-RSVP''d Everyone event served'; end if;
  -- payload carries ONLY the minimized keys (spec §6.2: no bodies, no names)
  perform 1 from jsonb_array_elements(j -> 'events') e
    where exists (select 1 from jsonb_object_keys(e) k
                   where k not in ('id','title','starts_at','ends_at','location','status','created_at'));
  if found then raise exception 'MATRIX FAIL 8k: payload leaks extra keys'; end if;
  -- exact content and ORDER (invariant 7 — ascending is load-bearing):
  -- aida's personal feed is exactly [e_cxl +2d, e_brd +5d, e_ev1 +7d]
  if jsonb_array_length(j -> 'events') <> 3 then
    raise exception 'MATRIX FAIL 8l: expected exactly 3 events, got %', jsonb_array_length(j -> 'events'); end if;
  if (j -> 'events' -> 0 ->> 'id') <> current_setting('mx.e_cxl')
     or (j -> 'events' -> 1 ->> 'id') <> current_setting('mx.e_brd')
     or (j -> 'events' -> 2 ->> 'id') <> current_setting('mx.e_ev1') then
    raise exception 'MATRIX FAIL 8m: events not in ascending starts_at order'; end if;
  -- (the 500-row cap itself is impractical to seed; direction is pinned by
  -- the migration's order-by comments and this ordering assertion)
end $$;

-- == 11  last_fetched_at stamped (C-G3) ======================================
do $$ begin
  if (select last_fetched_at from calendar_feeds
       where id = current_setting('mx.feed_aida')::uuid) is null then
    raise exception 'MATRIX FAIL 11: last_fetched_at not stamped';
  end if;
end $$;

-- == 14  Everyone group feed = the community calendar ========================
set local role service_role;
select set_config('mx.pay_all', public.calendar_feed_payload(current_setting('mx.tok_aida_all'))::text, true);
reset role;
do $$ declare j jsonb := current_setting('mx.pay_all')::jsonb; begin
  if (j ->> 'ok') is distinct from 'true' then raise exception 'MATRIX FAIL 14a: everyone feed not ok'; end if;
  if j ->> 'cal_name' <> 'Steppe — Everyone' then
    raise exception 'MATRIX FAIL 14b: cal_name = %', j ->> 'cal_name'; end if;
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_past');
  if not found then raise exception 'MATRIX FAIL 14c: in-window past event missing'; end if;
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_hid');
  if found then raise exception 'MATRIX FAIL 14d: hidden event served'; end if;
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_brd');
  if found then raise exception 'MATRIX FAIL 14e: board event leaked into Everyone feed'; end if;
end $$;

-- == 9  standing collapse: frank leaves dryrun-private =======================
set local role service_role;
select set_config('mx.pay_frank1', public.calendar_feed_payload(current_setting('mx.tok_frank'))::text, true);
reset role;
do $$ declare j jsonb := current_setting('mx.pay_frank1')::jsonb; begin
  perform 1 from jsonb_array_elements(j -> 'events') e where e ->> 'id' = current_setting('mx.e_prv');
  if not found then raise exception 'MATRIX FAIL 9a: member''s own group event missing'; end if;
end $$;
-- frank leaves (leave_group deletes the row; owner mirrors that here —
-- claims cleared first so no lingering sub can trip a profile guard)
select set_config('request.jwt.claims', '', true);
delete from group_members
 where group_id = current_setting('mx.private')::uuid
   and user_id = current_setting('mx.frank')::uuid;
set local role service_role;
select set_config('mx.pay_frank2', public.calendar_feed_payload(current_setting('mx.tok_frank'))::text, true),
       set_config('mx.pay_frank_prv', public.calendar_feed_payload(current_setting('mx.tok_frank_prv'))::text, true);
reset role;
do $$
declare
  p jsonb := current_setting('mx.pay_frank2')::jsonb;
  g jsonb := current_setting('mx.pay_frank_prv')::jsonb;
begin
  -- personal: feed STILL ALIVE but selectively empty — frank has no other
  -- groups and no Everyone RSVPs, so this pins BOTH the ev_read-mirror
  -- exclusion AND that group-leave doesn't over-collapse the whole feed
  -- (and exercises the coalesce-to-'[]' empty branch).
  if (p ->> 'ok') is distinct from 'true' then
    raise exception 'MATRIX FAIL 9b-1: personal feed died on group-leave (over-broad collapse)'; end if;
  if p -> 'events' <> '[]'::jsonb then
    raise exception 'MATRIX FAIL 9b-2: rsvp''d-but-left event still served: %', p -> 'events'; end if;
  -- the group feed itself is dead, indistinguishable from absent
  if g <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 9c: left-group feed not the bare dead object'; end if;
end $$;

-- == 10  bogus / malformed / rotated-away tokens =============================
-- Full equality: dead states return the bare {"ok": false} — anything more
-- is a revocation oracle (spec §7.3).
set local role service_role;
do $$ begin
  if public.calendar_feed_payload(repeat('e', 64)) <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 10a: bogus token not the bare dead object'; end if;
  if public.calendar_feed_payload('SHORT') <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 10b: malformed token not the bare dead object'; end if;
  if public.calendar_feed_payload(null) is distinct from '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 10c: null token not the bare dead object'; end if;
  if public.calendar_feed_payload(current_setting('mx.tok_aida')) <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 10d: rotated-away token still serves'; end if;
end $$;
reset role;

-- == 12  payload is service_role-only, even for the feed's owner ============
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.aida'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform public.calendar_feed_payload(current_setting('mx.tok_aida2'));
  raise exception 'MATRIX FAIL 12: owner called payload directly';
exception when insufficient_privilege then null; end $$;
reset role;

-- == 12b  archived group: feed dies, mint refused ============================
select set_config('request.jwt.claims', '', true);
update groups set archived_at = now() where id = current_setting('mx.curated')::uuid;
set local role service_role;
do $$ begin
  if public.calendar_feed_payload(current_setting('mx.tok_carla_crt')) <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 12b-1: archived group feed not the bare dead object'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.carla'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform * from public.mint_calendar_feed(current_setting('mx.curated')::uuid);
  raise exception 'MATRIX FAIL 12b-2: minted for an archived group';
exception when sqlstate 'P0001' then
  if sqlerrm like 'MATRIX FAIL%' or sqlerrm not like '%archived%' then raise; end if;
end $$;
reset role;

-- == 13  member status collapse: unverified owner's feeds ALL die ============
-- (claims cleared so guard_profile_columns can't freeze the owner write)
select set_config('request.jwt.claims', '', true);
update profiles set verified = false where id = current_setting('mx.aida')::uuid;
set local role service_role;
do $$ begin
  if public.calendar_feed_payload(current_setting('mx.tok_aida2')) <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 13a: unverified member''s personal feed serves'; end if;
  if public.calendar_feed_payload(current_setting('mx.tok_aida_brd')) <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 13b: unverified member''s group feed serves'; end if;
  -- the Everyone feed's ONLY standing check is the profiles gate — pin it too
  if public.calendar_feed_payload(current_setting('mx.tok_aida_all')) <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 13c: unverified member''s Everyone feed serves'; end if;
end $$;
reset role;

-- == 15  deleted accounts (LAST — destructive to aida and frank) =============
-- 15a: the deleted_at half of the serve gate, isolated (verified restored)
select set_config('request.jwt.claims', '', true);
update profiles set verified = true, deleted_at = now()
 where id = current_setting('mx.aida')::uuid;
set local role service_role;
do $$ begin
  if public.calendar_feed_payload(current_setting('mx.tok_aida2')) <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 15a: deleted member''s feed serves'; end if;
end $$;
reset role;

-- 15b: delete_my_account() purges the member's feeds (0020 amendment) and no
-- longer aborts on the consents append-only trigger (the repaired 0009 bug —
-- frank holds a consent row from setup, so the old body would raise here).
select set_config('request.jwt.claims', json_build_object('sub', current_setting('mx.frank'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.delete_my_account();
reset role;
select set_config('request.jwt.claims', '', true);
do $$ declare n int; begin
  select count(*) into n from calendar_feeds
   where token in (current_setting('mx.tok_frank'), current_setting('mx.tok_frank_prv'));
  if n <> 0 then raise exception 'MATRIX FAIL 15b: % bearer tokens survived account deletion', n; end if;
  if not exists (select 1 from consents c where c.user_id = current_setting('mx.frank')::uuid) then
    raise exception 'MATRIX FAIL 15c: consent record erased (append-only, invariant 6)'; end if;
end $$;
set local role service_role;
do $$ begin
  if public.calendar_feed_payload(current_setting('mx.tok_frank')) <> '{"ok": false}'::jsonb then
    raise exception 'MATRIX FAIL 15d: deleted account''s token still serves'; end if;
end $$;
reset role;

select 'MATRIX 0020 GREEN — all cases passed' as verdict;

rollback;
