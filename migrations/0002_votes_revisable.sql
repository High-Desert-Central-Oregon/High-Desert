-- ============================================================================
-- Migration 0002 — votes revisable while open  (Step 7, Part 3)
-- ----------------------------------------------------------------------------
-- Narrowly amends the votes write rules: a member may overwrite THEIR OWN ballot
-- while the proposal is open; at close the ballot freezes permanently. One row
-- per member (the unique constraint is unchanged), secret (a member reads only
-- their own ballot; no one reads anyone else's), and the weight is ALWAYS derived
-- server-side from tenure — the client never sends a weight.
--
-- Rationale + scope of the amendment to invariant 6: see DECISIONS.md
-- (2026-06-09). The append-only audit log is untouched; this is scoped to the
-- live ballot row, which becomes immutable the moment the proposal closes.
--
-- Folded into schema.sql for fresh setups; apply this to a DB already created
-- from an earlier schema.sql. Safe to re-run.
-- ============================================================================

-- 1 · Re-pin voter id + tenure weight on INSERT *and* UPDATE, so the stored
--     weight always reflects the effective (final) ballot. The client can never
--     supply either column.
create or replace function public.set_vote_weight()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.weight  := coalesce(public.vote_weight_for(auth.uid()), 1.0);
  return new;
end; $$;
drop trigger if exists trg_set_vote_weight on votes;
create trigger trg_set_vote_weight
  before insert or update on votes
  for each row execute function public.set_vote_weight();

-- 2 · SELECT — a member may read ONLY their own ballot. No other member and no
--     moderator can read it; aggregates come from proposal_results (closed-only).
drop policy if exists vt_select on votes;
create policy vt_select on votes for select to authenticated
  using (user_id = auth.uid());

-- 3 · INSERT — cast a first ballot while the proposal is open. The old
--     "not already voted" clause is removed (it blocked the upsert's insert
--     probe); the unique constraint remains the hard one-row guarantee, and a
--     re-vote now flows through UPDATE below.
drop policy if exists vt_insert on votes;
create policy vt_insert on votes for insert to authenticated
  with check (
    public.is_verified()
    and user_id = auth.uid()
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
  );

-- 4 · UPDATE — revise your OWN ballot, ONLY while the proposal is open. After
--     close (by time or by a moderator marking it closed) the predicate is false,
--     so the ballot can never change again. There is deliberately no DELETE
--     policy, so a ballot can't be withdrawn either.
drop policy if exists vt_update on votes;
create policy vt_update on votes for update to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
  );
