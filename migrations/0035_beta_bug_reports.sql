-- Beta bug reports. Manual owner apply after isolated database validation.
-- No operator is auto-enrolled. Provision an existing owner explicitly after apply.
begin;
create table public.support_operators (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.support_operators enable row level security;
revoke all on public.support_operators from public, anon, authenticated;
grant all on public.support_operators to service_role;
create function public.is_support_operator() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.support_operators s join public.profiles p on p.id=s.user_id
    where s.user_id=auth.uid() and p.deleted_at is null);
$$;
revoke all on function public.is_support_operator() from public, anon;
grant execute on function public.is_support_operator() to authenticated;

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  reporter_id uuid references public.profiles(id) on delete cascade,
  description text not null check(length(description) between 5 and 4000),
  expected text not null default '' check(length(expected)<=2000),
  contact_email text not null default '' check(length(contact_email)<=320),
  page text not null check(length(page)<=100),
  locale text not null check(locale in ('en','es')),
  release text not null check(length(release)<=80),
  diagnostics jsonb check(diagnostics is null or (jsonb_typeof(diagnostics)='object' and octet_length(diagnostics::text)<=50000)),
  status text not null default 'new' check(status in ('new','reviewing','needs_information','reproduced','in_progress','fixed','closed','duplicate')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days',
  notification_state text not null default 'pending' check(notification_state in ('pending','sent')),
  notification_attempts integer not null default 0,
  notification_claim uuid,
  notification_lease_until timestamptz,
  notification_next_at timestamptz not null default now()
);
create index bug_reports_created on public.bug_reports(created_at desc);
create index bug_reports_reporter on public.bug_reports(reporter_id);
alter table public.bug_reports enable row level security;
revoke all on public.bug_reports from public, anon, authenticated;
grant select (id,reporter_id,description,expected,contact_email,page,locale,release,diagnostics,status,created_at,expires_at,notification_state,notification_attempts,notification_next_at) on public.bug_reports to authenticated;
grant all on public.bug_reports to service_role;
create policy bug_reports_read on public.bug_reports for select to authenticated
using (expires_at>now() and (public.is_support_operator() or (reporter_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and deleted_at is null))));

create table public.bug_report_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.bug_reports(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  status text not null,
  note text not null default '' check(length(note)<=2000),
  created_at timestamptz not null default now()
);
create index bug_report_history_report on public.bug_report_history(report_id,created_at);
alter table public.bug_report_history enable row level security;
revoke all on public.bug_report_history from public, anon, authenticated;
grant select on public.bug_report_history to authenticated;
grant all on public.bug_report_history to service_role;
create policy bug_history_read on public.bug_report_history for select to authenticated
using (public.is_support_operator() and exists(select 1 from public.bug_reports where id=report_id and expires_at>now()));

-- Only a keyed hash of a short-lived rate-limit bucket, never a raw IP.
create table public.bug_report_limits (bucket text primary key, hits integer not null, expires_at timestamptz not null);
alter table public.bug_report_limits enable row level security;
revoke all on public.bug_report_limits from public, anon, authenticated;
grant all on public.bug_report_limits to service_role;

create function public.submit_bug_report(p_key uuid,p_reporter uuid,p_description text,p_expected text,p_email text,p_page text,p_locale text,p_release text,p_diagnostics jsonb,p_bucket text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.bug_reports; result uuid; attempts integer;
begin
  -- Serialize retries of one secret request key, including anonymous requests.
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,35));
  if p_reporter is not null then
    -- Serialize intake with tombstoning so a racing deletion cannot leave a
    -- new report attached to an already-deleted account.
    perform 1 from public.profiles where id=p_reporter and deleted_at is null for share;
    if not found then raise exception 'inactive account' using errcode='42501'; end if;
  end if;
  select * into existing from public.bug_reports where request_key=p_key;
  if found then
    if existing.reporter_id is distinct from p_reporter then raise exception 'request conflict' using errcode='42501'; end if;
    return existing.id;
  end if;
  if p_bucket !~ '^[0-9a-f]{64}$' then raise exception 'invalid bucket'; end if;
  insert into public.bug_report_limits as b values(p_bucket,1,now()+interval '1 hour')
  on conflict(bucket) do update set hits=case when b.expires_at<now() then 1 else b.hits+1 end,
    expires_at=case when b.expires_at<now() then now()+interval '1 hour' else b.expires_at end
  returning hits into attempts;
  if attempts>5 then raise exception 'report limit' using errcode='P0001'; end if;
  insert into public.bug_reports(request_key,reporter_id,description,expected,contact_email,page,locale,release,diagnostics)
  values(p_key,p_reporter,p_description,p_expected,p_email,p_page,p_locale,p_release,p_diagnostics) returning id into result;
  insert into public.bug_report_history(report_id,status) values(result,'new');
  return result;
