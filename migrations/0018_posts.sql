-- ============================================================================
-- Migration 0018 — the Exchange: posts + events.group_id
-- ----------------------------------------------------------------------------
-- Implements docs/spec/exchange-x1-spec-v1.md §5, as approved 2026-07-12
-- (DECISIONS.md: G-1 pin ships audit-logged; G-2 members-only; G-4
-- post-moderation; G-6 moderator vocabulary), hardened by a four-lens
-- adversarial review (2026-07-12). Idempotent; manual apply only (SQL editor
-- as owner), like 0013/0017. Safe to apply BEFORE the Exchange UI deploys:
-- event creation keeps working through the window (see the defaulting
-- trigger below).
--
-- WHAT IT ADDS
--   • post_category enum — the bundle's fixed six (need/offer/event/aid/job/
--     goods; spec §1.1). Deliberately NOT the 0013 categories table: that
--     taxonomy classifies groups, this enum classifies speech acts.
--   • posts — group-scoped (group_id NOT NULL; the Everyone system row is the
--     community board), author-owned, category-marked, ≤1 pin per board
--     (partial unique index).
--   • events.group_id — backfilled to Everyone (behavior-preserving), NOT
--     NULL with a BEFORE INSERT trigger that defaults a missing group_id to
--     Everyone, so the pre-0018 app keeps creating events until the UI ships
--     (defines the deploy-order error out of existence). Events read/insert
--     policies move to is_group_member() (equivalent for Everyone rows,
--     group-scoped thereafter — G8).
--
-- TRUST MECHANICS (invariant 2: server sets trust, never the client)
--   • REVOKE-then-GRANT, always. Stock Supabase default privileges grant ALL
--     on new tables to anon/authenticated — column grants are additive and
--     would NOT narrow that. The revoke below makes the privilege state
--     deterministic on any provisioning vintage and on every re-apply.
--   • Pin columns (pinned_at/pinned_by), edited_at, and created_at are simply
--     not grantable to clients — no INSERT/UPDATE privilege exists on them.
--     set_post_pin() (SECURITY DEFINER, self-guarding) is the pin's only
--     writer and audit-logs every real transition (G13). This is a deliberate
--     mechanism upgrade over the spec's §5.3 freeze-on-self-edit trigger
--     sketch, which had a hole: a moderator pinning their OWN post is a
--     self-edit — the guard would have silently stripped the pin.
--   • guard_post_columns still freezes group_id / author_id / created_at on
--     every UPDATE path (belt for the grants; re-homing a post across groups
--     would leak members-only content — G12) and stamps edited_at only when
--     member-editable content actually changed (a pin never marks a post
--     "edited").
--   • Events get the same two-layer treatment: trg_guard_event_columns
--     freezes group_id / creator_id / created_at, AND the events INSERT/
--     UPDATE grants are narrowed to the member-editable columns (the old
--     blanket update grant let a client attempt creator reassignment and
--     left the G12 freeze resting on the trigger alone).
--   • NOTE for app authors: with column-level grants, a payload containing
--     any ungranted column fails loudly (42501) instead of being silently
--     coerced like the trigger-guarded tables. Server actions must send
--     exactly the granted columns. (.insert().select() still works — SELECT
--     stays table-level.)
--
-- MODERATION (G-4 post-moderation; P7 legible removal)
--   • No status column. Removal/restore rides moderation_actions +
--     is_content_hidden() with target_type 'post' (free text — no enum
--     change; schema.sql:160).
--   • DB-AUTHORITATIVE hiding: po_read excludes removed posts for ordinary
--     members — in a members-only group the content removal exists to
--     suppress must not remain readable over REST. The AUTHOR and moderators
--     still read the row, so the detail page can show the legible removed
--     state + appeal path (P7) instead of a 404.
--   • Pinning refuses hidden posts, and moderators may UNPIN on any board
--     (never pin inside groups) — otherwise a removed pinned post would hold
--     a group's only pin slot hostage with no moderator remedy. Recorded for
--     the G-1 policy draft.
-- ============================================================================

-- 1 · The fixed post-category enum (spec §1.1 order).
do $$ begin
  create type post_category as enum ('need','offer','event','aid','job','goods');
exception when duplicate_object then null; end $$;

