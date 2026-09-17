-- Owner-applied after 0035. Individual invitations coexist with batch tokens.
begin;
-- Preserve the neighborhood the website actually asks for; it is not proof of residency.
alter table public.interest_signups add column neighborhood text check(length(neighborhood)<=120);
create function public.can_manage_onboarding() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.deleted_at is null
   and (p.role='admin' or exists(select 1 from public.support_operators s where s.user_id=p.id)));
$$;
revoke all on function public.can_manage_onboarding() from public,anon;
grant execute on function public.can_manage_onboarding() to authenticated;

create table public.individual_invitations (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check(email=lower(btrim(email)) and length(email)<=320 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 interest_id uuid references public.interest_signups(id) on delete set null,
 created_by uuid references public.profiles(id) on delete set null,
 locale text not null default 'en' check(locale in ('en','es')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,
 generation integer not null default 1,
 send_count integer not null default 1,
 send_window timestamptz not null default now(),
 last_requested_at timestamptz not null default now()
);
alter table public.individual_invitations enable row level security;
revoke all on public.individual_invitations from public,anon,authenticated;
grant select on public.individual_invitations to authenticated;
grant all on public.individual_invitations to service_role;
create policy individual_invites_read on public.individual_invitations for select to authenticated using(public.can_manage_onboarding());

-- One first-party service-message outbox for invitations and verification.
create table public.member_notices (
 id uuid primary key default gen_random_uuid(),
 invitation_id uuid references public.individual_invitations(id) on delete cascade,
 verification_id uuid references public.verifications(id) on delete cascade,
 recipient_id uuid references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('invitation','verification_received','verification_question','verification_reply','verification_decided')),
 dedupe_key text not null unique,
 locale text not null default 'en' check(locale in ('en','es')),
 created_at timestamptz not null default now(),
 state text not null default 'pending' check(state in ('pending','sent','cancelled')),
 attempts integer not null default 0,
 claim uuid,
 lease_until timestamptz,
 next_at timestamptz not null default now()
);
alter table public.member_notices enable row level security;
revoke all on public.member_notices from public,anon,authenticated;
grant select(id,invitation_id,verification_id,kind,created_at,state,attempts) on public.member_notices to authenticated;
grant all on public.member_notices to service_role;
create policy member_notices_operator_read on public.member_notices for select to authenticated
using(public.can_manage_onboarding() or (verification_id is not null and public.is_moderator()));

create function public.create_individual_invitation(p_email text,p_locale text default 'en',p_interest uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare email_value text:=lower(btrim(p_email)); current_invite public.individual_invitations; result uuid;
begin
 if not public.can_manage_onboarding() then raise exception 'forbidden' using errcode='42501'; end if;
 if email_value is null or length(email_value)>320 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_locale not in ('en','es') then raise exception 'invalid invitation'; end if;
 if p_interest is not null and not exists(select 1 from public.interest_signups where id=p_interest and lower(email)=email_value and consent=true) then raise exception 'interest consent required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(email_value,36));
 if exists(select 1 from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=email_value and p.deleted_at is null and u.email_confirmed_at is not null) then raise exception 'already a member'; end if;
 select * into current_invite from public.individual_invitations where email=email_value for update;
 if found and current_invite.revoked_at is null and current_invite.expires_at>now() then return current_invite.id; end if;
 insert into public.individual_invitations(email,locale,interest_id,created_by)
 values(email_value,p_locale,p_interest,auth.uid())
 on conflict(email) do update set expires_at=now()+interval '7 days',revoked_at=null,
  generation=individual_invitations.generation+1,locale=p_locale,interest_id=coalesce(p_interest,individual_invitations.interest_id),
  created_by=auth.uid(),last_requested_at=now(),send_count=1,send_window=now()
 returning id into result;
 insert into public.member_notices(invitation_id,kind,dedupe_key,locale)
 select id,'invitation',id::text||':'||generation::text,locale from public.individual_invitations where id=result;
 return result;
end; $$;
create function public.retry_individual_invitation(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare row public.individual_invitations;
begin
 if not public.can_manage_onboarding() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into row from public.individual_invitations where id=p_id for update;
 if not found or row.revoked_at is not null or row.expires_at<=now() then raise exception 'invite unavailable'; end if;
 if row.last_requested_at>now()-interval '1 minute' or (row.send_window>now()-interval '1 day' and row.send_count>=5) then raise exception 'please wait before resending'; end if;
 update public.member_notices set state='cancelled' where invitation_id=p_id and state='pending';
 update public.individual_invitations set generation=generation+1,last_requested_at=now(),
  send_count=case when send_window<=now()-interval '1 day' then 1 else send_count+1 end,
  send_window=case when send_window<=now()-interval '1 day' then now() else send_window end where id=p_id returning * into row;
 insert into public.member_notices(invitation_id,kind,dedupe_key,locale) values(p_id,'invitation',p_id::text||':'||row.generation::text,row.locale);
end; $$;
create function public.revoke_individual_invitation(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.can_manage_onboarding() then raise exception 'forbidden' using errcode='42501'; end if;
 update public.individual_invitations set revoked_at=coalesce(revoked_at,now()) where id=p_id;
 update public.member_notices set state='cancelled' where invitation_id=p_id and state='pending';
end; $$;
revoke all on function public.create_individual_invitation(text,text,uuid),public.retry_individual_invitation(uuid),public.revoke_individual_invitation(uuid) from public,anon;
grant execute on function public.create_individual_invitation(text,text,uuid),public.retry_individual_invitation(uuid),public.revoke_individual_invitation(uuid) to authenticated;

-- Narrow owner-only projection. The original interest table remains default-deny.
create function public.onboarding_people(p_source text default 'interest',p_page integer default 0)
returns table(id uuid,email text,first_name text,neighborhood text,consent boolean,created_at timestamptz,invitation_id uuid,expires_at timestamptz,revoked_at timestamptz,delivery text,progress text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.can_manage_onboarding() then raise exception 'forbidden' using errcode='42501'; end if;
 return query with people as (
  select s.id,s.email,s.first_name,s.neighborhood,s.consent,s.created_at from public.interest_signups s where p_source='interest'
  union all select i.id,i.email,null::text,null::text,true,i.created_at from public.individual_invitations i where p_source='invited'
 ) select x.id,x.email,x.first_name,x.neighborhood,x.consent,x.created_at,i.id,i.expires_at,i.revoked_at,
 coalesce(n.state,'not_sent'),
 case when p.id is null or u.email_confirmed_at is null then 'not_joined' when p.verified then 'verified'
 when exists(select 1 from public.verifications v where v.user_id=p.id and v.status='pending') then 'verification_pending' else 'account_created' end
 from people x left join public.individual_invitations i on i.email=lower(x.email)
 left join auth.users u on lower(u.email)=lower(x.email)
 left join public.profiles p on p.id=u.id and p.deleted_at is null
 left join lateral(select mn.state from public.member_notices mn where mn.invitation_id=i.id order by mn.created_at desc,mn.id desc limit 1)n on true
 order by x.created_at desc,x.id limit 25 offset least(greatest(coalesce(p_page,0),0),10000)*25;
end; $$;
revoke all on function public.onboarding_people(text,integer) from public,anon;
grant execute on function public.onboarding_people(text,integer) to authenticated;

create function public.can_start_email_signin(p_email text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.invited_emails where email=lower(btrim(p_email)))
 or exists(select 1 from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(btrim(p_email)) and p.deleted_at is null and u.email_confirmed_at is not null)
 or exists(select 1 from public.individual_invitations where email=lower(btrim(p_email)) and revoked_at is null and expires_at>now());
$$;
revoke all on function public.can_start_email_signin(text) from public,anon,authenticated;
grant execute on function public.can_start_email_signin(text) to service_role;

-- GoTrue may insert an unconfirmed email user when the code is requested. Gate
-- both creation AND first confirmation; expiry/revocation also binds old codes.
create or replace function public.enforce_invited_signup() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if session_user='supabase_auth_admin' then
  if tg_op='UPDATE' then
   if old.email_confirmed_at is not null then return new; end if;
   if new.email_confirmed_at is null then return new; end if;
  end if;
  if new.email is null or btrim(new.email)='' then raise exception 'email invitation required' using errcode='23514'; end if;
  if exists(select 1 from public.invited_emails where email=lower(btrim(new.email))) then return new; end if;
  perform 1 from public.individual_invitations where email=lower(btrim(new.email)) and revoked_at is null and expires_at>now() for share;
  if not found then raise exception 'signups are invite-only' using errcode='23514'; end if;
 end if;
 return new;
end; $$;
create trigger individual_invitation_confirmation_gate before update of email_confirmed_at on auth.users
for each row execute function public.enforce_invited_signup();

create function public.claim_member_notices() returns table(id uuid,claim uuid,kind text,recipient_email text,locale text,reference_id uuid,expires_at timestamptz)
language sql security definer set search_path=public,pg_temp as $$
 with due as (
  select n.id from public.member_notices n where n.state='pending' and n.attempts<8 and n.next_at<=now() and (n.lease_until is null or n.lease_until<now())
   and (n.invitation_id is null or exists(select 1 from public.individual_invitations i where i.id=n.invitation_id and i.revoked_at is null and i.expires_at>now()))
   and (n.recipient_id is null or exists(select 1 from public.profiles p where p.id=n.recipient_id and p.deleted_at is null))
  order by n.created_at limit 20 for update skip locked
 ), claimed as (
  update public.member_notices n set claim=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1
  from due where n.id=due.id returning n.*
 ) select c.id,c.claim,c.kind,coalesce(i.email,u.email),c.locale,coalesce(c.verification_id,c.invitation_id),i.expires_at
 from claimed c left join public.individual_invitations i on i.id=c.invitation_id left join auth.users u on u.id=c.recipient_id;
$$;
create function public.finish_member_notice(p_id uuid,p_claim uuid,p_sent boolean) returns void
language sql security definer set search_path=public,pg_temp as $$
 update public.member_notices set state=case when p_sent then 'sent' else 'pending' end,claim=null,lease_until=null,next_at=now()+interval '15 minutes'
 where id=p_id and claim=p_claim and state='pending';
$$;
create function public.retry_member_notice(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not (public.can_manage_onboarding() or public.is_moderator()) then raise exception 'forbidden' using errcode='42501'; end if;
 update public.member_notices set next_at=now(),attempts=0 where id=p_id and invitation_id is null and state='pending'
 and (lease_until is null or lease_until<now());
end; $$;
revoke all on function public.claim_member_notices(),public.finish_member_notice(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_member_notices(),public.finish_member_notice(uuid,uuid,boolean) to service_role;
revoke all on function public.retry_member_notice(uuid) from public,anon;
grant execute on function public.retry_member_notice(uuid) to authenticated;
create function public.purge_member_pipeline_data() returns void
language sql security definer set search_path=public,pg_temp as $$
 delete from public.member_notices where created_at<now()-interval '30 days';
 delete from public.individual_invitations where expires_at<now()-interval '180 days';
$$;
revoke all on function public.purge_member_pipeline_data() from public,anon,authenticated;
grant execute on function public.purge_member_pipeline_data() to service_role;
commit;
