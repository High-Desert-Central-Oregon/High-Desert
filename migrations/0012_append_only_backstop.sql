-- ============================================================================
-- Migration 0012 — append-only immutability backstop, role-independent (in-DB)
-- ----------------------------------------------------------------------------
-- The append-only record (invariant 6) was enforced only by RLS (absent
-- UPDATE/DELETE policies) plus grant revocation. That stops the client roles —
-- `authenticated` via RLS, `anon`/`service_role` via missing DML grants — but NOT
-- a role that BYPASSES RLS: the table OWNER and any BYPASSRLS role (`service_role`,
-- `postgres`). A trigger fires regardless of `rolbypassrls`, so it is the only
-- backstop that binds EVERY role, owner included.
--
-- Three tables are TRULY append-only — no legitimate UPDATE/DELETE at all:
--   audit_log, consents, moderation_actions  →  hard block on UPDATE and DELETE.
--
-- votes is NOT strictly append-only: a ballot is REVISABLE WHILE THE PROPOSAL IS
-- OPEN (coercion-resistance — castVote upserts; vt_update gates it to while-open).
-- It is immutable-AFTER-close, revisable-while-open. So votes gets a tailored
-- guard:
--   • INSERT/UPDATE refused once the proposal is closed — no post-close stuffing
--     (an added ballot changes the tally just like an altered one), no post-close
--     revision. The while-open test MIRRORS the vt_insert/vt_update RLS predicate
--     EXACTLY (negated) so trigger and policy cannot drift at the window boundary.
--   • DELETE refused always — a ballot can never be withdrawn or erased.
--
-- TRUNCATE bypasses row triggers and RLS, and was still granted to
-- anon/service_role/authenticated — block it with a statement-level trigger on
-- all four tables and revoke the privilege as belt-and-suspenders.
--
-- INSERT stays open on the three append-only tables — the audit / consent /
-- moderation write path must keep recording, or the audit stops. Folded into
-- schema.sql. Safe to re-run.
--
-- NOTE (dev tooling): seed/dry-run-accounts.sql Section 0 tears down test data by
-- DELETEing from these tables; that is now refused on a populated DB (by design).
-- A clean slate comes from `supabase db reset` (drop & recreate), not row deletes.
-- ============================================================================

-- Hard refusal for any write that reaches it. Used for the three append-only
-- tables' UPDATE/DELETE, and for TRUNCATE on all four. References only TG_*, so
-- the same function serves both row-level and statement-level triggers.
create or replace function public.forbid_write()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'table "%" is append-only: % is not permitted', tg_table_name, tg_op
    using errcode = 'check_violation';
end; $$;

-- votes: immutable once the proposal is closed; a ballot can never be deleted.
-- SECURITY DEFINER so the proposals lookup is RLS-independent and gives every
-- caller (authenticated, service_role, owner) the same deterministic answer.
create or replace function public.guard_votes_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'votes are immutable: a ballot cannot be deleted'
      using errcode = 'check_violation';
  end if;
  -- INSERT/UPDATE allowed ONLY while the proposal is open — the EXACT vt_insert /
  -- vt_update while-open predicate, negated.
  if not exists (select 1 from proposals pr
                 where pr.id = new.proposal_id and pr.status = 'open'
                   and now() between pr.opens_at and pr.closes_at) then
    raise exception 'votes are immutable once the proposal is closed (proposal %)', new.proposal_id
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

-- Row-level append-only guards on the three truly-append-only tables (idempotent).
drop trigger if exists trg_append_only on audit_log;
create trigger trg_append_only before update or delete on audit_log
  for each row execute function public.forbid_write();

drop trigger if exists trg_append_only on consents;
create trigger trg_append_only before update or delete on consents
  for each row execute function public.forbid_write();

drop trigger if exists trg_append_only on moderation_actions;
create trigger trg_append_only before update or delete on moderation_actions
  for each row execute function public.forbid_write();

-- votes: tailored insert/update/delete guard.
drop trigger if exists trg_guard_votes_immutable on votes;
create trigger trg_guard_votes_immutable before insert or update or delete on votes
  for each row execute function public.guard_votes_immutable();

-- Statement-level TRUNCATE block on all four (truncate skips row triggers).
drop trigger if exists trg_no_truncate on audit_log;
create trigger trg_no_truncate before truncate on audit_log
  for each statement execute function public.forbid_write();

drop trigger if exists trg_no_truncate on consents;
create trigger trg_no_truncate before truncate on consents
  for each statement execute function public.forbid_write();

drop trigger if exists trg_no_truncate on moderation_actions;
create trigger trg_no_truncate before truncate on moderation_actions
  for each statement execute function public.forbid_write();

drop trigger if exists trg_no_truncate on votes;
create trigger trg_no_truncate before truncate on votes
  for each statement execute function public.forbid_write();

-- Belt-and-suspenders: revoke the TRUNCATE privilege itself.
revoke truncate on audit_log, consents, moderation_actions, votes
  from anon, authenticated, service_role;
