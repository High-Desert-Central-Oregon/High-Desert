-- ============================================================================
-- Migration 0001 — neighborhood_requests
-- ----------------------------------------------------------------------------
-- Adds the "none of the listed neighborhoods fit" queue (Step 5 follow-up).
-- Folded into schema.sql for fresh setups; this file is for a database that was
-- ALREADY created from an earlier schema.sql. Safe to re-run.
--
-- Rationale: see DECISIONS.md (2026-06-09). We model the "none fits" flag as its
-- own open/resolved queue (with an optional note) instead of a null
-- neighborhood_id, so we can tell members who actively flagged it apart from
-- members who simply haven't picked yet, and capture where uncovered residents
-- actually live.
-- ============================================================================

-- 1 · enum (create-if-absent)
do $$ begin
  create type neighborhood_request_status as enum ('open','resolved');
exception
  when duplicate_object then null;
end $$;

-- 2 · table + "one open request per member" guard
create table if not exists neighborhood_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  note        text,
  status      neighborhood_request_status not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id)
);
create unique index if not exists neighborhood_requests_one_open_per_user
  on neighborhood_requests (user_id) where (status = 'open');

-- 3 · triggers
-- Stamp who/when on resolution, server-side, regardless of how it was resolved.
create or replace function public.stamp_neighborhood_request_resolution()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
    new.resolved_by := coalesce(new.resolved_by, auth.uid());
  end if;
  return new;
end; $$;
drop trigger if exists trg_stamp_neighborhood_request on neighborhood_requests;
create trigger trg_stamp_neighborhood_request
  before update on neighborhood_requests
  for each row execute function public.stamp_neighborhood_request_resolution();

-- Auto-resolve a member's open request once they pick a neighborhood.
create or replace function public.resolve_open_neighborhood_requests()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.neighborhood_id is not null
     and new.neighborhood_id is distinct from old.neighborhood_id then
    update neighborhood_requests
       set status = 'resolved'
     where user_id = new.id and status = 'open';
  end if;
  return new;
end; $$;
drop trigger if exists trg_resolve_neighborhood_requests on profiles;
create trigger trg_resolve_neighborhood_requests
  after update of neighborhood_id on profiles
  for each row execute function public.resolve_open_neighborhood_requests();

-- 4 · RLS: member opens & reads own; moderators read all and resolve; no delete.
alter table neighborhood_requests enable row level security;

drop policy if exists nr_read on neighborhood_requests;
create policy nr_read   on neighborhood_requests for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());

drop policy if exists nr_insert on neighborhood_requests;
create policy nr_insert on neighborhood_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'open');

drop policy if exists nr_update on neighborhood_requests;
create policy nr_update on neighborhood_requests for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- 5 · grants (RLS still gates every row)
grant select, insert, update, delete on neighborhood_requests to authenticated;
