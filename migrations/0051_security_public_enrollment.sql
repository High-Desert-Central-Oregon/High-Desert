-- Owner-applied after 0050 with the confirmation UI and maintenance worker.
-- Intake starts disabled. Before enabling, set a public-mail allowance below
-- the provider quota, reserving capacity for auth and member notices.
begin;
create table steppe_security_private.enrollment_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 mail_hour_limit integer not null default 20 check(mail_hour_limit between 1 and 100),
 mail_day_limit integer not null default 100 check(mail_day_limit between 1 and 500));
insert into steppe_security_private.enrollment_settings(singleton) values(true);
create table steppe_security_private.enrollment_budget (
 singleton boolean primary key default true check(singleton),
 hour_start timestamptz not null default date_trunc('hour',now()),
 day_start timestamptz not null default date_trunc('day',now()),
 requests_hour integer not null default 0,requests_day integer not null default 0,
 sends_hour integer not null default 0,sends_day integer not null default 0,
 consecutive_failures integer not null default 0,
 circuit_until timestamptz,expired_unsent integer not null default 0);
insert into steppe_security_private.enrollment_budget(singleton) values(true);
create table steppe_security_private.enrollment_callers (
 key text primary key check(length(key)=64),
 window_start timestamptz not null, requests integer not null);
create table steppe_security_private.enrollment_queue (
 id uuid primary key default gen_random_uuid(),
 email text not null check(length(email)<=320),
 purpose text not null check(purpose in ('interest','pledge')),
 slug text not null default '' check(length(slug)<=80),
 payload jsonb not null check(octet_length(payload::text)<=3000),
 locale text not null check(locale in ('en','es')),
 token text not null unique default encode(gen_random_bytes(32),'hex'),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '48 hours',
 sent_at timestamptz,confirmed_at timestamptz,
 attempts integer not null default 0,claim uuid,retry_at timestamptz not null default now(),
 unique(email,purpose,slug));
-- A completed pledge retains only a hashed possession credential linked to
-- the pledge. Its existing removal credential remains recoverable from the
-- emailed URL; deleting the pledge cascades this receipt. No signup payload.
create table steppe_security_private.enrollment_receipts (
 token_hash text primary key,
 pledge_id uuid not null references public.pledges(id) on delete cascade);
create function steppe_security_private.clear_account_enrollment() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from steppe_security_private.enrollment_queue q using auth.users u
 where u.id=new.id and q.email=lower(btrim(u.email));
 return new;
end; $$;
revoke all on function steppe_security_private.clear_account_enrollment() from public,anon,authenticated;
create trigger clear_account_enrollment after update of deleted_at on public.profiles
 for each row when (new.deleted_at is not null) execute function steppe_security_private.clear_account_enrollment();
revoke all on all tables in schema steppe_security_private from public,anon,authenticated;

create function steppe_security_private.reset_enrollment_budget() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update steppe_security_private.enrollment_budget set
 requests_hour=case when hour_start<date_trunc('hour',now()) then 0 else requests_hour end,
 sends_hour=case when hour_start<date_trunc('hour',now()) then 0 else sends_hour end,
 requests_day=case when day_start<date_trunc('day',now()) then 0 else requests_day end,
 sends_day=case when day_start<date_trunc('day',now()) then 0 else sends_day end,
 hour_start=date_trunc('hour',now()),day_start=date_trunc('day',now());
end; $$;
create function public.purge_public_enrollment() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from steppe_security_private.enrollment_budget for update;
 update steppe_security_private.enrollment_budget set expired_unsent=expired_unsent+
  (select count(*) from steppe_security_private.enrollment_queue where expires_at<=now() and sent_at is null);
 delete from steppe_security_private.enrollment_queue where expires_at<=now();
 delete from steppe_security_private.enrollment_callers where window_start<date_trunc('hour',now());
