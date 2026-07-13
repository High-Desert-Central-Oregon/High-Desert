-- ============================================================================
-- Migration 0022 — member messages (M1)
--
-- docs/spec/messages-m1-spec-v1.md §3, as ratified 2026-07-13 (DECISIONS.md):
-- DMs only · one thread per pair · context-anchored starts · text-only ·
-- plaintext-with-RLS under the THREE RATIFICATION CONDITIONS:
--
--   1. ZERO-READ PIN. No policy below grants any non-participant SELECT on
--      threads, messages, thread_state, or member_blocks. Moderators and
--      admins are ordinary members here — there is deliberately NO
--      is_moderator() term anywhere in this file. The matrix and the test
--      suite pin this behaviorally (a moderator persona reads nothing).
--   2. The honest Terms paragraph ships with the UI (M1 Part 5).
--   3. The full E2E costing lives in DECISIONS.md (2026-07-13).
--
-- Further doctrine, per the same record:
--   · NO ORACLE: every "can't reach them" refusal — blocked either way,
--     counterpart deleted or unverified — is the SAME message. Context
--     failures share ONE structural message (no readability probe).
--   · SILENT BLOCK (M-G3): blocking notifies no one and is not audited.
--   · NO AUDIT ROWS anywhere in this file (M-G6): message metadata in a
--     moderator-readable log would be a relationship graph. The permanent
--     record meets messages only through the reports path (0021/0022), on
--     the participant's own quoted excerpt.
--   · IMMUTABLE MESSAGES: no UPDATE or DELETE exists for message rows at
--     any layer — no grant, no policy, no RPC. Privilege determinism IS the
--     guard (there is nothing to trigger-guard when nothing is writable).
--   · M-G2 (bodies survive): account deletion purges the leaver's private
--     STATE (thread_state, blocks) and tombstones their identity; message
--     bodies remain in the counterpart's thread. delete_my_account below.
--
-- Apply BY HAND in the SQL editor as the project owner, AFTER 0021 (this
-- file alters the reports table). Safe to re-run. Local dry-run:
-- seed/matrix-0022.sql.
-- ============================================================================

-- ---- 1 · threads ------------------------------------------------------------

create table if not exists threads (
  id             uuid primary key default gen_random_uuid(),
  member_a       uuid not null references profiles(id),   -- canonical: a < b
  member_b       uuid not null references profiles(id),
  started_by     uuid not null references profiles(id),   -- rate-cap accounting only
  about_post_id  uuid references posts(id) on delete set null,  -- the "Re:" anchor
  created_at     timestamptz not null default now(),
  constraint threads_pair_ordered   check (member_a < member_b),
  constraint threads_starter_inside check (started_by in (member_a, member_b)),
  unique (member_a, member_b)
);

-- NO about_event_id: the event "Message the host" door is DEFERRED ENTIRELY
-- (M-G5, DECISIONS.md 2026-07-13) — the counterpart there is a group that
-- can't answer, and messaging the event creator's personal inbox would
-- misrepresent who is listening. M1 starts are POST-ANCHORED only; the event
-- door (and its column) arrive with the v2 §5 group counterparts, not as
-- dormant schema capacity a UI author could quietly wire up.
comment on table threads is
  'M1 conversations (messages-m1-spec §3): ONE thread per member pair (the bundle''s one-store law, :1693/:1699), anchored to the FIRST contact''s POST — the anchor is never overwritten and quietly drops if the post goes (on delete set null). Event anchors are M-G5-deferred (post-anchored starts only). Participant-only at every layer; the zero-read pin (DECISIONS 2026-07-13) means no moderator read exists.';

create index if not exists threads_rate_idx on threads (started_by, created_at);
create index if not exists threads_member_b_idx on threads (member_b);

-- ---- 2 · thread_state -------------------------------------------------------

create table if not exists thread_state (
  thread_id    uuid not null references threads(id) on delete cascade,
  member_id    uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz,
  muted_at     timestamptz,
  left_at      timestamptz,
  primary key (thread_id, member_id)
);

