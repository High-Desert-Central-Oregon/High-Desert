-- ============================================================================
-- Migration 0023 — profile field visibility (Y1) + four perf indexes — MANUAL APPLY
-- ----------------------------------------------------------------------------
-- Per docs/spec/profile-visibility-y1-spec-v1.md. Makes the code honor the live
-- /privacy promises cDH/cDB: "Your profile is private by default"; "Every field
-- starts hidden. You choose, one at a time, whether it's visible to no one or to
-- members." Today every public_profiles column is visible to every member always
-- — the exact inverse of the promise. This closes that gap for the one personal
-- field that exists (neighborhood), field-generically.
--
-- G-flags (pre-ruled by the owner):
--   G-Y1a  "hidden" = DB-unreadable by EVERYONE non-owner, MODERATORS INCLUDED
--          (M1/C1 zero-read precedent). Enforced below at the DB, not the UI.
--   G-Y1b  neighborhood defaults hidden. Proximity/verification read neighborhood
--          server-side from the VIEWER's own row and from CONTENT rows
--          (posts/events.neighborhood_id), NEVER the author's profile — audited
--          and confirmed, so hiding the profile field changes no ordering/gating.
--   G-Y1c  verified + role are CARVED OUT ("every field" = every *personal* field).
--          They are trust/accountability attributes (invite gating; moderators act
--          in the open) and stay always-visible in the view.
--
-- MECHANISM (spec §2.3–2.4 + G-Y1a):
--   1. Per-field visibility COLUMN on profiles — a two-value enum defaulting to
--      'hidden' (the promise, as a one-word default). Columns over a
--      profile_field_visibility table: the hideable set is small and known;
--      a table would force a LEFT JOIN + per-field CASE anyway, plus its own RLS
--      and a row-per-field write model — more surface, no gain at this size
--      (Ousterhout: don't add a mechanism the problem doesn't have). REVISIT the
--      table only if the profile grows to many optional fields; the extension
--      path here is one `add column` + one CASE line per future hideable field.
--   2. public_profiles VIEW gains a per-viewer CASE: neighborhood_id is emitted
--      only to the owner (id = auth.uid()) or when the owner set it to 'members';
--      otherwise NULL — the value never leaves the DB. auth.uid() resolves inside
--      the view regardless of view owner, so the per-viewer decision can't be
--      spoofed. This mirrors the tenure_start owner-rights pattern (rls-audit N1).
--   3. pf_read NARROWED to owner-only (id = auth.uid()). The owner-rights view
--      (which reads past base RLS) becomes the SINGLE cross-member read path for
--      members AND moderators, so the view's CASE binds moderators too — that is
--      G-Y1a. This is safe: the trust helpers (is_verified / is_moderator /
--      vote_weight_for) and the message reachability checks (can_send /
--      start_thread) are all SECURITY DEFINER and bypass RLS; the ONLY app reads
--      affected are three moderator name-lookups (review + moderation pages),
--      rerouted to public_profiles in the same change set. A member still reads
--      their own full row (id = auth.uid()); no owner path regresses.
--
-- delete / export (CLAUDE.md convention):
--   • Export (`account/export/route.ts`) reads profiles.select('*') on the owner's
--     own row, so neighborhood_visibility flows into the export automatically — no
--     change needed.
--   • delete_my_account() tombstones neighborhood_id → NULL, so the visibility
--     flag governs nothing on a deleted row (the CASE returns NULL regardless).
--     No PII is stored in the flag; delete_my_account is intentionally left
--     unchanged (nothing to purge, nothing to leak).
--
-- PLUS four perf indexes (docs/audits/perf-audit-v1.md §5) on DISJOINT tables
-- (events, moderation_actions, thread_state) — pure additive CREATE INDEX, no
-- column/RLS/trust change, batched here per the audit's "one review, one apply"
-- ruling (disjoint from the profiles change; zero interaction). PLAIN, not
-- CONCURRENTLY: the cohort is small, and CONCURRENTLY cannot run inside the
-- single rolled-back dry-run transaction (seed/matrix-0023.sql).
--
-- STUDIO-SAFE: pure SQL, no psql meta-commands. Prove first with
-- seed/matrix-0023.sql (one rolled-back transaction, writes nothing), then apply
-- BY HAND in the Supabase SQL editor as owner at the stop-gate — verify the
-- project-ref first. Record it in docs/migrations-applied.md once applied.
-- ============================================================================

-- 1 · per-field visibility column — default 'hidden' IS the promise ----------
alter table profiles
  add column if not exists neighborhood_visibility text not null default 'hidden'
    constraint profiles_neighborhood_visibility_chk
      check (neighborhood_visibility in ('hidden', 'members'));

-- 2 · public_profiles — per-viewer CASE withholds hidden fields at the DB edge
--     (owner or 'members' → value; otherwise NULL). display_name is the
--     always-public minimum; verified/role are the G-Y1c carve-out.
--     OWNER-RIGHTS view: security_invoker = false (the default; made EXPLICIT
--     here) so it reads PAST the narrowed base pf_read — that is precisely what
--     makes it the single cross-member read path, and the per-viewer CASE
--     (auth.uid()) is the access boundary. NB: this is `security_invoker`, NOT
--     the unrelated `security_barrier` predicate-pushdown option.
create or replace view public_profiles with (security_invoker = false) as
  select
    id,
    display_name,
    case when id = auth.uid() or neighborhood_visibility = 'members'
         then neighborhood_id end as neighborhood_id,
    verified,
    role
  from profiles;

-- 3 · pf_read narrowed to owner-only: the view is now the ONLY cross-member read
--     path (members AND moderators), so its CASE binds moderators (G-Y1a).
--     Moderators keep verified/role/display_name of others THROUGH the view.
drop policy if exists pf_read on profiles;
create policy pf_read on profiles for select to authenticated
  using (id = auth.uid());

-- 4 · perf indexes (perf-audit-v1 §5) — disjoint tables, additive only --------
create index if not exists events_group_created_idx
  on events (group_id, created_at desc);           -- Exchange events feed
create index if not exists events_status_starts_idx
  on events (status, starts_at);                   -- Upcoming agenda + month grid
create index if not exists moderation_actions_target_idx
  on moderation_actions (target_type, target_id, created_at desc);  -- is_content_hidden()
create index if not exists thread_state_member_idx
  on thread_state (member_id);                     -- unread dot / inbox