-- 2 · posts
create table if not exists posts (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id),        -- Everyone = the system row
  author_id       uuid not null references profiles(id) on delete cascade,
  category        post_category not null,
  title           text not null
                  check (length(btrim(title)) > 0 and char_length(title) <= 160),
  body            text not null
                  check (length(btrim(body)) > 0 and char_length(body) <= 4000),
  neighborhood_id uuid references neighborhoods(id),          -- null = "All of Redmond"
  pinned_at       timestamptz,                                -- set ONLY via set_post_pin()
  pinned_by       uuid references profiles(id),
  created_at      timestamptz not null default now(),
  edited_at       timestamptz                                 -- stamped by trigger, never client
);

comment on table posts is
  'Exchange posts (X1). Group-scoped speech: the Everyone system group is the community board. Chronological only (invariant 7); moderation via moderation_actions (P7); pin via set_post_pin() only.';
comment on column posts.pinned_at is
  'Moderator/maintainer pin (bundle: "Pinned by moderators"). Client-unwritable by privilege (revoke-then-grant below); set_post_pin() is the sole writer and audit-logs every real transition. One pin per board (partial unique index).';

create unique index if not exists posts_one_pin_per_board
  on posts (group_id) where pinned_at is not null;
create index if not exists posts_feed_idx on posts (group_id, created_at desc);

-- 3 · Guard trigger — identity columns frozen on every path; edited_at is
--     server-stamped only when member-editable content changed.
create or replace function public.guard_post_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.group_id   := old.group_id;
  new.author_id  := old.author_id;
  new.created_at := old.created_at;
  if (new.title, new.body, new.category, new.neighborhood_id)
     is distinct from
     (old.title, old.body, old.category, old.neighborhood_id) then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end; $$;
drop trigger if exists trg_guard_post_columns on posts;
create trigger trg_guard_post_columns
  before update on posts
  for each row execute function public.guard_post_columns();

-- 4 · RLS (spec §5.3; G-2: members-only — NO anon policy exists).
alter table posts enable row level security;

-- Read: your boards only (G8/G12; Everyone via the system-row special case).
-- Removed content is hidden AT THE DATABASE for ordinary members; the author
-- and moderators keep the row so removal stays legible + appealable (P7).
drop policy if exists po_read on posts;
create policy po_read on posts for select to authenticated
  using (public.is_group_member(group_id)
         and (not public.is_content_hidden('post', id)
              or author_id = auth.uid()
              or public.is_moderator()));

drop policy if exists po_insert on posts;
create policy po_insert on posts for insert to authenticated
  with check (public.is_verified()
              and author_id = auth.uid()
              and public.is_group_member(group_id));

drop policy if exists po_update on posts;
create policy po_update on posts for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Author self-delete only; moderators never quiet-delete (G4/P7 — removal is
-- the legible moderation_actions flow). Known, accepted gap: deleting your own
-- currently-pinned post frees the pin slot without a post.unpinned audit row.
drop policy if exists po_delete on posts;
create policy po_delete on posts for delete to authenticated
  using (author_id = auth.uid());

-- 5 · Privileges: deterministic REVOKE-then-GRANT. The trust columns
--     (pinned_*, edited_at, created_at, id) are simply not grantable.
revoke all on posts from public, anon, authenticated;
grant select, delete on posts to authenticated;
grant insert (group_id, author_id, category, title, body, neighborhood_id)
  on posts to authenticated;
grant update (title, body, category, neighborhood_id)
  on posts to authenticated;

