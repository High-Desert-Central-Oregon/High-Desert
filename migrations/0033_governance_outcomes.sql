-- ============================================================================
-- Migration 0033 — binding governance outcomes
-- ----------------------------------------------------------------------------
-- Closes the governance gap identified in docs/audits/health-check-v1.md: the
-- app collected secret, tenure-weighted ballots but never snapshotted the
-- electorate, enforced the adopted notice/quorum/approval rules, or calculated
-- an authoritative passed/failed outcome.
--
-- Resolution (2026-08-29; docs/decisions/governance-outcomes.md):
--   * electorate = verified, non-deleted profiles when the proposal is created;
--   * ordinary: simple majority; major: 60%; foundational: 75%;
--   * major/foundational quorum = 15% of that snapshotted electorate;
--   * abstentions count as participating for quorum, but are not in the
--     yes/(yes+no) approval denominator;
--   * no proposal is binding below the existing five-ballot privacy floor;
--   * a foundational vote may not open until 30 days after publication.
--
-- The four rule fields are SERVER-SNAPSHOTTED by a BEFORE INSERT trigger and
-- frozen by the existing proposal goalpost guard. A future member-ratified rule
-- change therefore affects new proposals only; it cannot move an open vote's
-- goalposts or reinterpret a closed one.
--
-- proposal_results remains an owner-rights, verified-member-only aggregate view.
-- Per-ballot rows remain unreadable and the weighted breakdown remains hidden
-- below five ballots. This migration adds outcome metadata, not a ballot read.
--
-- Apply BY HAND as owner after 0031. Not folded into schema.sql: schema.sql is
-- the baseline through 0015. Safe to re-run.
-- ============================================================================

alter table public.proposals
  add column if not exists electorate_size integer,
  add column if not exists quorum_fraction numeric(4,3),
  add column if not exists approval_fraction numeric(4,3),
  add column if not exists privacy_floor integer,
  add column if not exists rules_version text;

-- Legacy proposals did not have a creation-time snapshot. Use the electorate at
-- migration time and label the snapshot so the historical limitation is visible.
update public.proposals
   set electorate_size = coalesce(
         electorate_size,
         (select count(*)::integer from public.profiles
           where verified and deleted_at is null)
       ),
       quorum_fraction = coalesce(
         quorum_fraction,
         case when kind = 'minor' then 0.000 else 0.150 end
       ),
       approval_fraction = coalesce(
         approval_fraction,
         case kind
           when 'minor' then 0.500
           when 'major' then 0.600
           else 0.750
         end
       ),
       privacy_floor = coalesce(privacy_floor, 5),
       rules_version = coalesce(rules_version, '2026-08-29-legacy-backfill');

alter table public.proposals
  alter column electorate_size set not null,
  alter column quorum_fraction set not null,
  alter column approval_fraction set not null,
  alter column privacy_floor set not null,
  alter column rules_version set not null;

alter table public.proposals
  drop constraint if exists proposals_electorate_nonnegative,
  drop constraint if exists proposals_quorum_fraction_range,
  drop constraint if exists proposals_approval_fraction_range,
  drop constraint if exists proposals_privacy_floor_positive;

alter table public.proposals
  add constraint proposals_electorate_nonnegative check (electorate_size >= 0),
  add constraint proposals_quorum_fraction_range
    check (quorum_fraction >= 0 and quorum_fraction <= 1),
  add constraint proposals_approval_fraction_range
    check (approval_fraction > 0 and approval_fraction <= 1),
  add constraint proposals_privacy_floor_positive check (privacy_floor >= 1);

comment on column public.proposals.electorate_size is
  'Verified, non-deleted members snapshotted when the proposal was created (0033).';
comment on column public.proposals.quorum_fraction is
  'Snapshotted participation fraction: 0 ordinary, 0.15 major/foundational (0033).';
comment on column public.proposals.approval_fraction is
  'Snapshotted yes/(yes+no) threshold: .50 ordinary, .60 major, .75 foundational (0033).';
comment on column public.proposals.privacy_floor is
  'Minimum ballots for a binding/revealed result; fixed at 5 by the 2026-08-29 resolution.';
comment on column public.proposals.rules_version is
  'Rule-set identifier snapshotted with the proposal so later changes are prospective.';

-- Client inserts cannot supply trustworthy governance rules. This trigger
-- overwrites every rule field and enforces the foundational notice period before
-- RLS evaluates the completed row. SECURITY DEFINER is necessary to count the
-- full electorate past profiles RLS; no client may call it directly.
create or replace function public.snapshot_proposal_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.kind = 'immutable'
     and new.opens_at < coalesce(new.created_at, now()) + interval '30 days' then
    raise exception 'foundational proposals require 30 days notice before voting opens'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer
    into new.electorate_size
    from public.profiles
   where verified and deleted_at is null;

  new.quorum_fraction := case when new.kind = 'minor' then 0.000 else 0.150 end;
  new.approval_fraction := case new.kind
    when 'minor' then 0.500
    when 'major' then 0.600
    else 0.750
  end;
  new.privacy_floor := 5;
  new.rules_version := '2026-08-29-v1';
  return new;
end;
$$;

revoke all on function public.snapshot_proposal_rules() from public, anon, authenticated;

drop trigger if exists trg_snapshot_proposal_rules on public.proposals;
create trigger trg_snapshot_proposal_rules
  before insert on public.proposals
  for each row execute function public.snapshot_proposal_rules();

