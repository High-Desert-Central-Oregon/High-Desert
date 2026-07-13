-- ============================================================================
-- Migration 0020 — calendar feeds (C1) + events.ends_at
--
-- docs/spec/calendar-c1-spec-v1.md §5, as amended 2026-07-12 (DECISIONS.md):
--   · C-G1 — member-minted feeds ONLY. Every feed row is a verified member's
--     capability onto content that member can read, and it dies with their
--     standing (re-checked at serve time — fail closed, no cleanup job).
--     There is deliberately NO group-level/public feed here; that is a
--     drafted governance ballot, never a config flip (G-2 precedent).
--   · C-G3 — last_fetched_at is the member-visible leak detector: one
--     timestamp, overwritten in place, readable by the owner alone, never
--     aggregated, never an input to any ordering or optimization.
--   · C-G4 — the token is PLAINTEXT at rest, chosen on the record: readable
--     only by its owner (cf_read row scope + the column grant below); the
--     serving path is a service_role-only RPC. Hash-at-rest would defend
--     only a breach scoped to exactly this table while costing every lost
--     URL a rotation; it can be added later as an additive migration.
--   · ends_at — folded in per the same decision record (nullable; no
--     composer field yet; ICS layers emit DTEND when present).
--
-- Feeds are member-private operational state (like RSVPs), NOT part of the
-- permanent record: no audit rows, delete = revoke. They join the member's
-- data export (sans token). On account deletion they are PURGED by
-- delete_my_account() (amended below) — the profile row is a tombstone,
-- never hard-deleted, so the FK cascade alone would never fire; the cascade
-- stays as belt-and-braces for any future hard-delete path.
--
-- Apply BY HAND in the SQL editor as the project owner (the stop-gate
-- convention). Safe to re-run. Local dry-run: seed/matrix-0020.sql.
-- ============================================================================

-- ---- 0 · events.ends_at ----------------------------------------------------

alter table events add column if not exists ends_at timestamptz;

do $$ begin
  alter table events add constraint events_ends_after_start
    check (ends_at is null or ends_at > starts_at);
exception when duplicate_object then null; end $$;

comment on column events.ends_at is
  'Optional end instant (2026-07-12 decision record: folded into 0020). The ICS layers emit DTEND when present; the composer gains a field when durations matter to members. Must follow starts_at.';

-- 0018 narrowed events'' INSERT/UPDATE to explicit column lists; the new
-- column joins both (ordinary content, like starts_at). Column grants are
-- additive, so these extend the 0018 lists without restating them.
grant insert (ends_at) on events to authenticated;
grant update (ends_at) on events to authenticated;

-- ---- 1 · calendar_feeds -----------------------------------------------------

create table if not exists calendar_feeds (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references profiles(id) on delete cascade,
  group_id        uuid references groups(id) on delete cascade,  -- null = personal feed
  token           text not null unique,
  created_at      timestamptz not null default now(),
  rotated_at      timestamptz,
  last_fetched_at timestamptz
);

comment on table calendar_feeds is
  'C1 subscription feeds (calendar-c1-spec §5): each row is ONE member''s bearer capability — personal (group_id null: their RSVPs ∪ their groups) or one group''s schedule. Minted/rotated only via the RPCs below; standing is re-derived at serve time so feeds fail closed on unverification, group-leave, archival, and deletion.';
comment on column calendar_feeds.token is
  '256-bit capability secret, hex. PLAINTEXT AT REST by explicit decision (C-G4, DECISIONS.md 2026-07-12) — owner-readable so You can re-display the URL; unreachable by any other session (cf_read) and never selectable by anon.';
comment on column calendar_feeds.last_fetched_at is
  'Member-visible leak detector (C-G3): stamped by calendar_feed_payload() on every serve, shown to the owner on You, read by no one else, never aggregated.';

-- One feed per scope per member (partial unique indexes — the
-- posts_one_pin_per_board precedent; no PG15 NULLS NOT DISTINCT dependency).
create unique index if not exists calendar_feeds_one_personal
  on calendar_feeds (member_id) where group_id is null;
create unique index if not exists calendar_feeds_one_per_group
  on calendar_feeds (member_id, group_id) where group_id is not null;

-- Serving path: token lookup rides the unique index on token.

-- ---- 2 · RLS + privileges (revoke-then-grant determinism, the 0018 lesson) --

alter table calendar_feeds enable row level security;

drop policy if exists cf_read on calendar_feeds;
create policy cf_read on calendar_feeds for select to authenticated
  using (member_id = auth.uid());

drop policy if exists cf_delete on calendar_feeds;
create policy cf_delete on calendar_feeds for delete to authenticated
  using (member_id = auth.uid());

-- NO insert or update policies: mint/rotate go through the RPCs only — the
-- client never supplies or edits a token (invariant-2 shape).

