-- Owner-applied after 0037. Review locally before applying to production.
-- Never hard-delete auth.users/profiles: they anchor the permanent civic record.
begin;

create function public.is_active_account() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles where id=auth.uid() and deleted_at is null);
$$;
create function public.can_remove_accounts() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and deleted_at is null);
$$;
revoke all on function public.is_active_account(),public.can_remove_accounts() from public,anon;
grant execute on function public.is_active_account(),public.can_remove_accounts() to authenticated,service_role;

-- Email is retained only while cleanup is pending, then erased. A stable target
-- prevents a retry from removing a NEW account that later uses the same email.
create table public.account_removals (
 id uuid primary key default gen_random_uuid(),
 target_id uuid not null unique references public.profiles(id),
 requested_by uuid not null references public.profiles(id),
 pending_email text,
 reason text not null check(reason in ('member_request','test_reset')),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 check ((completed_at is null) = (pending_email is not null))
);
alter table public.account_removals enable row level security;
revoke all on public.account_removals from public,anon,authenticated;
grant select on public.account_removals to authenticated;
grant all on public.account_removals to service_role;
create policy removal_admin_read on public.account_removals for select to authenticated
 using(public.can_remove_accounts());

create function public.preview_account_removal(p_email text)
returns table(target_id uuid,email text,display_name text,verified boolean,eligible boolean,removal_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.can_remove_accounts() then raise exception 'forbidden' using errcode='42501'; end if;
 return query select p.id,u.email::text,p.display_name,p.verified,
  p.id<>auth.uid() and p.role='member' and p.deleted_at is null
   and not exists(select 1 from public.support_operators s where s.user_id=p.id),r.id
 from auth.users u join public.profiles p on p.id=u.id
 left join public.account_removals r on r.target_id=p.id
 where lower(u.email)=lower(btrim(p_email)) and u.deleted_at is null;
end;
$$;

create function public.begin_account_removal(p_target uuid,p_email text,p_reason text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.profiles; email_value text; result uuid;
begin
 if not public.can_remove_accounts() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_target=auth.uid() or p_reason is null or p_reason not in ('member_request','test_reset') then
  raise exception 'invalid removal';
 end if;
 email_value:=lower(btrim(p_email));
 if email_value is null or email_value='' then raise exception 'confirmation mismatch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(email_value,36));
 -- Lock the identity as well: an email change must not race the confirmation.
 perform 1 from auth.users where id=p_target and lower(email)=email_value and deleted_at is null for update;
 if not found then raise exception 'confirmation mismatch'; end if;
 select * into p from public.profiles where id=p_target for update;
 if not found or p.role<>'member' or exists(select 1 from public.support_operators where user_id=p_target) then
  raise exception 'protected account';
 end if;
 select id into result from public.account_removals where target_id=p_target;
 if found then return result; end if;
 if p.deleted_at is not null then raise exception 'account already removed'; end if;
 insert into public.account_removals(target_id,requested_by,pending_email,reason)
 values(p_target,auth.uid(),email_value,p_reason) returning id into result;

 -- Deactivate before external cleanup. A failed Storage/Auth request cannot
 -- silently restore access; the durable job remains available to retry.
 update public.profiles set display_name='Former member',neighborhood_id=null,
  neighborhood_visibility='hidden',verified=false,tenure_start=null,locale='en',deleted_at=now()
 where id=p_target;
 delete from public.member_blocks where blocker_id=p_target or blocked_id=p_target;
 delete from public.messages where sender_id=p_target;
 delete from public.threads t where (member_a=p_target or member_b=p_target)
  and not exists(select 1 from public.messages m where m.thread_id=t.id);
 delete from public.thread_state where member_id=p_target;
 delete from public.reports where reporter_id=p_target;
 delete from public.calendar_feeds where member_id=p_target;
 delete from public.event_rsvps where user_id=p_target;
 delete from public.events where creator_id=p_target;
 delete from public.posts where author_id=p_target;
 delete from public.group_members where user_id=p_target;
 delete from public.verifications where user_id=p_target;
 delete from public.neighborhood_requests where user_id=p_target;
 update public.appeals set body='[removed when the account was removed]' where user_id=p_target;
 delete from public.member_notices where recipient_id=p_target;
 delete from public.individual_invitations where email=email_value;
 delete from public.invited_emails where email=email_value;
 delete from public.invite_redemptions where email_normalized=email_value;
 delete from public.interest_signups where lower(email)=email_value;
 delete from public.pledges where email_normalized=email_value;
 perform public.log_audit('account.removal_requested','profile',p_target,jsonb_build_object('reason',p_reason));
 return result;
end;
$$;

-- Storage metadata is read only here. Objects are deleted using the Storage API,
-- never by deleting storage.objects rows. Includes nested/orphaned uploads.
create function public.account_removal_evidence(p_id uuid)
returns table(name text) language sql stable security definer set search_path=public,pg_temp as $$
 select o.name from storage.objects o join public.account_removals r
 on o.bucket_id='verification-evidence' and starts_with(o.name,r.target_id::text||'/')
 where r.id=p_id and r.completed_at is null order by o.name limit 100;
$$;
create function public.finish_account_removal(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.account_removals;
begin
 select * into r from public.account_removals where id=p_id for update;
 if not found then raise exception 'unknown removal'; end if;
 if r.completed_at is not null then return; end if;
 if not exists(select 1 from auth.users where id=r.target_id and deleted_at is not null)
 or exists(select 1 from storage.objects where bucket_id='verification-evidence' and starts_with(name,r.target_id::text||'/'))
 then raise exception 'cleanup incomplete'; end if;
 update public.account_removals set pending_email=null,completed_at=now() where id=p_id;
 perform public.log_audit('account.removal_completed','profile',r.target_id);
end;
$$;
revoke all on function public.preview_account_removal(text),public.begin_account_removal(uuid,text,text) from public,anon;
grant execute on function public.preview_account_removal(text),public.begin_account_removal(uuid,text,text) to authenticated;
revoke all on function public.account_removal_evidence(uuid),public.finish_account_removal(uuid) from public,anon,authenticated;
grant execute on function public.account_removal_evidence(uuid),public.finish_account_removal(uuid) to service_role;

-- Block re-invitation until cleanup has actually completed, including legacy
-- batch redemption. Serialize with begin_account_removal's email lock.
create function public.guard_removal_invitation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(lower(new.email),36));
 if exists(select 1 from public.account_removals where pending_email=lower(new.email) and completed_at is null) then
  raise exception 'account removal pending';
 end if;
 return new;
end;
$$;
create trigger removal_invitation_guard before insert or update on public.individual_invitations
 for each row execute function public.guard_removal_invitation();
create trigger removal_allowlist_guard before insert or update on public.invited_emails
 for each row execute function public.guard_removal_invitation();

-- JWTs can outlive Auth session revocation. Restrictive policies remove access
-- immediately without changing any existing permissive policy or secret-ballot
-- rule. Definer writes also get a trigger backstop, serialized on the profile.
-- The trigger targets this removal workflow; the older self-deletion transaction
-- must still be able to append its own final audit event after scrubbing itself.
create function public.guard_removed_account_write() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare removed timestamptz;
begin
 if auth.uid() is not null then
  select deleted_at into removed from public.profiles where id=auth.uid() for share;
  if removed is not null and exists(select 1 from public.account_removals where target_id=auth.uid()) then
   raise exception 'account removed' using errcode='42501';
  end if;
 end if;
 return null; -- statement trigger
end;
$$;
do $$ declare t record; v text; begin
 for t in select tablename from pg_tables where schemaname='public' and rowsecurity loop
  execute format('create policy active_account_required on public.%I as restrictive to authenticated using((select public.is_active_account())) with check((select public.is_active_account()))',t.tablename);
  execute format('create trigger removed_account_write_guard before insert or update or delete on public.%I for each statement execute function public.guard_removed_account_write()',t.tablename);
 end loop;
 -- These owner-rights views intentionally bypass base RLS. Keep their original
 -- projections/tally rules and add the same viewer gate at the outer boundary.
 foreach v in array array['public_profiles','proposal_results','groups_directory'] loop
  execute format('create or replace view public.%I as select * from (%s) original where (select public.is_active_account())',v,rtrim(pg_get_viewdef(('public.'||v)::regclass,true),'; '||chr(10)));
 end loop;
end $$;
create policy active_account_required on storage.objects as restrictive to authenticated
 using((select public.is_active_account())) with check((select public.is_active_account()));
create trigger removed_account_write_guard before insert or update or delete on storage.objects
 for each statement execute function public.guard_removed_account_write();

-- A tombstone cannot be restored by stale client writes or delayed verification.
create function public.guard_removed_profile() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if old.deleted_at is not null and (new.deleted_at is distinct from old.deleted_at or new.verified or new.role<>'member') then
  raise exception 'account removed' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger removed_profile_guard before update on public.profiles
 for each row execute function public.guard_removed_profile();
revoke all on function public.guard_removed_account_write(),public.guard_removed_profile(),public.guard_removal_invitation() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