comment on table thread_state is
  'Per-member private thread state: the read cursor (the unread dot''s only input), mute (dot suppression), and leave-as-archive (hidden from the inbox until a newer message arrives — reversible, no re-entry ceremony). Own-row RLS; purged with the account.';

-- ---- 3 · messages -----------------------------------------------------------

create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references threads(id) on delete cascade,
  -- NO cascade on sender: messages are co-owned (M-G2) — a future hard
  -- delete of a profile must never silently empty the counterpart's inbox.
  sender_id  uuid not null references profiles(id),
  body       text not null
    constraint messages_body_bounds
    check (btrim(body) <> '' and char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

comment on table messages is
  'M1 message rows — IMMUTABLE (no update/delete at any layer; edit windows and per-message deletion are deferred until the reports pipeline matures, spec §3.1). Plaintext by the ratified M-G1 posture; participant-only reads; senders render through the profiles tombstone, so a deleted account shows ''Former member'' with its words intact.';

create index if not exists messages_thread_idx on messages (thread_id, created_at desc);

-- ---- 4 · member_blocks ------------------------------------------------------

create table if not exists member_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint member_blocks_not_self check (blocker_id <> blocked_id)
);

comment on table member_blocks is
  'Member-level blocks (M-G3: SILENT — no notification, no audit, invisible to the blocked member). A block in EITHER direction freezes the pair''s thread symmetrically; refusals are indistinguishable from a deleted counterpart (no oracle).';

-- ---- 5 · can_send — the reply gate ----------------------------------------
-- The gate for sending into an EXISTING thread (msg_insert): participant,
-- verified, no block either way, counterpart alive. (No left_at term: sending
-- into a thread you archived simply resurfaces it.) start_thread MIRRORS the
-- block + counterpart-alive checks inline rather than calling this — it can't,
-- because can_send resolves member_a/member_b from a thread row that doesn't
-- exist yet at start time. Keep the two in sync: any change to the block or
-- counterpart-alive predicate here must land in start_thread's §7 checks too.

create or replace function public.can_send(p_thread uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from threads t
     where t.id = p_thread
       and auth.uid() in (t.member_a, t.member_b)
       and public.is_verified()
       and not exists (select 1 from member_blocks bl
                        where (bl.blocker_id = t.member_a and bl.blocked_id = t.member_b)
                           or (bl.blocker_id = t.member_b and bl.blocked_id = t.member_a))
       and exists (select 1 from profiles p
                    where p.id = case when t.member_a = auth.uid()
                                      then t.member_b else t.member_a end
                      and p.verified and p.deleted_at is null)
  );
$$;

revoke all on function public.can_send(uuid) from public, anon;
grant execute on function public.can_send(uuid) to authenticated;

-- ---- 6 · RLS + privileges (revoke-then-grant determinism) -------------------

alter table threads       enable row level security;
alter table thread_state  enable row level security;
alter table messages      enable row level security;
alter table member_blocks enable row level security;

-- threads: participants read; nothing else, no writes (start_thread only).
drop policy if exists th_read on threads;
create policy th_read on threads for select to authenticated
  using (auth.uid() in (member_a, member_b));

-- thread_state: own row, read + the three state verbs.
drop policy if exists ts_read on thread_state;
create policy ts_read on thread_state for select to authenticated
  using (member_id = auth.uid());
drop policy if exists ts_update on thread_state;
create policy ts_update on thread_state for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- messages: participants read; verified participants send as themselves.
drop policy if exists msg_read on messages;
create policy msg_read on messages for select to authenticated
  using (exists (select 1 from threads t
                  where t.id = thread_id
                    and auth.uid() in (t.member_a, t.member_b)));
drop policy if exists msg_insert on messages;
create policy msg_insert on messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_send(thread_id));

-- member_blocks: the blocker's own rows, full stop.
drop policy if exists bl_read on member_blocks;
create policy bl_read on member_blocks for select to authenticated
  using (blocker_id = auth.uid());