-- Default ACLs vary by Supabase vintage (older stacks grant ALL on new
-- tables to anon/authenticated); revoke-then-grant lands the same final
-- state on every vintage. member_id is deliberately absent from the select
-- list (the owner knows who they are; no other session ever sees a row).
-- service_role keeps whatever blanket grant the stack gives it — the secret
-- key is server-only and calendar_feed_payload() is the sanctioned read path.
revoke all on calendar_feeds from public, anon, authenticated;
grant select (id, group_id, token, created_at, rotated_at, last_fetched_at)
  on calendar_feeds to authenticated;
grant delete on calendar_feeds to authenticated;

-- ---- 3 · mint_calendar_feed -------------------------------------------------
-- Verified members mint; group feeds require live membership (Everyone counts
-- via is_group_member''s system-row case). Idempotent: an existing feed for
-- the scope is returned as-is — re-tapping "Connect" never silently rotates.
-- The server generates the secret; the client never supplies one.

create or replace function public.mint_calendar_feed(p_group uuid default null)
returns table (feed_id uuid, feed_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_me  uuid := auth.uid();
  v_row public.calendar_feeds%rowtype;
begin
  if v_me is null or not public.is_verified() then
    raise exception 'Only verified members can create calendar links';
  end if;
  if p_group is not null then
    if exists (select 1 from groups g
                where g.id = p_group and g.archived_at is not null) then
      raise exception 'This group is archived';
    end if;
    if not public.is_group_member(p_group) then
      raise exception 'Only group members can create this calendar link';
    end if;
  end if;

  select * into v_row from calendar_feeds cf
   where cf.member_id = v_me and cf.group_id is not distinct from p_group;
  if not found then
    begin
      insert into calendar_feeds (member_id, group_id, token)
      values (v_me, p_group, encode(extensions.gen_random_bytes(32), 'hex'))
      returning * into v_row;
    exception when unique_violation then
      -- Lost a same-scope race; the winner's row is the feed. If the
      -- re-select finds nothing the violation wasn't the scope index (a
      -- cryptographically unreachable token/PK collision, or a snapshot
      -- above READ COMMITTED) — surface it rather than return nulls.
      select * into v_row from calendar_feeds cf
       where cf.member_id = v_me and cf.group_id is not distinct from p_group;
      if not found then raise; end if;
    end;
  end if;

  feed_id := v_row.id;
  feed_token := v_row.token;
  return next;
end; $$;

revoke all on function public.mint_calendar_feed(uuid) from public, anon;
grant execute on function public.mint_calendar_feed(uuid) to authenticated;

-- ---- 4 · rotate_calendar_feed -----------------------------------------------
-- Owner-only. The old token is dead the instant this commits; connected apps
-- stop updating until the member pastes the new URL (the UI says so).