end; $$;
create function public.queue_public_enrollment(p_email text,p_purpose text,p_slug text,p_payload jsonb,p_locale text,p_caller text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare b steppe_security_private.enrollment_budget; n integer;
begin
 if p_email is null or p_email<>lower(btrim(p_email)) or length(p_email)>320
  or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or p_purpose is null or p_purpose not in ('interest','pledge')
  or p_slug is null or length(p_slug)>80 or p_locale is null or p_locale not in ('en','es')
  or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>3000
  or p_caller is null or p_caller !~ '^[a-f0-9]{64}$' then raise exception 'invalid request'; end if;
 if p_purpose='pledge' and not exists(select 1 from public.neighborhoods where slug=p_slug and threshold is not null) then raise exception 'no pledge campaign' using errcode='P0002'; end if;
 if p_purpose='interest' and (p_slug<>'' or p_payload->>'consent' is distinct from 'true') then raise exception 'consent required'; end if;
 if not (select enabled from steppe_security_private.enrollment_settings) then return false; end if;
 -- One shared row serializes all instances, addresses, aliases, and campaigns.
 perform steppe_security_private.reset_enrollment_budget();
 select * into b from steppe_security_private.enrollment_budget for update;
 if b.requests_hour>=120 or b.requests_day>=600 then return false; end if;
 update steppe_security_private.enrollment_budget set requests_hour=requests_hour+1,requests_day=requests_day+1;
 perform public.purge_public_enrollment();
 if (select count(*) from steppe_security_private.enrollment_queue)>=500 then return false; end if;
 insert into steppe_security_private.enrollment_callers values(p_caller,date_trunc('hour',now()),1)
 on conflict(key) do update set requests=case when enrollment_callers.window_start<date_trunc('hour',now()) then 1 else enrollment_callers.requests+1 end,
 window_start=date_trunc('hour',now()) returning requests into n;
 if n>60 then return false; end if;
 -- Never inspect enrollment tables here. Both existing and new addresses get
 -- the same possession challenge; unconfirmed requests never change counts.
 insert into steppe_security_private.enrollment_queue(email,purpose,slug,payload,locale)
 values(p_email,p_purpose,p_slug,p_payload,p_locale) on conflict(email,purpose,slug) do nothing;
 return true;
end; $$;
create function public.claim_public_enrollment_mail()
returns table(id uuid,email text,purpose text,slug text,locale text,token text,claim uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare b steppe_security_private.enrollment_budget; s steppe_security_private.enrollment_settings; v_id uuid;
begin
 perform steppe_security_private.reset_enrollment_budget();
 select * into b from steppe_security_private.enrollment_budget for update;
 select * into s from steppe_security_private.enrollment_settings;
 if not s.enabled or b.circuit_until>now() or b.sends_hour>=s.mail_hour_limit or b.sends_day>=s.mail_day_limit then return; end if;
 select q.id into v_id from steppe_security_private.enrollment_queue q
 where q.sent_at is null and q.confirmed_at is null and q.expires_at>now() and q.attempts<3 and q.retry_at<=now()
 -- At most one mail to any address per hour, even across campaigns.
 and not exists(select 1 from steppe_security_private.enrollment_queue other where other.email=q.email and other.id<>q.id
  and ((other.sent_at>now()-interval '1 hour') or (other.claim is not null and other.retry_at>now())))
 order by q.created_at,q.id limit 1 for update skip locked;
 if v_id is null then return; end if;
 update steppe_security_private.enrollment_budget set sends_hour=sends_hour+1,sends_day=sends_day+1;
 return query update steppe_security_private.enrollment_queue q
 set claim=gen_random_uuid(),attempts=q.attempts+1,retry_at=now()+interval '10 minutes'
 where q.id=v_id returning q.id,q.email,q.purpose,q.slug,q.locale,q.token,q.claim;
end; $$;
create function public.finish_public_enrollment_mail(p_id uuid,p_claim uuid,p_success boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from steppe_security_private.enrollment_budget for update;
 update steppe_security_private.enrollment_queue set sent_at=case when p_success then now() else sent_at end,
 claim=null,retry_at=now()+interval '15 minutes' where id=p_id and claim=p_claim;
 if not found then return; end if;
 update steppe_security_private.enrollment_budget set
 consecutive_failures=case when p_success then 0 else consecutive_failures+1 end,
 circuit_until=case when not p_success and consecutive_failures>=2 then now()+interval '1 hour' else circuit_until end;
end; $$;
create function public.public_enrollment_healthy() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select not exists(select 1 from steppe_security_private.enrollment_budget where expired_unsent>0 or circuit_until>now())
 and not exists(select 1 from steppe_security_private.enrollment_queue where sent_at is null and confirmed_at is null
 and (attempts>=3 or created_at<now()-interval '24 hours'));
$$;
create function public.confirm_public_enrollment(p_token text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare q steppe_security_private.enrollment_queue; removal text; receipt jsonb; pledge uuid;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 select jsonb_build_object('purpose','pledge','slug',n.slug,'removal_token',p.removal_token) into receipt
 from steppe_security_private.enrollment_receipts r join public.pledges p on p.id=r.pledge_id
 join public.neighborhoods n on n.id=p.neighborhood_id where r.token_hash=encode(digest(p_token,'sha256'),'hex');
 if receipt is not null then return receipt; end if;
 select * into q from steppe_security_private.enrollment_queue where token=p_token and expires_at>now() for update;
 if not found then return null; end if;
 if q.confirmed_at is null then
  if q.purpose='interest' then
   insert into public.interest_signups(email,first_name,neighborhood,in_area,consent,source)
   values(q.email,nullif(left(q.payload->>'first_name',120),''),nullif(left(q.payload->>'neighborhood',120),''),
    case when q.payload->>'in_area' in ('true','false') then (q.payload->>'in_area')::boolean end,true,
    case when q.payload->>'source' in ('bc','pc','bm') then q.payload->>'source' else 'direct' end)
   on conflict(email) do nothing;
  else perform public.submit_pledge(q.slug,q.email);
  end if;
  update steppe_security_private.enrollment_queue set confirmed_at=now(),payload='{}'::jsonb where id=q.id;
 end if;
 if q.purpose='pledge' then
  select p.id,p.removal_token::text into pledge,removal from public.pledges p join public.neighborhoods n on n.id=p.neighborhood_id
  where n.slug=q.slug and p.email_normalized=q.email;
  insert into steppe_security_private.enrollment_receipts(token_hash,pledge_id)
  values(encode(digest(p_token,'sha256'),'hex'),pledge) on conflict do nothing;
 end if;
 return jsonb_build_object('purpose',q.purpose,'slug',q.slug,'removal_token',removal);
end; $$;
create or replace function public.remove_pledge(p_token uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_email text; campaign text; n integer;
begin
 select p.email_normalized,n.slug into v_email,campaign from public.pledges p
 join public.neighborhoods n on n.id=p.neighborhood_id where p.removal_token=p_token;
 if not found then return false; end if;
 delete from steppe_security_private.enrollment_queue q where q.email=v_email and q.purpose='pledge' and q.slug=campaign;
 delete from public.pledges where removal_token=p_token;
 get diagnostics n=row_count;
 return n>0;
end; $$;
-- Delayed, coarsened counts remove the request-to-exact-count probe, including
-- direct anonymous RPCs. Manual opening remains a separate human decision.
create table steppe_security_private.pledge_public_counts (
 neighborhood_id uuid primary key references public.neighborhoods(id) on delete cascade,
 count bigint not null,as_of date not null);
create function public.refresh_public_pledge_counts() returns void
language sql security definer set search_path=public,pg_temp as $$
 insert into steppe_security_private.pledge_public_counts(neighborhood_id,count,as_of)
 select n.id,(count(p.id)/5)*5,current_date from public.neighborhoods n
 left join public.pledges p on p.neighborhood_id=n.id and p.created_at<current_date
 where n.threshold is not null group by n.id
 on conflict(neighborhood_id) do update set count=excluded.count,as_of=excluded.as_of
 where pledge_public_counts.as_of<current_date;
$$;
select public.refresh_public_pledge_counts();
create or replace function public.neighborhood_status(p_slug text)
returns table(slug text,name text,threshold int,pledge_count bigint,is_open boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 select n.slug,n.name,n.threshold,coalesce(c.count,0),(n.opened_at is not null)
 from public.neighborhoods n left join steppe_security_private.pledge_public_counts c on c.neighborhood_id=n.id
 where n.slug=lower(btrim(coalesce(p_slug,''))) and n.threshold is not null;
$$;
revoke all on function steppe_security_private.reset_enrollment_budget() from public,anon,authenticated;
revoke all on function public.queue_public_enrollment(text,text,text,jsonb,text,text),public.claim_public_enrollment_mail(),public.finish_public_enrollment_mail(uuid,uuid,boolean),public.public_enrollment_healthy(),public.purge_public_enrollment(),public.confirm_public_enrollment(text),public.refresh_public_pledge_counts() from public,anon,authenticated;
grant execute on function public.queue_public_enrollment(text,text,text,jsonb,text,text),public.claim_public_enrollment_mail(),public.finish_public_enrollment_mail(uuid,uuid,boolean),public.public_enrollment_healthy(),public.purge_public_enrollment(),public.confirm_public_enrollment(text),public.refresh_public_pledge_counts() to service_role;
revoke all on steppe_security_private.pledge_public_counts from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