drop policy if exists bl_insert on member_blocks;
create policy bl_insert on member_blocks for insert to authenticated
  with check (blocker_id = auth.uid() and public.is_verified());
drop policy if exists bl_delete on member_blocks;
create policy bl_delete on member_blocks for delete to authenticated
  using (blocker_id = auth.uid());

revoke all on threads, thread_state, messages, member_blocks
  from public, anon, authenticated;

grant select on threads to authenticated;
grant select on thread_state to authenticated;
grant update (last_read_at, muted_at, left_at) on thread_state to authenticated;
grant select on messages to authenticated;
grant insert (thread_id, sender_id, body) on messages to authenticated;
grant select on member_blocks to authenticated;
grant insert (blocker_id, blocked_id) on member_blocks to authenticated;
grant delete on member_blocks to authenticated;
-- Deliberately absent, at every layer: UPDATE/DELETE on messages and
-- threads; INSERT on threads/thread_state (start_thread only); any grant to
-- anon; created_at anywhere (chronology is server truth).

-- ---- 7 · start_thread -------------------------------------------------------
-- The only way a thread is born. POST-anchored (spec §5; the event door is
-- M-G5-deferred): a conversation starts from a POST the caller can read,
-- addressed to its author — the RPC cannot mint a cold DM.

create or replace function public.start_thread(
  p_with uuid, p_body text, p_about_post uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid := auth.uid();
  v_a      uuid;
  v_b      uuid;
  v_thread threads%rowtype;
  v_ok     boolean := false;
begin
  if v_me is null or not public.is_verified() then
    raise exception 'Only verified members can send messages';
  end if;
  if p_with = v_me then
    raise exception 'You cannot message yourself';
  end if;
  if btrim(coalesce(p_body, '')) = '' or char_length(p_body) > 4000 then
    raise exception 'Write a message first';
  end if;

  -- Context: a post readable by ME under my own RLS-equivalent scope, and
  -- authored by the addressee. ONE structural message for every failure mode
  -- (missing / bogus / unreadable / wrong-author / hidden) — this path is not
  -- a readability probe.
  if p_about_post is not null then
    select exists (
      select 1 from posts po
       where po.id = p_about_post and po.author_id = p_with
         and public.is_group_member(po.group_id)
         and not public.is_content_hidden('post', po.id)
    ) into v_ok;
  end if;
  if not v_ok then
    raise exception 'A conversation starts from one of their posts';
  end if;

  -- Reachability — blocked either way, deleted, or unverified counterpart:
  -- ONE message, no oracle.
  if exists (select 1 from member_blocks bl
              where (bl.blocker_id = v_me and bl.blocked_id = p_with)
                 or (bl.blocker_id = p_with and bl.blocked_id = v_me))
     or not exists (select 1 from profiles p
                     where p.id = p_with and p.verified and p.deleted_at is null)
  then
    raise exception 'This neighbor can''t be reached right now';
  end if;

  v_a := least(v_me, p_with);
  v_b := greatest(v_me, p_with);

  select * into v_thread from threads t
   where t.member_a = v_a and t.member_b = v_b;
  if not found then
    -- Rate valve (M-G7: provisional config, cohort-ratifiable): at most 10
    -- NEW conversations per member per rolling day. A cap, never a score —
    -- and only on NEW pairs: re-contacting an existing thread is a reply,
    -- not a new conversation.
    if (select count(*) from threads t
         where t.started_by = v_me
           and t.created_at > now() - interval '24 hours') >= 10 then
      raise exception 'That''s plenty of new conversations for one day — try again tomorrow';
    end if;
    begin
      insert into threads (member_a, member_b, started_by, about_post_id)
      values (v_a, v_b, v_me, p_about_post)
      returning * into v_thread;
      insert into thread_state (thread_id, member_id)
      values (v_thread.id, v_a), (v_thread.id, v_b);
    exception when unique_violation then
      -- Lost the pair race; the winner's thread is THE thread (its anchor
      -- stands — never overwritten, :1699). Raise if somehow still absent.
      select * into v_thread from threads t
       where t.member_a = v_a and t.member_b = v_b;
      if not found then raise; end if;
    end;
  end if;

  insert into messages (thread_id, sender_id, body)
  values (v_thread.id, v_me, p_body);
  update thread_state set last_read_at = now(), left_at = null
   where thread_id = v_thread.id and member_id = v_me;

  return v_thread.id;