create or replace function public.rotate_calendar_feed(p_feed uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  update calendar_feeds
     set token = encode(extensions.gen_random_bytes(32), 'hex'),
         rotated_at = now()
   where id = p_feed and member_id = auth.uid()
  returning token into v_token;
  if v_token is null then
    raise exception 'Not your calendar link';
  end if;
  return v_token;
end; $$;

revoke all on function public.rotate_calendar_feed(uuid) from public, anon;
grant execute on function public.rotate_calendar_feed(uuid) to authenticated;

-- ---- 5 · calendar_feed_payload — the serving read ---------------------------
-- service_role ONLY (the 0015 increment_qr_count posture): not even
-- authenticated may call it; the /cal/[token] route handler is the single
-- caller. SECURITY DEFINER bypasses RLS, so the checks in this body ARE the
-- policy — and there is no auth context here (calendar apps poll with no
-- credentials), so the owner''s standing is re-derived from v_feed.member_id.
-- auth.uid()-based helpers (is_verified, is_group_member) would answer for
-- nobody and MUST NOT appear below; is_content_hidden is auth-independent
-- and safe.
--
-- The scope must grant exactly what ev_read would grant the owner''s own
-- session, intersected with the feed''s scope — never more:
--   personal: events of groups they explicitly belong to (Everyone is
--             implicit and never materialized, so it enters ONLY via RSVP)
--             ∪ RSVP''d Everyone-board events. An RSVP''d event in a group
--             they LEFT is excluded — mirroring ev_read.
--   group:    that group''s events, served only while the owner is an active
--             member (Everyone feed: while verified).
-- Window: 30 days back through all future, ascending, hard cap 500 (spec
-- §6.2). Cancelled events stay in (STATUS:CANCELLED downstream) so
-- subscribed apps update instead of silently dropping; moderator-hidden
-- events are out entirely. Returns {ok:false} for absent/revoked/dead feeds
-- — all indistinguishable (no revocation oracle).

create or replace function public.calendar_feed_payload(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_feed        public.calendar_feeds%rowtype;
  v_group       public.groups%rowtype;
  v_name        text;
  v_events      jsonb;
  v_group_ids   uuid[];
  v_everyone_id uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_feed from calendar_feeds where token = p_token;
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  -- The owner must still be a verified, undeleted member.
  if not exists (select 1 from profiles p
                  where p.id = v_feed.member_id
                    and p.verified and p.deleted_at is null) then
    return jsonb_build_object('ok', false);
  end if;

  if v_feed.group_id is not null then
    -- GROUP FEED: the group must live and the owner must still belong.
    select * into v_group from groups g where g.id = v_feed.group_id;
    if not found or v_group.archived_at is not null then
      return jsonb_build_object('ok', false);
    end if;
    if not (v_group.is_system and v_group.slug = 'everyone')
       and not exists (select 1 from group_members gm
                        where gm.group_id = v_feed.group_id
                          and gm.user_id = v_feed.member_id
                          and gm.status = 'active') then
      return jsonb_build_object('ok', false);
    end if;

    v_name := 'Steppe — ' || v_group.name;
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', s.id, 'title', s.title,
             'starts_at', s.starts_at, 'ends_at', s.ends_at,
             'location', s.location, 'status', s.status,
             'created_at', s.created_at)
           order by s.starts_at, s.id), '[]'::jsonb)
      into v_events
      from (select e.* from events e
             where e.group_id = v_feed.group_id
               and e.starts_at >= now() - interval '30 days'
               and not public.is_content_hidden('event', e.id)
             -- Cap keeps the NEWEST 500 (spec §6.2: if it ever binds, the
             -- oldest-past rows drop first); the aggregate re-sorts ascending.
             order by e.starts_at desc, e.id desc
             limit 500) s;
  else
    -- PERSONAL FEED: explicit groups ∪ RSVP''d Everyone-board events.
    -- An archived group''s events keep flowing here while its dedicated
    -- group feed dies above — INTENDED asymmetry: the personal scope sits
    -- exactly at the ev_read bound (is_group_member has no archival test;
    -- an active member still reads those events in-app), while a group
    -- feed is a statement about the group and follows its lifecycle.
    select array_agg(gm.group_id) into v_group_ids
      from group_members gm
     where gm.user_id = v_feed.member_id and gm.status = 'active';
    select g.id into v_everyone_id
      from groups g where g.is_system and g.slug = 'everyone';

    v_name := 'Steppe — My calendar · Mi calendario';
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', s.id, 'title', s.title,
             'starts_at', s.starts_at, 'ends_at', s.ends_at,
             'location', s.location, 'status', s.status,
             'created_at', s.created_at)
           order by s.starts_at, s.id), '[]'::jsonb)
      into v_events
      from (select e.* from events e
             where e.starts_at >= now() - interval '30 days'
               and not public.is_content_hidden('event', e.id)
               and (e.group_id = any (coalesce(v_group_ids, '{}'))
                    or (e.group_id = v_everyone_id
                        and exists (select 1 from event_rsvps r
                                     where r.event_id = e.id
                                       and r.user_id = v_feed.member_id)))
             -- Cap keeps the NEWEST 500 (spec §6.2); aggregate re-sorts asc.
             order by e.starts_at desc, e.id desc
             limit 500) s;
  end if;

  -- Stamp the member-visible leak detector (C-G3).
  update calendar_feeds set last_fetched_at = now() where id = v_feed.id;

  return jsonb_build_object('ok', true, 'cal_name', v_name, 'events', v_events);
end; $$;

revoke all on function public.calendar_feed_payload(text) from public, anon, authenticated;
grant execute on function public.calendar_feed_payload(text) to service_role;

-- ---- 6 · delete_my_account: purge calendar feeds + repair 0012 conflict ---
-- Two changes to the 0009 body, both required:
--
-- (a) PURGE calendar_feeds. The deletion path TOMBSTONES the profile —
--     deleted_at is set, the row is never hard-deleted (a hard delete would
--     cascade votes and rewrite closed tallies) — so calendar_feeds'' ON
--     DELETE CASCADE would never fire on its own, and plaintext bearer
--     tokens would outlive the account in the table and its backups.
--     Delete = revoke: the member''s feeds go with them. (Serving already
--     fails closed on deleted_at; this removes the secrets themselves.)
--
-- (b) DROP the ''delete from consents'' line. ⚠ PRE-EXISTING LIVE BUG,
--     surfaced by this migration''s review: 0012 made consents append-only
--     for EVERY role (trg_append_only → check_violation), so the 0009 body
--     has aborted at that line ever since — account deletion is currently
--     broken in prod. The constitutional resolution (invariant 6): consent
--     records are permanent record and STAY, anchored to the scrubbed
--     ''Former member'' tombstone — exactly how votes and moderation records
--     are kept. The member-facing deletion copy never promised consent
--     erasure (account.deleteErased lists profile/RSVPs/events/verification/
--     neighborhood only).

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be signed in to delete your account';
  end if;

  delete from calendar_feeds        where member_id = v_uid;   -- 0020: bearer tokens die with the account
  delete from event_rsvps           where user_id   = v_uid;
  delete from events                where creator_id = v_uid;  -- cascades their rsvps
  delete from verifications         where user_id   = v_uid;   -- evidence already purged on decision
  delete from neighborhood_requests where user_id   = v_uid;
  -- consents: KEPT (append-only permanent record, 0012/invariant 6) — the
  -- 0009 delete here has been refused by trg_append_only since 0012 landed.

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
grant execute on function public.delete_my_account() to authenticated;
