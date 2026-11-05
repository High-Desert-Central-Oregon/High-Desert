-- Apply after 0047, together with the upload form and maintenance worker.
begin;
create table steppe_security_private.evidence_slots (
 user_id uuid primary key references public.profiles(id),
 path text not null unique, expires_at timestamptz not null);
create table steppe_security_private.evidence_cleanup (
 path text primary key, claim uuid, retry_at timestamptz not null default now(),
 attempts integer not null default 0);
revoke all on steppe_security_private.evidence_slots,steppe_security_private.evidence_cleanup from public,anon,authenticated;

create function public.reserve_verification_upload(p_extension text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare result text;
begin
 if p_extension is null or p_extension not in ('jpg','png','webp','heic','pdf') then raise exception 'invalid evidence type'; end if;
 perform 1 from public.profiles where id=auth.uid() and deleted_at is null and not verified for update;
 if not found then raise exception 'applicant unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.verifications where user_id=auth.uid() and status='pending') then raise exception 'request pending'; end if;
 select path into result from steppe_security_private.evidence_slots where user_id=auth.uid() and expires_at>clock_timestamp();
 if result is not null then return result; end if;
 -- A new reservation never strands an older object. Legacy orphan uploads
 -- count toward the same one-object, bucket-size-bounded account allowance.
 if exists(select 1 from storage.objects where bucket_id='verification-evidence' and starts_with(name,auth.uid()::text||'/')) then
  raise exception 'evidence cleanup pending';
 end if;
 result:=auth.uid()::text||'/'||gen_random_uuid()::text||'.'||p_extension;
 insert into steppe_security_private.evidence_slots values(auth.uid(),result,now()+interval '1 hour')
 on conflict(user_id) do update set path=excluded.path,expires_at=excluded.expires_at;
 return result;
end; $$;
-- Revoke an unused reservation before deleting its object through Storage.
-- Profile locking serializes this with upload/intake guards. A referenced path
-- is never returned; failures can retry the same expired reservation.
create function public.release_unused_verification_upload(p_path text default null) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare result text;
begin
 perform 1 from public.profiles where id=auth.uid() and deleted_at is null and not verified for update;
 if not found then raise exception 'applicant unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.verifications where user_id=auth.uid() and status='pending') then raise exception 'request pending'; end if;
 update steppe_security_private.evidence_slots s set expires_at=clock_timestamp()
 where s.user_id=auth.uid() and (p_path is null or s.path=p_path)
 and not exists(select 1 from public.verifications v where v.evidence_path=s.path)
 returning path into result;
 return result;
end; $$;
revoke all on function public.release_unused_verification_upload(text) from public,anon;
grant execute on function public.release_unused_verification_upload(text) to authenticated;

create function public.can_upload_verification_evidence(p_path text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from steppe_security_private.evidence_slots s join public.profiles p on p.id=s.user_id
 where s.user_id=auth.uid() and s.path=p_path and s.expires_at>clock_timestamp() and p.deleted_at is null and not p.verified)
 and not exists(select 1 from public.verifications where user_id=auth.uid() and status='pending');
$$;
revoke all on function public.reserve_verification_upload(text),public.can_upload_verification_evidence(text) from public,anon;
grant execute on function public.reserve_verification_upload(text),public.can_upload_verification_evidence(text) to authenticated;
drop policy if exists "evidence upload (own folder)" on storage.objects;
create policy "evidence upload (own folder)" on storage.objects for insert to authenticated
 with check(bucket_id='verification-evidence' and public.can_upload_verification_evidence(name));

-- Lock the slot in a volatile trigger as well as testing RLS. This prevents
-- a statement begun before revocation from inserting through an old snapshot.
create function steppe_security_private.lock_evidence_upload() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.bucket_id='verification-evidence' and auth.uid() is not null then
  perform 1 from steppe_security_private.evidence_slots where user_id=auth.uid()
   and path=new.name and expires_at>clock_timestamp() for share;
  if not found then raise exception 'evidence reservation unavailable' using errcode='42501'; end if;
 end if;
 return new;
end; $$;
revoke all on function steppe_security_private.lock_evidence_upload() from public,anon,authenticated;
create trigger evidence_slot_lock before insert on storage.objects
 for each row execute function steppe_security_private.lock_evidence_upload();

create function steppe_security_private.bind_evidence_slot() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.method<>'postcard_code' and auth.uid() is not null then
  perform 1 from steppe_security_private.evidence_slots where user_id=auth.uid() and path=new.evidence_path and expires_at>clock_timestamp() for share;
  if not found or exists(select 1 from steppe_security_private.evidence_cleanup where path=new.evidence_path)
   or not exists(select 1 from storage.objects where bucket_id='verification-evidence' and name=new.evidence_path)
  then raise exception 'evidence unavailable'; end if;
 end if;
 return new;
end; $$;
revoke all on function steppe_security_private.bind_evidence_slot() from public,anon,authenticated;
create trigger zz_bind_evidence_slot before insert on public.verifications
 for each row execute function steppe_security_private.bind_evidence_slot();

-- Leased, bounded cleanup. Records survive Storage failures. No member can
-- attach an expired path while its external deletion is in flight.
create function public.claim_orphan_evidence_cleanup()
returns table(path text,claim uuid) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into steppe_security_private.evidence_cleanup(path)
 select o.name from storage.objects o where o.bucket_id='verification-evidence'
  and o.created_at<now()-interval '24 hours'
  and not exists(select 1 from public.verifications v where v.evidence_path=o.name)
  and not exists(select 1 from steppe_security_private.evidence_slots s where s.path=o.name and s.expires_at>clock_timestamp())
 order by o.created_at,o.name limit 100 on conflict do nothing;
 return query with candidates as (
  select q.path from steppe_security_private.evidence_cleanup q where q.retry_at<=now()
  order by q.retry_at,q.path limit 25 for update skip locked
 ) update steppe_security_private.evidence_cleanup q set claim=gen_random_uuid(),attempts=q.attempts+1,retry_at=now()+interval '10 minutes'
 from candidates c where q.path=c.path returning q.path,q.claim;
end; $$;
create function public.finish_orphan_evidence_cleanup(p_path text,p_claim uuid,p_success boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_success and not exists(select 1 from storage.objects where bucket_id='verification-evidence' and name=p_path) then
  delete from steppe_security_private.evidence_cleanup where path=p_path and claim=p_claim;
  if found then delete from steppe_security_private.evidence_slots where path=p_path and expires_at<=now(); end if;
 else
  update steppe_security_private.evidence_cleanup set claim=null,retry_at=now()+interval '1 hour'
  where path=p_path and claim=p_claim;
 end if;
end; $$;
create function public.orphan_evidence_cleanup_pending() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from steppe_security_private.evidence_cleanup);
$$;
revoke all on function public.claim_orphan_evidence_cleanup(),public.finish_orphan_evidence_cleanup(text,uuid,boolean),public.orphan_evidence_cleanup_pending() from public,anon,authenticated;
grant execute on function public.claim_orphan_evidence_cleanup(),public.finish_orphan_evidence_cleanup(text,uuid,boolean),public.orphan_evidence_cleanup_pending() to service_role;
notify pgrst,'reload schema';
commit;
