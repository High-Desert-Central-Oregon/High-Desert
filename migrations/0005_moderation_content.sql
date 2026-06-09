-- ============================================================================
-- Migration 0005 — content moderation: required reason + current-state view
-- ----------------------------------------------------------------------------
-- Requires migration 0004 (the 'remove'/'restore' enum values) to be applied
-- first. Safe to re-run.
-- ============================================================================

-- No silent removal: a content moderation action MUST carry a written reason.
-- (NOT VALID skips the scan of preexisting rows; every new row is still checked.
--  No rows exist in the prototype, so this is effectively a full constraint.)
alter table moderation_actions
  drop constraint if exists moderation_reason_required;
alter table moderation_actions
  add constraint moderation_reason_required
  check (
    action not in ('remove','restore')
    or (reason is not null and length(btrim(reason)) > 0)
  ) not valid;

-- The CURRENT visibility of a piece of content is its LATEST remove/restore
-- action: 'remove' ⇒ hidden, 'restore' (or no action) ⇒ visible. The full
-- history stays in moderation_actions (append-only); this view just reads the
-- top of the stack so the app can ask "is this hidden, and why?" in one query.
create or replace view content_moderation as
select distinct on (target_type, target_id)
  id as action_id, target_type, target_id, action, reason, actor_id, created_at
from moderation_actions
where action in ('remove','restore')
order by target_type, target_id, created_at desc, id desc;

-- Member-visible (authenticated), consistent with moderation_actions' own read
-- policy. It exposes nothing not already readable there.
grant select on content_moderation to authenticated;
