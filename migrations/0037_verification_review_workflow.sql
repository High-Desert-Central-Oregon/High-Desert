-- Requires 0036. Deploy new review actions with this migration: final decisions
-- now require a recorded human choice and a server-confirmed storage purge.
begin;
alter table public.verifications
 add column review_state text not null default 'ready' check(review_state in ('ready','needs_information','finalizing','complete')),
 add column review_question text not null default '' check(length(review_question)<=1200),
 add column member_reply text not null default '' check(length(member_reply)<=1200),
 add column review_updated_at timestamptz not null default now(),
 add column review_revision integer not null default 0,
 add column decision_token uuid,
 add column decision_approve boolean,
 add column decision_by uuid references public.profiles(id) on delete set null,
 add column decision_message text not null default '' check(length(decision_message)<=1200),
 add column evidence_purged boolean not null default false;

create function public.guard_verification_intake() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is not null then
  if new.user_id<>auth.uid() or new.status<>'pending' then raise exception 'invalid applicant' using errcode='42501'; end if;
  perform 1 from public.profiles where id=auth.uid() and deleted_at is null and verified=false for share;
  if not found then raise exception 'inactive or already verified'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,37));
  if exists(select 1 from public.verifications where user_id=new.user_id and status='pending') then raise exception 'a request is already pending'; end if;
  if new.method not in ('id','utility_bill','voter_reg','property_record','postcard_code') then raise exception 'invalid method'; end if;
  if new.method='postcard_code' then new.evidence_path:=null;
  elsif new.evidence_path is null or new.evidence_path !~ ('^'||new.user_id::text||'/[0-9a-f-]{36}\.(jpg|png|webp|heic|pdf)$') then raise exception 'invalid evidence path'; end if;
 end if;
 new.review_state:='ready';new.review_question:='';new.member_reply:='';new.review_revision:=0;
 new.decision_token:=null;new.decision_approve:=null;new.decision_by:=null;new.decision_message:='';new.evidence_purged:=false;
 new.reviewed_by:=null;new.reviewed_at:=null;new.review_updated_at:=now();
 return new;
end; $$;
create trigger verification_intake_guard before insert on public.verifications for each row execute function public.guard_verification_intake();

create function public.queue_verification_notice(p_id uuid,p_kind text,p_recipient uuid,p_revision integer) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.member_notices where dedupe_key=p_id::text||':'||p_revision::text||':'||p_kind) then return; end if;
 -- A newer update supersedes queued notices for the same recipient. A final
 -- decision also cancels stale reviewer alerts; in-app state stays authoritative.
 update public.member_notices set state='cancelled' where verification_id=p_id and state='pending'
  and (p_kind='verification_decided' or recipient_id is not distinct from p_recipient);
 insert into public.member_notices(verification_id,recipient_id,kind,dedupe_key,locale)
 select v.id,p_recipient,p_kind,v.id::text||':'||p_revision::text||':'||p_kind,coalesce(p.locale,'en')
 from public.verifications v join public.profiles p on p.id=v.user_id where v.id=p_id
 on conflict(dedupe_key) do nothing;
end; $$;
revoke all on function public.queue_verification_notice(uuid,text,uuid,integer) from public,anon,authenticated;
create function public.notify_verification_received() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.queue_verification_notice(new.id,'verification_received',null,0);
 return new;
end; $$;
create trigger verification_received_notice after insert on public.verifications for each row execute function public.notify_verification_received();