end; $$;

revoke all on function public.start_thread(uuid, text, uuid) from public, anon;
grant execute on function public.start_thread(uuid, text, uuid) to authenticated;

-- ---- 8 · reports: message-thread targets + the consent-based excerpt --------
-- (0021 shipped posts/events; spec §6.4.) The quoted excerpt is the
-- REPORTER''S OWN view of their conversation, attached by them — the only
-- door message content has into moderation, and it lives on the report row,
-- never as access to the thread.

alter table reports add column if not exists quoted_excerpt text;

do $$ begin
  alter table reports add constraint reports_excerpt_bounds
    check (quoted_excerpt is null or char_length(quoted_excerpt) <= 4000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table reports add constraint reports_excerpt_scope
    check (quoted_excerpt is null or target_type = 'message_thread');
exception when duplicate_object then null; end $$;

alter table reports drop constraint if exists reports_target_type_allowed;
alter table reports add constraint reports_target_type_allowed
  check (target_type in ('post', 'event', 'message_thread'));

comment on column reports.quoted_excerpt is
  'Message-thread reports only: the reporter''s own quoted view of the conversation (consent-based disclosure, messages-m1-spec §6.4). Moderators read THIS, never the thread — the zero-read pin stands.';

drop policy if exists rp_insert on reports;
create policy rp_insert on reports for insert to authenticated
  with check (
    public.is_verified()
    and reporter_id = auth.uid()
    and (
      (target_type = 'post'
        and exists (select 1 from posts p where p.id = target_id))
      or (target_type = 'event'
        and exists (select 1 from events e where e.id = target_id))
      or (target_type = 'message_thread'
        and exists (select 1 from threads t
                     where t.id = target_id
                       and auth.uid() in (t.member_a, t.member_b)))
    )
  );

grant insert (quoted_excerpt) on reports to authenticated;

-- ---- 9 · delete_my_account: purge private state; bodies survive (M-G2) -----
-- Body carries 0021 forward exactly, adding the M1 purges. Messages and
-- threads are deliberately NOT deleted: the counterpart keeps their half of
-- the conversation; the leaver''s name resolves to the ''Former member''
-- tombstone everywhere it renders.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be signed in to delete your account';
  end if;

  delete from member_blocks         where blocker_id = v_uid or blocked_id = v_uid;  -- 0022
  delete from thread_state          where member_id  = v_uid;                        -- 0022
  -- messages + threads: KEPT (M-G2, signed 2026-07-13) — co-owned content;
  -- the sender tombstones to 'Former member'.
  delete from reports               where reporter_id = v_uid;  -- 0021: intake leaves with the reporter
  delete from calendar_feeds        where member_id = v_uid;    -- 0020: bearer tokens die with the account
  delete from event_rsvps           where user_id   = v_uid;
  delete from events                where creator_id = v_uid;   -- cascades their rsvps
  delete from verifications         where user_id   = v_uid;    -- evidence already purged on decision
  delete from neighborhood_requests where user_id   = v_uid;
  -- consents: KEPT (append-only permanent record, 0012/invariant 6).

  update appeals set body = '[removed when the member deleted their account]'
   where user_id = v_uid;

  update profiles set
      display_name    = 'Former member',
      neighborhood_id = null,
      locale          = 'en',
      deleted_at      = now()
   where id = v_uid;

  perform public.log_audit('account.deleted', 'profile', v_uid, '{}'::jsonb);
end; $$;
-- Convention parity with can_send/start_thread above (the 0020 privilege-
-- determinism lesson): close the default PUBLIC execute, then grant. The
-- body's auth.uid() null-guard already fails closed; this makes the ACL
-- explicit rather than inherited. (First revoke in the delete_my_account
-- chain — harmless standing cleanup.)
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
