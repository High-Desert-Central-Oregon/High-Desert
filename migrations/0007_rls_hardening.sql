-- ============================================================================
-- Migration 0007 — RLS hardening  (Step 10, Part 2)
-- ----------------------------------------------------------------------------
-- Closes G1–G5 from docs/rls-audit.md. Folded into schema.sql for fresh setups.
-- Safe to re-run.
-- ============================================================================

-- G1 · A vote may not be cast or changed on REMOVED (moderated) content. The
--      vote write path was the one place moderation state was UI-only, not
--      DB-authoritative. is_content_hidden() reports whether a target's LATEST
--      remove/restore action is a 'remove'.
create or replace function public.is_content_hidden(p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.action = 'remove'
       from moderation_actions m
      where m.target_type = p_type and m.target_id = p_id
        and m.action in ('remove','restore')
      order by m.created_at desc, m.id desc
      limit 1),
    false);
$$;

drop policy if exists vt_insert on votes;
create policy vt_insert on votes for insert to authenticated
  with check (
    public.is_verified()
    and user_id = auth.uid()
    and not public.is_content_hidden('proposal', proposal_id)
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
  );

drop policy if exists vt_update on votes;
create policy vt_update on votes for update to authenticated
  using (
    user_id = auth.uid()
    and not public.is_content_hidden('proposal', proposal_id)
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
  )
  with check (
    user_id = auth.uid()
    and not public.is_content_hidden('proposal', proposal_id)
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
  );

-- G1 (cont.) · a removed proposal must not surface results anywhere either.
create or replace view proposal_results as
select
  p.id as proposal_id, p.title, p.kind, p.status, p.closes_at,
  count(v.id)                                                       as ballots,
  coalesce(sum(case when v.choice='yes'     then v.weight end),0)   as yes_weight,
  coalesce(sum(case when v.choice='no'      then v.weight end),0)   as no_weight,
  coalesce(sum(case when v.choice='abstain' then v.weight end),0)   as abstain_weight
from proposals p
left join votes v on v.proposal_id = p.id
where now() > p.closes_at
  and not public.is_content_hidden('proposal', p.id)
group by p.id;

-- G2 · The two governance audit entries the app used to write via a direct
--      log_audit() RPC become DB triggers, so they're written on the actual state
--      change — un-forgeable and un-skippable — and log_audit() no longer needs to
--      be reachable from a client.
create or replace function public.log_proposal_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_audit('proposal.created', 'proposal', new.id,
                           jsonb_build_object('kind', new.kind));
  return null;
end; $$;
drop trigger if exists trg_log_proposal_created on proposals;
create trigger trg_log_proposal_created
  after insert on proposals
  for each row execute function public.log_proposal_created();

-- On the transition to 'closed', record the aggregate result (no per-ballot data).
create or replace function public.log_proposal_closed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ballots int; v_yes numeric; v_no numeric; v_abstain numeric;
begin
  select count(*),
         coalesce(sum(case when choice='yes'     then weight end), 0),
         coalesce(sum(case when choice='no'      then weight end), 0),
         coalesce(sum(case when choice='abstain' then weight end), 0)
    into v_ballots, v_yes, v_no, v_abstain
  from votes where proposal_id = new.id;

  perform public.log_audit('proposal.closed', 'proposal', new.id,
    jsonb_build_object('ballots', v_ballots, 'yes_weight', v_yes,
                       'no_weight', v_no, 'abstain_weight', v_abstain));
  return null;
end; $$;
drop trigger if exists trg_log_proposal_closed on proposals;
create trigger trg_log_proposal_closed
  after update of status on proposals
  for each row when (new.status = 'closed' and old.status is distinct from 'closed')
  execute function public.log_proposal_closed();

-- Now close the client door. log_audit() and vote_weight_for() are internal
-- primitives, only ever called from owner-context definer code (the triggers
-- above, decide_verification, resolve_appeal, set_vote_weight). Revoke the
-- default PUBLIC execute so a member can't invoke them directly as a PostgREST
-- RPC — log_audit would let anyone forge audit entries; vote_weight_for leaks any
-- member's weight. Owner-context callers run as the owner and keep EXECUTE.
revoke execute on function public.log_audit(text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.vote_weight_for(uuid) from public, anon, authenticated;

-- G3 · Verifications change ONLY through decide_verification() (definer, audited,
--      sets profiles.verified + tenure). The direct moderator UPDATE policy
--      allowed an unaudited, broken half-state; the RPC bypasses RLS, so it
--      doesn't need the policy.
drop policy if exists vf_update on verifications;

-- G4 · A moderator must not silently hard-delete an event — removal is the
--      legible, appealable moderateContent('remove') flow (P7). Creator
--      self-delete stays; the moderator clause is removed.
drop policy if exists ev_delete on events;
create policy ev_delete on events for delete to authenticated
  using (creator_id = auth.uid());

-- G5 · A proposal's voting window, threshold, and author are fixed at creation.
--      Freeze opens_at / closes_at / kind / author_id on UPDATE so a moderator
--      can't move the deadline (reveal early / reopen a closed vote), change the
--      threshold, or reassign authorship. status (to record a close) and content
--      stay editable — mirrors the profile trust-field guard.
create or replace function public.guard_proposal_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.opens_at  := old.opens_at;
  new.closes_at := old.closes_at;
  new.kind      := old.kind;
  new.author_id := old.author_id;
  return new;
end; $$;
drop trigger if exists trg_guard_proposal_columns on proposals;
create trigger trg_guard_proposal_columns
  before update on proposals
  for each row execute function public.guard_proposal_columns();
