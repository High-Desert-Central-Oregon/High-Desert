-- ============================================================================
-- Migration 0011 — tenure vote-weight: 1×–3× range  (Business Plan v11)
-- ----------------------------------------------------------------------------
-- Widens the tenure weighting from the prototype's 1.0 / 1.2 / 1.5× to Business
-- Plan v11's 1×–3× range, with four brackets by tenure age:
--   < 1 yr (or unset) → 1.0 · 1–2 yr → 1.5 · 2–4 yr → 2.0 · 4 yr+ → 3.0
--
-- Only the weighting FUNCTION changes — the brackets are config the function
-- carries (there is no separate config table), and the cohort ratifies them like
-- the other governance numbers (quorum, thresholds). The set_vote_weight trigger
-- already re-derives every ballot's weight from this function on insert AND
-- update, so future and revised ballots pick up the new scheme automatically.
-- votes.weight is numeric(3,1) — 3.0 fits.
--
-- Re-weighting ALREADY-CAST ballots: this changes weights only for ballots
-- (re)written after it runs. Run it before the cohort's first real vote opens so
-- no live ballot straddles the change; an open proposal mid-vote would otherwise
-- mix weighting schemes. Folded into schema.sql. Safe to re-run.
-- ============================================================================

create or replace function public.vote_weight_for(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when tenure_start is null                                  then 1.0
    when tenure_start > current_date - interval '1 year'       then 1.0   -- < 1 yr
    when tenure_start > current_date - interval '2 years'      then 1.5   -- 1–2 yr
    when tenure_start > current_date - interval '4 years'      then 2.0   -- 2–4 yr
    else 3.0                                                              -- 4 yr+
  end
  from profiles where id = p_user;
$$;
