-- Owner-applied after 0048; deploy cast_ballot caller in the same release.
begin;
create or replace function public.snapshot_proposal_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.created_at := statement_timestamp();
  if new.kind = 'immutable'
     and new.opens_at < new.created_at + interval '30 days' then
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

create or replace function public.guard_proposal_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.created_at := old.created_at;
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

create function steppe_security_private.write_proposal_outcome(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  proposal public.proposals;
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
 select * into proposal from public.proposals where id=p_id for update;
 if not found or proposal.status<>'closed' or now()<=proposal.closes_at then return; end if;
 if exists(select 1 from public.audit_log where entity='proposal' and entity_id=p_id
  and action='proposal.closed' and created_at>proposal.closes_at and metadata ? 'outcome') then return; end if;
  select count(*),
         coalesce(sum(case when choice = 'yes' then weight end), 0),
         coalesce(sum(case when choice = 'no' then weight end), 0),
         coalesce(sum(case when choice = 'abstain' then weight end), 0)
    into v_ballots, v_yes, v_no, v_abstain
    from public.votes
   where proposal_id = proposal.id;

  v_required := greatest(
    proposal.privacy_floor,
    ceil(proposal.electorate_size * proposal.quorum_fraction)::integer
  );
  v_quorum_met := v_ballots >= v_required;
  v_approval_ratio := case
    when v_ballots >= proposal.privacy_floor and v_yes + v_no > 0
      then v_yes / (v_yes + v_no)
  end;
  v_outcome := case
    when not v_quorum_met then 'insufficient_turnout'
    when v_approval_ratio is null then 'failed'
    when proposal.kind = 'minor' and v_approval_ratio > proposal.approval_fraction then 'passed'
    when proposal.kind <> 'minor' and v_approval_ratio >= proposal.approval_fraction then 'passed'
    else 'failed'
  end;

  v_metadata := jsonb_build_object(
    'ballots', v_ballots,
    'revealed', v_ballots >= proposal.privacy_floor,
    'electorate_size', proposal.electorate_size,
    'required_ballots', v_required,
    'quorum_met', v_quorum_met,
    'approval_fraction', proposal.approval_fraction,
    'rules_version', proposal.rules_version,
    'outcome', v_outcome
  );

  if v_ballots >= proposal.privacy_floor then
    v_metadata := v_metadata || jsonb_build_object(
      'yes_weight', v_yes,
      'no_weight', v_no,
      'abstain_weight', v_abstain,
      'approval_ratio', v_approval_ratio
    );
  end if;

  perform public.log_audit('proposal.closed', 'proposal', proposal.id, v_metadata);
end; $$;
revoke all on function steppe_security_private.write_proposal_outcome(uuid) from public,anon,authenticated;
create or replace function public.log_proposal_closed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if now()<=new.closes_at then
  perform public.log_audit('proposal.closed','proposal',new.id,jsonb_build_object('results_pending',true));
 else perform steppe_security_private.write_proposal_outcome(new.id);
 end if;
 return new;
end; $$;
create or replace function public.close_due_proposals() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer; p uuid;
begin
 update public.proposals set status='closed' where status='open' and now()>closes_at;
 get diagnostics n=row_count;
 for p in select id from public.proposals where status='closed' and now()>closes_at
 and not exists(select 1 from public.audit_log a where a.entity='proposal' and a.entity_id=proposals.id
 and a.action='proposal.closed' and a.created_at>proposals.closes_at and a.metadata ? 'outcome') loop
  perform steppe_security_private.write_proposal_outcome(p);
 end loop;
 return n;
end; $$;
create function public.finalize_proposal_outcome(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_moderator() then raise exception 'moderator required' using errcode='42501'; end if;
 perform steppe_security_private.write_proposal_outcome(p_id);
end; $$;
revoke all on function public.finalize_proposal_outcome(uuid) from public,anon;
grant execute on function public.finalize_proposal_outcome(uuid) to authenticated;

create or replace function public.guard_votes_immutable()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'votes are immutable: a ballot cannot be deleted'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.proposal_id is distinct from old.proposal_id then
    raise exception 'ballot proposal is immutable' using errcode='42501';
  end if;
  if not exists (select 1 from proposals pr
                 where pr.id = new.proposal_id and pr.status = 'open'
                   and now() between pr.opens_at and pr.closes_at) then
    raise exception 'votes are immutable once the proposal is closed (proposal %)', new.proposal_id
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;
-- RLS remains authoritative; the invoker RPC allows only choice revisions.
revoke update on public.votes from authenticated;
grant update(choice) on public.votes to authenticated;
create function public.cast_ballot(p_proposal uuid,p_choice public.vote_choice) returns void
language sql security invoker set search_path=public,pg_temp as $$
 insert into public.votes(proposal_id,user_id,choice) values(p_proposal,auth.uid(),p_choice)
 on conflict(proposal_id,user_id) do update set choice=excluded.choice;
$$;
revoke all on function public.cast_ballot(uuid,public.vote_choice) from public,anon;
grant execute on function public.cast_ballot(uuid,public.vote_choice) to authenticated;
notify pgrst,'reload schema';
commit;
