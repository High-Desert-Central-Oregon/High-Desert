-- ============================================================================
-- Migration 0008 — privacy hardening  (pre-launch overhaul, Part 2)
-- ----------------------------------------------------------------------------
-- Settles the two deferred privacy decisions from docs/rls-audit.md:
--   • N1 — profile column over-exposure. Restrict the profile read to genuinely
--     public fields; keep tenure_start (a vote-weight tell) to the member + mods.
--   • N3 — governance results public to anon + small-N de-anonymisation. Gate
--     proposal_results to authenticated members, and withhold the weighted
--     breakdown until at least MIN_TURNOUT (5, provisional) distinct members vote.
-- Folded into schema.sql. Safe to re-run.
-- ============================================================================

-- N1 · A member's tenure_start lets anyone infer their vote-weight tier (1.0 /
--      1.2 / 1.5×), so it is NOT a public field. RLS is row-level, not column-
--      level, so we split the read:
--        • base `profiles` — readable only by the member themselves and mods
--          (full row, incl. tenure_start). The trust GUARD is untouched.
--        • `public_profiles` view — the genuinely public columns (display_name,
--          neighborhood, verified, role — moderator transparency is intended),
--          readable by any authenticated member. tenure_start is simply absent.
drop policy if exists pf_read on profiles;
create policy pf_read on profiles for select to authenticated
  using (id = auth.uid() or public.is_moderator());

-- Owner-rights view (security_invoker off): it reads past the base-table RLS to
-- expose EVERY member's public columns, but only those columns. Access is the
-- GRANT below (authenticated only; anon gets nothing).
create or replace view public_profiles as
  select id, display_name, neighborhood_id, verified, role
  from profiles;

revoke all on public_profiles from anon;
grant select on public_profiles to authenticated;

-- N3a · Governance results are for members, not the open internet. Drop the anon
--       read of the aggregate (the protected app is authenticated-only anyway).
-- N3b · Small-N de-anonymisation: with one or two ballots, a weighted breakdown
--       can reveal how an individual voted. Withhold the breakdown until at least
--       MIN_TURNOUT distinct members have voted. count(v.id) = distinct voters
--       (one row per member, enforced by the unique constraint).
--
--       MIN_TURNOUT = 5 is PROVISIONAL config for the cohort to ratify, alongside
--       the governance thresholds (quorum 20%, major 60%, immutable 75%). It sits
--       below quorum (20% of ~50 = 10), so it never hides a legitimately-decided
--       result — only very-low-turnout ones where the privacy risk is real.
drop view if exists proposal_results;
create view proposal_results as
with tally as (
  select
    p.id as proposal_id, p.title, p.kind, p.status, p.closes_at,
    count(v.id)                                                     as ballots,
    coalesce(sum(case when v.choice='yes'     then v.weight end),0) as yes_weight,
    coalesce(sum(case when v.choice='no'      then v.weight end),0) as no_weight,
    coalesce(sum(case when v.choice='abstain' then v.weight end),0) as abstain_weight
  from proposals p
  left join votes v on v.proposal_id = p.id
  where now() > p.closes_at                              -- secret until close (time-gated)
    and not public.is_content_hidden('proposal', p.id)  -- a removed proposal shows no result
  group by p.id
)
select
  proposal_id, title, kind, status, closes_at, ballots,
  (ballots >= 5) as revealed,   -- MIN_TURNOUT floor (provisional 5)
  case when ballots >= 5 then yes_weight     end as yes_weight,
  case when ballots >= 5 then no_weight      end as no_weight,
  case when ballots >= 5 then abstain_weight end as abstain_weight
from tally;

revoke all on proposal_results from anon;
grant select on proposal_results to authenticated;

-- The permanent close record in the audit log is the OTHER place the weighted
-- breakdown surfaces (members read audit_log). Apply the same floor there: always
-- record that the proposal closed and the turnout, but withhold the breakdown
-- below MIN_TURNOUT. (Quorum is 20%, so any decided result clears the floor.)
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

  if v_ballots >= 5 then   -- MIN_TURNOUT (provisional) — keep in step with the view
    perform public.log_audit('proposal.closed', 'proposal', new.id,
      jsonb_build_object('ballots', v_ballots, 'revealed', true,
                         'yes_weight', v_yes, 'no_weight', v_no,
                         'abstain_weight', v_abstain));
  else
    perform public.log_audit('proposal.closed', 'proposal', new.id,
      jsonb_build_object('ballots', v_ballots, 'revealed', false));
  end if;
  return null;
end; $$;
