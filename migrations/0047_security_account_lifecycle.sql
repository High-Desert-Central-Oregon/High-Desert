-- Owner-applied after 0046. Local direct-JWT and Storage failure tests required.
begin;
create schema if not exists steppe_security_private;
revoke all on schema steppe_security_private from public,anon,authenticated;
-- Only the self-pinned definer below can enter this context. A caller-set GUC
-- would be forgeable; private transaction/backend keys cannot be client-written.
create table steppe_security_private.deletion_context (
 backend integer not null, transaction_id bigint not null, user_id uuid not null,
 primary key(backend,transaction_id,user_id));
revoke all on steppe_security_private.deletion_context from public,anon,authenticated;

create or replace function public.guard_removed_account_write() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare removed timestamptz;
begin
 if auth.uid() is not null then
  select deleted_at into removed from public.profiles where id=auth.uid() for share;
  if removed is not null and not exists(select 1 from steppe_security_private.deletion_context
   where backend=pg_backend_pid() and transaction_id=txid_current() and user_id=auth.uid()) then
   raise exception 'account removed' using errcode='42501';
  end if;
 end if;
 return null;
end; $$;
create or replace function public.guard_profile_columns() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid()=new.id then
  if exists(select 1 from steppe_security_private.deletion_context
   where backend=pg_backend_pid() and transaction_id=txid_current() and user_id=new.id) then
   new.verified:=false; new.role:='member'; new.tenure_start:=null;
  else
   new.verified:=old.verified; new.role:=old.role; new.tenure_start:=old.tenure_start;
  end if;
 end if;
 return new;
end; $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); email_value text; result uuid; complete timestamptz;
begin
 if v_uid is null then raise exception 'must be signed in' using errcode='42501'; end if;
 select coalesce(lower(email),v_uid::text||'@deleted.invalid') into email_value from auth.users where id=v_uid;
 if email_value is null then raise exception 'identity unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(email_value,36));
 perform 1 from auth.users where id=v_uid and coalesce(lower(email),v_uid::text||'@deleted.invalid')=email_value for update;
 if not found then raise exception 'identity changed; retry'; end if;
 -- Serialize against evidence uploads and profile writes, including legacy
 -- tombstones which need a durable job even if the old deletion erased pointers.
 perform 1 from public.profiles where id=v_uid for update;
 if not found then raise exception 'account unavailable'; end if;
 select id,completed_at into result,complete from public.account_removals where target_id=v_uid;
 if result is not null and complete is not null then return; end if;
 insert into steppe_security_private.deletion_context values(pg_backend_pid(),txid_current(),v_uid);
 insert into public.account_removals(target_id,requested_by,pending_email,reason)
 values(v_uid,v_uid,email_value,'member_request') on conflict(target_id) do nothing;
 update public.profiles set display_name='Former member',neighborhood_id=null,
  neighborhood_visibility='hidden',verified=false,role='member',tenure_start=null,locale='en',
  deleted_at=coalesce(deleted_at,now()) where id=v_uid;
 delete from public.member_blocks where blocker_id=v_uid or blocked_id=v_uid;
 delete from public.messages where sender_id=v_uid;
 delete from public.threads t where (member_a=v_uid or member_b=v_uid)
  and not exists(select 1 from public.messages m where m.thread_id=t.id);
 delete from public.thread_state where member_id=v_uid;
 delete from public.reports where reporter_id=v_uid;
 delete from public.calendar_feeds where member_id=v_uid;
 delete from public.event_rsvps where user_id=v_uid;
 delete from public.events where creator_id=v_uid;
 delete from public.posts where author_id=v_uid;
 delete from public.group_members where user_id=v_uid;
 delete from public.verifications where user_id=v_uid;
 delete from public.neighborhood_requests where user_id=v_uid;
 update public.appeals set body='[removed when the account was removed]' where user_id=v_uid;
 delete from public.member_notices where recipient_id=v_uid;
 delete from public.individual_invitations where email=email_value;
 delete from public.invited_emails where email=email_value;
 delete from public.invite_redemptions where email_normalized=email_value;
 delete from public.interest_signups where lower(email)=email_value;
 delete from public.pledges where email_normalized=email_value;
 if result is null then
  perform public.log_audit('account.removal_requested','profile',v_uid,jsonb_build_object('reason','member_request'));
 end if;
 delete from steppe_security_private.deletion_context
 where backend=pg_backend_pid() and transaction_id=txid_current() and user_id=v_uid;
end; $$;
-- Allows the retired member to retry only their own recorded cleanup. It grants
-- no general table visibility and no way to choose another target.
create function public.my_account_removal()
returns table(id uuid,target_id uuid,pending_email text,completed_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.id,r.target_id,r.pending_email,r.completed_at from public.account_removals r where r.target_id=auth.uid();
$$;
revoke all on function public.my_account_removal() from public,anon;
grant execute on function public.my_account_removal() to authenticated;
notify pgrst,'reload schema';
commit;