end; $$;
revoke all on function public.submit_bug_report(uuid,uuid,text,text,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_bug_report(uuid,uuid,text,text,text,text,text,text,jsonb,text) to service_role;

create function public.update_bug_report(p_id uuid,p_status text,p_note text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_support_operator() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_status not in ('new','reviewing','needs_information','reproduced','in_progress','fixed','closed','duplicate') or p_status is null or p_note is null or length(p_note)>2000 then raise exception 'invalid update'; end if;
  update public.bug_reports set status=p_status where id=p_id and expires_at>now();
  if not found then raise exception 'report unavailable'; end if;
  insert into public.bug_report_history(report_id,actor_id,status,note) values(p_id,auth.uid(),p_status,p_note);
end; $$;
revoke all on function public.update_bug_report(uuid,text,text) from public,anon;
grant execute on function public.update_bug_report(uuid,text,text) to authenticated;

-- Atomic claim: parallel dispatchers cannot send the same alert concurrently.
create function public.claim_bug_report_notifications(p_id uuid default null)
returns table(id uuid,claim uuid) language sql security definer set search_path=public,pg_temp as $$
  with due as (select b.id from public.bug_reports b where (p_id is null or b.id=p_id)
    and b.notification_state='pending' and b.notification_attempts<8 and b.notification_next_at<=now()
    and (b.notification_lease_until is null or b.notification_lease_until<now()) and b.expires_at>now()
    order by b.created_at limit 10 for update skip locked)
  update public.bug_reports b set notification_claim=gen_random_uuid(),notification_lease_until=now()+interval '5 minutes',notification_attempts=b.notification_attempts+1
  from due where b.id=due.id returning b.id,b.notification_claim;
$$;
create function public.finish_bug_report_notification(p_id uuid,p_claim uuid,p_sent boolean)
returns void language sql security definer set search_path=public,pg_temp as $$
  update public.bug_reports set notification_state=case when p_sent then 'sent' else 'pending' end,
    notification_lease_until=null,notification_claim=null,notification_next_at=now()+interval '15 minutes'
  where id=p_id and notification_claim=p_claim;
$$;
create function public.retry_bug_report_notification(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_support_operator() then raise exception 'forbidden' using errcode='42501'; end if;
  update public.bug_reports set notification_attempts=0,notification_next_at=now()
    where id=p_id and notification_state='pending' and expires_at>now()
      and (notification_lease_until is null or notification_lease_until<now());
end; $$;
revoke all on function public.claim_bug_report_notifications(uuid) from public,anon,authenticated;
revoke all on function public.finish_bug_report_notification(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.retry_bug_report_notification(uuid) from public,anon;
grant execute on function public.claim_bug_report_notifications(uuid) to service_role;
grant execute on function public.finish_bug_report_notification(uuid,uuid,boolean) to service_role;
grant execute on function public.retry_bug_report_notification(uuid) to authenticated;

create function public.purge_expired_bug_reports() returns void
language sql security definer set search_path=public,pg_temp as $$
  delete from public.bug_reports where expires_at<=now();
  delete from public.bug_report_limits where expires_at<=now();
$$;
revoke all on function public.purge_expired_bug_reports() from public,anon,authenticated;
grant execute on function public.purge_expired_bug_reports() to service_role;

-- Account deletion leaves a tombstone profile; clean up at the tombstone write.
create function public.erase_member_bug_reports() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from public.bug_reports where reporter_id=new.id;
    delete from public.support_operators where user_id=new.id;
    update public.bug_report_history set actor_id=null where actor_id=new.id;
  end if;
  return new;
end; $$;
revoke all on function public.erase_member_bug_reports() from public,anon,authenticated;
create trigger erase_member_bug_reports after update of deleted_at on public.profiles
for each row execute function public.erase_member_bug_reports();
commit;
