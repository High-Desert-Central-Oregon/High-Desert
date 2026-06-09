-- ============================================================================
-- Migration 0003 — proposal_results reveals on TIME alone  (Step 8, Part 1)
-- ----------------------------------------------------------------------------
-- Hardening of the secret-until-close invariant. Voting is gated on TIME (a
-- ballot is accepted only while now() is within [opens_at, closes_at]). The
-- results view previously revealed on `status = 'closed' OR now() > closes_at`,
-- so a `status = 'closed'` recorded before closes_at would have exposed a tally
-- while voting was still open — a secret-ballot break.
--
-- Fix: gate visibility on `now() > closes_at` ALONE. The clock — and only the
-- clock — ends a vote and reveals its result. The moderator's official-close
-- record (recordProposalClose) becomes purely an audit/status action and can
-- never move the reveal earlier. (That action is also guarded to refuse closing
-- before closes_at, so the two agree.)
--
-- Safe to re-run.
-- ============================================================================
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
group by p.id;