create function public.request_verification_information(p_id uuid,p_question text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare row public.verifications;
begin
 if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_question is null or length(btrim(p_question))<5 or length(p_question)>1200 then raise exception 'a clear question is required'; end if;
 update public.verifications set review_state='needs_information',review_question=btrim(p_question),member_reply='',review_updated_at=now(),review_revision=review_revision+1
 where id=p_id and user_id<>auth.uid() and status='pending' and review_state<>'finalizing' returning * into row;
 if not found then raise exception 'request unavailable'; end if;
 perform public.queue_verification_notice(p_id,'verification_question',row.user_id,row.review_revision);
end; $$;
create function public.reply_to_verification(p_id uuid,p_reply text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare revision integer;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and deleted_at is null) then raise exception 'forbidden' using errcode='42501'; end if;
 if p_reply is null or length(btrim(p_reply))<2 or length(p_reply)>1200 then raise exception 'a reply is required'; end if;
 update public.verifications set review_state='ready',member_reply=btrim(p_reply),review_updated_at=now(),review_revision=review_revision+1
 where id=p_id and user_id=auth.uid() and status='pending' and review_state='needs_information' returning review_revision into revision;
 if not found then raise exception 'request unavailable'; end if;
 perform public.queue_verification_notice(p_id,'verification_reply',null,revision);
end; $$;

create function public.begin_verification_decision(p_id uuid,p_approve boolean,p_message text)
returns table(token uuid,evidence_path text,completed boolean) language plpgsql security definer set search_path=public,pg_temp as $$
declare row public.verifications;
begin
 if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_approve is null or p_message is null or length(p_message)>1200 or (not p_approve and length(btrim(p_message))<5) then raise exception 'a decline explanation is required'; end if;
 select * into row from public.verifications where id=p_id for update;
 if not found or row.user_id=auth.uid() then raise exception 'request unavailable'; end if;
 if row.status<>'pending' then
  if row.decision_approve is not distinct from p_approve then return query select row.decision_token,null::text,true; return; end if;
  raise exception 'already decided';
 end if;
 if row.review_state='finalizing' then
  if row.decision_approve is distinct from p_approve then raise exception 'finish the recorded decision first'; end if;
 else
  update public.verifications v set review_state='finalizing',decision_token=gen_random_uuid(),decision_approve=p_approve,
   decision_by=auth.uid(),decision_message=btrim(p_message),review_updated_at=now() where v.id=p_id returning * into row;
 end if;
 return query select row.decision_token,row.evidence_path,false;
end; $$;
create function public.confirm_verification_purge(p_id uuid,p_token uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.verifications set evidence_purged=true where id=p_id and decision_token=p_token and review_state='finalizing' and status='pending';
 if not found then raise exception 'decision unavailable'; end if;
end; $$;
revoke all on function public.confirm_verification_purge(uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirm_verification_purge(uuid,uuid) to service_role;

create or replace function public.decide_verification(p_id uuid,p_approve boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare row public.verifications;
begin
 if not public.is_moderator() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into row from public.verifications where id=p_id for update;
 if not found or row.user_id=auth.uid() then raise exception 'request unavailable'; end if;
 -- A retry of the same finalized choice does not add another audit event.
 if row.status<>'pending' then
  if row.decision_approve is not distinct from p_approve then return; end if;
  raise exception 'already decided';
 end if;
 if row.review_state<>'finalizing' or not row.evidence_purged or row.decision_approve is distinct from p_approve then raise exception 'finish evidence cleanup first'; end if;
 perform 1 from public.profiles where id=row.user_id and deleted_at is null for share;
 if not found then raise exception 'inactive applicant'; end if;
 update public.verifications set status=case when p_approve then 'approved' else 'rejected' end::public.verification_status,
  reviewed_by=auth.uid(),reviewed_at=now(),review_state='complete',review_updated_at=now(),review_question='',member_reply='',review_revision=review_revision+1
 where id=p_id returning * into row;
 if p_approve then update public.profiles set verified=true,tenure_start=coalesce(tenure_start,current_date) where id=row.user_id; end if;
 perform public.log_audit(case when p_approve then 'verification.approved' else 'verification.rejected' end,'verification',p_id,'{}'::jsonb);
 perform public.queue_verification_notice(p_id,'verification_decided',row.user_id,row.review_revision);
end; $$;
revoke all on function public.request_verification_information(uuid,text),public.reply_to_verification(uuid,text),public.begin_verification_decision(uuid,boolean,text),public.decide_verification(uuid,boolean) from public,anon;
grant execute on function public.request_verification_information(uuid,text),public.reply_to_verification(uuid,text),public.begin_verification_decision(uuid,boolean,text),public.decide_verification(uuid,boolean) to authenticated;
revoke all on function public.guard_verification_intake(),public.notify_verification_received() from public,anon,authenticated;

-- Account exports expose only the member-facing fields, never recovery tokens.
create function public.my_verification_progress() returns table(id uuid,status text,review_state text,review_question text,member_reply text,decision_message text,created_at timestamptz,review_updated_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select v.id,v.status::text,v.review_state,v.review_question,v.member_reply,v.decision_message,v.created_at,v.review_updated_at
 from public.verifications v join public.profiles p on p.id=v.user_id
 where v.user_id=auth.uid() and p.deleted_at is null order by v.created_at desc;
$$;
revoke all on function public.my_verification_progress() from public,anon;
grant execute on function public.my_verification_progress() to authenticated;
commit;