-- Extend the existing goalpost guard. It intentionally preserves rather than
-- rejects fixed fields so the moderator's status-only close path stays simple.
create or replace function public.guard_proposal_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.opens_at         := old.opens_at;
  new.closes_at        := old.closes_at;
  new.kind             := old.kind;
  new.author_id        := old.author_id;
  new.electorate_size  := old.electorate_size;
  new.quorum_fraction  := old.quorum_fraction;
  new.approval_fraction := old.approval_fraction;
  new.privacy_floor    := old.privacy_floor;
  new.rules_version    := old.rules_version;
  return new;
end;
$$;

-- Changed view columns require a drop/create. Re-pin both the ACL and owner
-- rights here: dashboard advisor drift broke this view twice before 0030.
drop view if exists public.proposal_results;

create view public.proposal_results as
with tally as (
  select
    p.id as proposal_id,
    p.title,
    p.kind,
    p.status,
    p.closes_at,
    p.electorate_size,
    p.quorum_fraction,
    p.approval_fraction,
    p.privacy_floor,
    p.rules_version,
    greatest(
      p.privacy_floor,
      ceil(p.electorate_size * p.quorum_fraction)::integer
    ) as required_ballots,
    count(v.id) as ballots,
    coalesce(sum(case when v.choice = 'yes' then v.weight end), 0) as yes_weight,
    coalesce(sum(case when v.choice = 'no' then v.weight end), 0) as no_weight,
    coalesce(sum(case when v.choice = 'abstain' then v.weight end), 0) as abstain_weight
  from public.proposals p
  left join public.votes v on v.proposal_id = p.id
  where public.is_verified()
    and now() > p.closes_at
    and not public.is_content_hidden('proposal', p.id)
  group by p.id
), evaluated as (
  select
    tally.*,
    ballots >= privacy_floor as revealed,
    ballots >= required_ballots as quorum_met,
    case
      when ballots >= privacy_floor and yes_weight + no_weight > 0
        then yes_weight / (yes_weight + no_weight)
    end as approval_ratio
  from tally
)
select
  proposal_id,
  title,
  kind,
  status,
  closes_at,
  electorate_size,
  quorum_fraction,
  approval_fraction,
  privacy_floor,
  rules_version,
  required_ballots,
  ballots,
  revealed,
  quorum_met,
  case when revealed then approval_ratio end as approval_ratio,
  case
    when not quorum_met then 'insufficient_turnout'
    when approval_ratio is null then 'failed'
    when kind = 'minor' and approval_ratio > approval_fraction then 'passed'
    when kind <> 'minor' and approval_ratio >= approval_fraction then 'passed'
    else 'failed'
  end as outcome,
  case when revealed then yes_weight end as yes_weight,
  case when revealed then no_weight end as no_weight,
  case when revealed then abstain_weight end as abstain_weight
from evaluated;

alter view public.proposal_results set (security_invoker = false);
revoke all on public.proposal_results from public, anon, authenticated;
grant select on public.proposal_results to authenticated;

comment on view public.proposal_results is
  'Owner-rights, verified-member-only closed governance outcomes (0033). Electorate and rules are creation-time snapshots; abstentions count toward turnout, approval is weighted yes/(yes+no), and no result binds or reveals below five ballots.';

-- audit_log is also an owner transparency surface. Keep the complete community
-- record to verified members while preserving an unverified account's access to
-- its own rows for the member-owned export endpoint.
drop policy if exists al_read on public.audit_log;
create policy al_read on public.audit_log for select to authenticated
  using (public.is_verified() or actor_id = auth.uid());

-- The permanent close entry now records the same authoritative evaluation as
-- the view. It still never contains a per-ballot row and withholds all weighted
-- choices below the privacy floor.
create or replace function public.log_proposal_closed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ballots integer;
  v_yes numeric;
  v_no numeric;
  v_abstain numeric;
  v_required integer;
  v_quorum_met boolean;
  v_approval_ratio numeric;
  v_outcome text;
  v_metadata jsonb;
begin
  select count(*),
         coalesce(sum(case when choice = 'yes' then weight end), 0),
         coalesce(sum(case when choice = 'no' then weight end), 0),
         coalesce(sum(case when choice = 'abstain' then weight end), 0)
    into v_ballots, v_yes, v_no, v_abstain
    from public.votes
   where proposal_id = new.id;

  v_required := greatest(
    new.privacy_floor,
    ceil(new.electorate_size * new.quorum_fraction)::integer
  );
  v_quorum_met := v_ballots >= v_required;
  v_approval_ratio := case
    when v_ballots >= new.privacy_floor and v_yes + v_no > 0
      then v_yes / (v_yes + v_no)
  end;
  v_outcome := case
    when not v_quorum_met then 'insufficient_turnout'
    when v_approval_ratio is null then 'failed'
    when new.kind = 'minor' and v_approval_ratio > new.approval_fraction then 'passed'
    when new.kind <> 'minor' and v_approval_ratio >= new.approval_fraction then 'passed'
    else 'failed'
  end;

  v_metadata := jsonb_build_object(
    'ballots', v_ballots,
    'revealed', v_ballots >= new.privacy_floor,
    'electorate_size', new.electorate_size,
    'required_ballots', v_required,
    'quorum_met', v_quorum_met,
    'approval_fraction', new.approval_fraction,
    'rules_version', new.rules_version,
    'outcome', v_outcome
  );

  if v_ballots >= new.privacy_floor then
    v_metadata := v_metadata || jsonb_build_object(
      'yes_weight', v_yes,
      'no_weight', v_no,
      'abstain_weight', v_abstain,
      'approval_ratio', v_approval_ratio
    );
  end if;

  perform public.log_audit('proposal.closed', 'proposal', new.id, v_metadata);
  return null;
end;
$$;

revoke all on function public.log_proposal_closed() from public, anon, authenticated;