-- 6 · The pin (G-1): self-guarding SECURITY DEFINER RPC. Authority:
--       PIN    — moderator on the Everyone board; that group's maintainer
--                elsewhere (G9; platform moderators do NOT pin inside groups).
--       UNPIN  — the same, PLUS any moderator on any board: a removed pinned
--                post must never hold a board's single pin slot hostage.
--     Refuses hidden posts and no-op transitions, so every audit row is a
--     real state change (invariant 6: the log is the permanent record).
create or replace function public.set_post_pin(p_post uuid, p_pin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_group    uuid;
  v_everyone boolean;
  v_pinned   timestamptz;
begin
  select p.group_id, (g.is_system and g.slug = 'everyone'), p.pinned_at
    into v_group, v_everyone, v_pinned
    from posts p join groups g on g.id = p.group_id
   where p.id = p_post;
  if v_group is null then
    raise exception 'no such post';
  end if;

  if p_pin then
    if v_everyone then
      if not public.is_moderator() then
        raise exception 'only a moderator may pin on the community board';
      end if;
    elsif not public.is_group_maintainer(v_group) then
      raise exception 'only this group''s maintainer may pin here';
    end if;
    if v_pinned is not null then
      raise exception 'this post is already pinned';
    end if;
    if public.is_content_hidden('post', p_post) then
      raise exception 'a removed post can''t be pinned';
    end if;
    begin
      update posts set pinned_at = now(), pinned_by = auth.uid() where id = p_post;
    exception when unique_violation then
      raise exception 'another post is already pinned on this board — unpin it first';
    end;
    perform public.log_audit('post.pinned', 'post', p_post,
      jsonb_build_object('group_id', v_group));
  else
    if not (public.is_moderator()
            or (not v_everyone and public.is_group_maintainer(v_group))) then
      raise exception 'only a moderator or this group''s maintainer may unpin here';
    end if;
    if v_pinned is null then
      raise exception 'this post is not pinned';
    end if;
    update posts set pinned_at = null, pinned_by = null where id = p_post;
    perform public.log_audit('post.unpinned', 'post', p_post,
      jsonb_build_object('group_id', v_group));
  end if;
end; $$;
-- Self-guarding RPC: public EXECUTE stays (the gate is inside; auth.uid() is
-- null for anon, so every authority check fails), like decide_verification.

-- 7 · events.group_id — backfill to Everyone (behavior-preserving), NOT NULL
--     with a defaulting trigger so pre-0018 app builds keep creating events.
alter table events add column if not exists group_id uuid references groups(id);

do $$
declare
  v_everyone uuid;
  v_rows     int;
begin
  select id into v_everyone from groups where slug = 'everyone' and is_system;
  if v_everyone is null then
    raise exception 'Everyone system group missing — run migration 0013 first.';
  end if;
  update events set group_id = v_everyone where group_id is null;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    perform public.log_audit('events.group_id_backfill', 'group', v_everyone,
      jsonb_build_object('migration', '0018', 'rows', v_rows));
  end if;
end $$;

-- Inserts that don't name a board land on Everyone — the pre-0018 meaning of
-- "an event". Keeps the live app working between apply and the X1 deploy.
create or replace function public.default_event_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is null then
    select id into new.group_id from groups where is_system and slug = 'everyone';
  end if;
  return new;
end; $$;
drop trigger if exists trg_default_event_group on events;
create trigger trg_default_event_group
  before insert on events
  for each row execute function public.default_event_group();

alter table events alter column group_id set not null;
comment on column events.group_id is
  'Home board: the Everyone system group = community-wide (the pre-0018 behavior; a null insert defaults here); otherwise the owning group''s calendar (spec §6.4). Frozen after insert (trg_guard_event_columns — re-homing leaks members-only content, G12).';

-- Read/insert follow the same membership scoping as posts. For Everyone rows
-- is_group_member() ≡ is_verified(), so today's behavior is preserved exactly.
drop policy if exists ev_read on events;
create policy ev_read on events for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists ev_insert on events;
create policy ev_insert on events for insert to authenticated
  with check (public.is_verified()
              and creator_id = auth.uid()
              and public.is_group_member(group_id));

-- Freeze events' identity columns (creator reassignment was never legitimate;
-- group re-homing becomes a leak once group calendars exist)…
create or replace function public.guard_event_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.group_id   := old.group_id;
  new.creator_id := old.creator_id;
  new.created_at := old.created_at;
  return new;
end; $$;
drop trigger if exists trg_guard_event_columns on events;
create trigger trg_guard_event_columns
  before update on events
  for each row execute function public.guard_event_columns();

-- …and match the posts posture at the privilege layer: the old blanket
-- INSERT/UPDATE grants let clients ATTEMPT identity writes (trigger-coerced);
-- now the columns aren't grantable at all. group_id stays insertable (the X1
-- app targets a board; RLS validates membership) — never updatable.
revoke insert, update on events from public, anon, authenticated;
grant insert (creator_id, group_id, neighborhood_id, title, body, starts_at,
              location, capacity)
  on events to authenticated;
grant update (title, body, starts_at, location, capacity, status,
              neighborhood_id)
  on events to authenticated;
