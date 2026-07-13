-- ============================================================================
-- Migration 0021 — member reports intake (M1 Part 1; the X1 fast-follow)
--
-- docs/spec/messages-m1-spec-v1.md §2, as ratified 2026-07-13 (DECISIONS.md):
-- the member-initiated report path ships BEFORE any messaging surface — the
-- abuse valve arrives ahead of the channel. This migration covers the X1
-- debt (posts/events); 0022 extends target_type to message threads and adds
-- the consent-based quoted_excerpt column (spec §6.4).
--
-- Doctrine:
--   · Reports are INTAKE, not permanent record. The permanent record is
--     moderation_actions (append-only, 0012); a report is a member's private
--     note to the moderators and is deletable with the member (purge-on-
--     delete below). Humans decide consequence (invariant 5): a report never
--     hides, ranks, or flags content by itself — a moderator reads it, acts
--     through the existing remove/restore flow, then resolves it.
--   · NO ORACLE at the moment of FILING: the member's confirmation is
--     identical regardless of duplicates, prior reports, or the target's
--     moderation state. (A reporter MAY later re-read their own report and
--     its resolution — outcome + resolver — via the data export; that is
--     consistent with this system's named-moderator posture, where
--     moderation_actions.actor_id is public. They never see other reports or
--     other reporters.)
--   · Resolution is audited (log_audit 'report.resolved', metadata = the
--     outcome enum alongside the uuids — the log_moderation reason precedent,
--     schema.sql:464; G13); filing is NOT audited (private member speech,
--     not a consequence).
--
-- Apply BY HAND in the SQL editor as the project owner (the stop-gate
-- convention). Safe to re-run. Local dry-run: seed/matrix-0021.sql.
-- ============================================================================

-- ---- 1 · reports ------------------------------------------------------------

create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references profiles(id),  -- no cascade: profile is a tombstone;
  target_type  text not null,                          -- purge is explicit (below)
  target_id    uuid not null,
  body         text not null
    constraint reports_body_bounds
    check (btrim(body) <> '' and char_length(body) <= 2000),
  created_at   timestamptz not null default now(),
  resolved_by  uuid references profiles(id),
  resolved_at  timestamptz,
  outcome      text,
  -- 0022 widens this to include 'message_thread'; named so it can be altered.
  constraint reports_target_type_allowed
    check (target_type in ('post','event')),
  constraint reports_outcome_allowed
    check (outcome in ('actioned','dismissed')),
  -- Resolution is all-or-nothing: by+at+outcome together or not at all.
  constraint reports_resolution_whole
    check (((resolved_by is null)::int
          + (resolved_at is null)::int
          + (outcome is null)::int) in (0, 3))
);

comment on table reports is
  'Member report intake (messages-m1-spec §2): a verified member''s private note to the moderators about content they can read. Intake, not permanent record — resolved through resolve_report(); purged with the reporter''s account. 0022 adds message-thread targets + the consent-based quoted excerpt.';

create index if not exists reports_open_idx
  on reports (created_at) where resolved_at is null;

-- ---- 2 · RLS + privileges (revoke-then-grant determinism) -------------------

alter table reports enable row level security;

-- A reporter re-reads their OWN reports (they join the data export);
-- moderators read all. Nobody else sees anything.
drop policy if exists rp_read on reports;
create policy rp_read on reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());

-- Filing: verified members, own identity pinned, and the target must be
-- readable BY THE REPORTER — the subqueries run under the reporter''s own
-- RLS (po_read / ev_read), so cross-board probing is refused without this
-- table learning anything about the target''s existence.
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
    )
  );

-- NO update or delete policies: members cannot edit or retract a filed
-- report (moderators may already be acting on it); resolution goes through
-- resolve_report(); the only deletion is the account purge below.

revoke all on reports from public, anon, authenticated;
grant select on reports to authenticated;
grant insert (reporter_id, target_type, target_id, body)
  on reports to authenticated;
-- resolved_by / resolved_at / outcome / created_at are not client-writable
-- at any layer: resolution state is server truth.

-- ---- 3 · resolve_report -----------------------------------------------------
-- The moderator's close-out. Acting on the CONTENT stays in the existing
-- remove/restore flow (moderation_actions); this only records that a human
-- looked and decided, and audits that fact (uuid metadata only).

create or replace function public.resolve_report(p_report uuid, p_outcome text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can resolve reports';
  end if;
  if p_outcome not in ('actioned', 'dismissed') then
    raise exception 'Outcome must be actioned or dismissed';
  end if;

  update reports
     set resolved_by = auth.uid(),
         resolved_at = now(),
         outcome     = p_outcome
   where id = p_report and resolved_at is null;
  if not found then
    raise exception 'Report not found or already resolved';
  end if;

  perform public.log_audit('report.resolved', 'report', p_report,
                           jsonb_build_object('outcome', p_outcome));
end; $$;

revoke all on function public.resolve_report(uuid, text) from public, anon;
grant execute on function public.resolve_report(uuid, text) to authenticated;

-- ---- 4 · delete_my_account: purge the member's reports ----------------------
-- Reports are the reporter''s private speech (intake), so they leave with the
-- account — the purge-on-delete convention (0020). Reports RESOLVED BY a
-- departing moderator are kept: resolution is accountability metadata and the
-- resolver renders as the ''Former member'' tombstone. Body otherwise
-- identical to the 0020 version (which repaired the 0012 consents conflict).

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be signed in to delete your account';
  end if;

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
grant execute on function public.delete_my_account() to authenticated;
