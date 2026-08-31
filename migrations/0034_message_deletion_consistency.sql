-- ============================================================================
-- Migration 0034 — message deletion consistency
-- ----------------------------------------------------------------------------
-- Supersedes M-G2's 2026-07-13 “bodies survive” choice. The current public and
-- legal copy promises meaningful account deletion, and the founder has resolved
-- the conflict in favor of deletion rather than retaining a counterpart copy.
--
-- On account deletion:
--   * every message authored by the departing member is deleted;
--   * a thread is deleted only when no messages remain (counterpart-authored
--     messages remain that counterpart's content);
--   * private thread state and blocks are purged as before;
--   * consent, ballot, moderation, and audit records stay attached only to the
--     scrubbed Former member tombstone where their integrity requires it.
--
-- Ordinary message rows remain immutable to clients: this adds no DELETE grant,
-- policy, or RPC for arbitrary message deletion. The only new deletion path is
-- the self-pinned delete_my_account() transaction.
--
-- Apply BY HAND as owner after 0033. Not folded into schema.sql (baseline 0015).
-- Safe to re-run.
-- ============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be signed in to delete your account';
  end if;

  delete from public.member_blocks
   where blocker_id = v_uid or blocked_id = v_uid;

  -- Privacy resolution 2026-08-29: the sender controls their words at exit.
  delete from public.messages where sender_id = v_uid;

  -- Preserve the other participant's authored content, but do not retain an
  -- empty relationship shell. Deleting an empty thread cascades its state rows.
  delete from public.threads t
   where (t.member_a = v_uid or t.member_b = v_uid)
     and not exists (
       select 1 from public.messages m where m.thread_id = t.id
     );

  delete from public.thread_state where member_id = v_uid;
  delete from public.reports where reporter_id = v_uid;
  delete from public.calendar_feeds where member_id = v_uid;
  delete from public.event_rsvps where user_id = v_uid;
  delete from public.events where creator_id = v_uid;
  delete from public.verifications where user_id = v_uid;
  delete from public.neighborhood_requests where user_id = v_uid;
  -- Consents and secret ballots remain immutable records. Neither is exposed as
  -- a named member record after the profile and auth identity are scrubbed.

  update public.appeals
     set body = '[removed when the member deleted their account]'
   where user_id = v_uid;

  update public.profiles
     set display_name = 'Former member',
         neighborhood_id = null,
         locale = 'en',
         deleted_at = now()
   where id = v_uid;

  perform public.log_audit('account.deleted', 'profile', v_uid,
    jsonb_build_object('sent_messages_deleted', true));
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Self-pinned account deletion (0034): deletes the caller''s sent messages and empty threads, purges private state, and scrubs the profile while preserving integrity-required append-only records.';
