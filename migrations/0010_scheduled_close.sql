-- ============================================================================
-- Migration 0010 — scheduled proposal close  (Part 4: resolve the stub)
-- ----------------------------------------------------------------------------
-- Resolves the long-standing "scheduled close" stub (schema NOTES). A proposal's
-- result is determined by the voters + the clock; recording the close just stamps
-- that determined outcome into the permanent log. Leaving it to a moderator click
-- meant the official `proposal.closed` record could be missing indefinitely if no
-- one remembered. A scheduled job records it reliably.
--
-- Invariant 5 (human in the loop on consequence) is intact: the cron does NOT
-- decide anything — the governance OUTCOME is the voters' tally, and the threshold
-- isn't even evaluated here. Automation only *records* a clock-determined event,
-- which is exactly the "surface/record, never decide" line. The moderator path
-- (recordProposalClose) remains as a manual override and is idempotent — whichever
-- fires first writes the audit once (the trigger only fires on open -> closed).
--
-- Requires the pg_cron extension. On Supabase: enable it in
--   Dashboard > Database > Extensions  (or run the create extension below).
-- Safe to re-run: cron.schedule upserts a job of the same name.
-- ============================================================================

create extension if not exists pg_cron;

-- Close every open proposal whose voting window has passed. Per row, the
-- trg_log_proposal_closed trigger writes the aggregate audit entry (actor null =
-- closed on schedule, not by a person; the breakdown is still withheld below
-- MIN_TURNOUT). Returns how many it closed. Definer so it runs past RLS in cron.
create or replace function public.close_due_proposals()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with closed as (
    update proposals set status = 'closed'
     where status = 'open' and now() > closes_at
    returning 1
  )
  select count(*) into v_count from closed;
  return v_count;
end; $$;

-- Internal primitive — only the scheduled job (owner context) should call it.
revoke execute on function public.close_due_proposals() from public, anon, authenticated;

-- Run every 5 minutes. A proposal closes within ~5 min of its deadline; results
-- were already visible by time the instant the window passed (proposal_results is
-- gated on now() > closes_at), so this only adds the official record, never the
-- visibility.
select cron.schedule('close-due-proposals', '*/5 * * * *',
  $$ select public.close_due_proposals(); $$);
