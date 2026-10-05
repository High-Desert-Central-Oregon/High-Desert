-- Group contact consent and first-message requests. Apply BY HAND as owner,
-- after 0043 and local tests, BEFORE releasing the app. Safe to re-run.
begin;
create schema if not exists steppe_messaging_private;
revoke all on schema steppe_messaging_private from public,anon,authenticated;

alter table public.groups add column if not exists messaging_rules text;
alter table public.groups add column if not exists messaging_rules_version integer not null default 0;
do $$ begin
  alter table public.groups add constraint groups_messaging_rules_bounds check (
    messaging_rules is null or (btrim(messaging_rules)<>'' and char_length(messaging_rules)<=2000));
exception when duplicate_object then null; end $$;

-- No automatic opt-in, including existing members. Preferences disappear on
-- membership deletion, status loss, or account deletion. Only own rows readable.
create table if not exists public.group_message_preferences (
  group_id uuid not null,
  member_id uuid not null,
  acknowledged_version integer not null check(acknowledged_version>0),
  allow_requests boolean not null default false,
  acknowledged_at timestamptz not null default now(),
  primary key(group_id,member_id),
  foreign key(group_id,member_id) references public.group_members(group_id,user_id) on delete cascade
);
create index if not exists group_message_preferences_member_idx on public.group_message_preferences(member_id);
alter table public.group_message_preferences enable row level security;
revoke all on public.group_message_preferences from public,anon,authenticated;
grant select on public.group_message_preferences to authenticated;
grant all on public.group_message_preferences to service_role;
drop policy if exists gmp_own_read on public.group_message_preferences;
create policy gmp_own_read on public.group_message_preferences for select to authenticated
 using(member_id=auth.uid() and public.is_active_account());

alter table public.threads add column if not exists about_group_id uuid references public.groups(id) on delete set null;
-- Default preserves all already-established pairs. New normal pairs explicitly
-- override to pending; support remains immediately available.
alter table public.threads add column if not exists request_status text not null default 'accepted';
do $$ begin
  alter table public.threads add constraint threads_request_status check(request_status in ('pending','accepted','declined'));
exception when duplicate_object then null; end $$;

create or replace function public.set_group_messaging_rules(p_group uuid,p_rules text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_rules text:=nullif(btrim(p_rules),''); v_old text;
begin
  if not public.is_active_account() or not public.is_verified() or not public.is_group_maintainer(p_group)
    then raise exception 'Group settings unavailable'; end if;
  if char_length(v_rules)>2000 then raise exception 'Rules are too long'; end if;
  select messaging_rules into v_old from public.groups
    where id=p_group and not is_system and archived_at is null for update;
  if not found then raise exception 'Group settings unavailable'; end if;
  if v_old is distinct from v_rules then
    update public.groups set messaging_rules=v_rules,messaging_rules_version=messaging_rules_version+1 where id=p_group;
    -- Group configuration only; never a private relationship/acknowledgment log.
    perform public.log_audit('group.messaging_rules_changed','group',p_group);
  end if;
end; $$;

create or replace function public.set_group_contact_preference(p_group uuid,p_version integer,p_allow boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_version integer;
begin
  if not public.is_active_account() or not public.is_verified() or p_allow is null
    then raise exception 'Group contact unavailable'; end if;
  select messaging_rules_version into v_version from public.groups where id=p_group
    and not is_system and archived_at is null and messaging_rules is not null for share;
  if not found or p_version is distinct from v_version then raise exception 'Review the current group rules'; end if;
  perform 1 from public.group_members where group_id=p_group and user_id=auth.uid() and status='active' for share;
  if not found then raise exception 'Group contact unavailable'; end if;
  insert into public.group_message_preferences(group_id,member_id,acknowledged_version,allow_requests)
    values(p_group,auth.uid(),v_version,p_allow)
    on conflict(group_id,member_id) do update set acknowledged_version=excluded.acknowledged_version,
      allow_requests=excluded.allow_requests,acknowledged_at=now();
end; $$;

-- Turning contact off remains possible while new rules are awaiting review or
-- the group disables messaging. It does not silently acknowledge those rules.
create or replace function public.disable_group_contact(p_group uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_active_account() then raise exception 'Group contact unavailable'; end if;
  update public.group_message_preferences set allow_requests=false where group_id=p_group and member_id=auth.uid();
end; $$;

create or replace function steppe_messaging_private.clear_group_preference()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status is distinct from old.status then
    delete from public.group_message_preferences where group_id=old.group_id and member_id=old.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists clear_group_message_preference on public.group_members;
create trigger clear_group_message_preference after update of status on public.group_members
 for each row execute function steppe_messaging_private.clear_group_preference();
create or replace function steppe_messaging_private.clear_deleted_preferences()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.deleted_at is not null then delete from public.group_message_preferences where member_id=new.id; end if;
  return new;
end; $$;
drop trigger if exists clear_deleted_message_preferences on public.profiles;
create trigger clear_deleted_message_preferences after update of deleted_at on public.profiles
 for each row execute function steppe_messaging_private.clear_deleted_preferences();

-- RLS-safe roster door. Reveals eligible names only to active, verified members
-- who acknowledged this exact version. Blocks remain an indistinguishable send
-- refusal, never a roster signal. No preferences/ack times are exposed.
create or replace function public.group_message_contacts(p_group uuid)
returns table(member_id uuid,display_name text)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.display_name from public.groups g
 join public.group_message_preferences mine on mine.group_id=g.id and mine.member_id=auth.uid()
   and mine.acknowledged_version=g.messaging_rules_version
 join public.group_members me on me.group_id=g.id and me.user_id=auth.uid() and me.status='active'
 join public.profiles caller on caller.id=auth.uid() and caller.verified and caller.deleted_at is null
 join public.group_message_preferences pref on pref.group_id=g.id and pref.allow_requests
   and pref.acknowledged_version=g.messaging_rules_version
 join public.group_members gm on gm.group_id=g.id and gm.user_id=pref.member_id and gm.status='active'
 join public.profiles p on p.id=gm.user_id and p.verified and p.deleted_at is null
 where g.id=p_group and not g.is_system and g.archived_at is null and g.messaging_rules is not null
   and p.id<>auth.uid();
$$;

create or replace function public.can_send(p_thread uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.threads t
 join public.profiles a on a.id=t.member_a and a.deleted_at is null
 join public.profiles b on b.id=t.member_b and b.deleted_at is null
 where t.id=p_thread and auth.uid() in (t.member_a,t.member_b)
 and not exists(select 1 from public.member_blocks bl where
   (bl.blocker_id=t.member_a and bl.blocked_id=t.member_b) or (bl.blocker_id=t.member_b and bl.blocked_id=t.member_a))
 and ((t.support_contact_id is null and t.request_status='accepted' and a.verified and b.verified)
 or (t.support_contact_id in (t.member_a,t.member_b) and exists(
   select 1 from public.steppe_contact_settings c join public.profiles p on p.id=c.contact_id
   where c.contact_id=t.support_contact_id and p.role='admin' and p.verified and p.deleted_at is null))));
$$;

-- Enforce the one-message pending cap even through a definer RPC. Row locking
-- serializes sends/decisions; only start_contact can create a pending shell.
create or replace function steppe_messaging_private.guard_request_message()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.threads;
begin
  select * into t from public.threads where id=new.thread_id and support_contact_id is null for update;
  if not found then return new; end if; -- 0042 guard still applies
  if new.sender_id is distinct from auth.uid() or not public.is_active_account() or not public.is_verified()
    or auth.uid() not in(t.member_a,t.member_b)
    or not exists(select 1 from public.profiles p where p.id=case when t.member_a=auth.uid() then t.member_b else t.member_a end
       and p.verified and p.deleted_at is null)
    or exists(select 1 from public.member_blocks bl where
      (bl.blocker_id=t.member_a and bl.blocked_id=t.member_b) or (bl.blocker_id=t.member_b and bl.blocked_id=t.member_a))
    or (t.request_status<>'accepted' and not(t.request_status='pending' and new.sender_id=t.started_by
      and not exists(select 1 from public.messages where thread_id=t.id)))
    then raise exception 'This conversation is not available for messaging'; end if;
  return new;
end; $$;
drop trigger if exists guard_request_message on public.messages;
create trigger guard_request_message before insert on public.messages
 for each row execute function steppe_messaging_private.guard_request_message();

-- The existing conversation-menu Block action must also close a pending
-- request. No side channel identifies who blocked; no private audit is written.
create or replace function steppe_messaging_private.close_blocked_request()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.threads set request_status='declined'
 where member_a=least(new.blocker_id,new.blocked_id) and member_b=greatest(new.blocker_id,new.blocked_id)
   and support_contact_id is null and request_status='pending';
 return new;
end; $$;
drop trigger if exists close_blocked_message_request on public.member_blocks;
create trigger close_blocked_message_request after insert on public.member_blocks
 for each row execute function steppe_messaging_private.close_blocked_request();

-- Private shared implementation, invoked only after a public context RPC has
-- locked and checked consent. No caller can choose the sender, pair, or status.
create or replace function steppe_messaging_private.start_contact(p_with uuid,p_body text,p_post uuid,p_group uuid)
returns uuid language plpgsql set search_path=public,pg_temp as $$
declare v_me uuid:=auth.uid(); v_a uuid:=least(v_me,p_with); v_b uuid:=greatest(v_me,p_with); v_thread uuid;
begin
 if v_me is null or not public.is_active_account() or not public.is_verified()
   then raise exception 'Only verified members can send messages'; end if;
 if p_with=v_me then raise exception 'You cannot message yourself'; end if;
 if p_with is null then raise exception 'This conversation is not available for messaging'; end if;
 if btrim(coalesce(p_body,''))='' or char_length(p_body)>4000 then raise exception 'Write a message first'; end if;
 if not exists(select 1 from public.profiles where id=p_with and verified and deleted_at is null)
   or exists(select 1 from public.member_blocks where
     (blocker_id=v_me and blocked_id=p_with) or (blocker_id=p_with and blocked_id=v_me))
   then raise exception 'This neighbor can''t be reached right now'; end if;
 perform pg_advisory_xact_lock(hashtextextended('steppe-contact-rate:'||v_me::text,0));
 perform pg_advisory_xact_lock(hashtextextended('steppe-contact-pair:'||v_a::text||v_b::text,0));
 select id into v_thread from public.threads where member_a=v_a and member_b=v_b for update;
 if v_thread is null then
   if (select count(*) from public.threads where started_by=v_me and created_at>now()-interval '24 hours')>=10
     then raise exception 'Please try again later'; end if;
   insert into public.threads(member_a,member_b,started_by,about_post_id,about_group_id,request_status)
     values(v_a,v_b,v_me,p_post,p_group,'pending') on conflict(member_a,member_b) do nothing returning id into v_thread;
   if v_thread is null then select id into v_thread from public.threads where member_a=v_a and member_b=v_b for update; end if;
 end if;
 insert into public.thread_state(thread_id,member_id) values(v_thread,v_a),(v_thread,v_b) on conflict do nothing;
 insert into public.messages(thread_id,sender_id,body) values(v_thread,v_me,btrim(p_body));
 update public.thread_state set last_read_at=now(),left_at=null where thread_id=v_thread and member_id=v_me;
 return v_thread;
end; $$;

create or replace function public.start_thread(p_with uuid,p_body text,p_about_post uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_active_account() or not public.is_verified() then raise exception 'Only verified members can send messages'; end if;
 perform 1 from public.posts po where po.id=p_about_post and po.author_id=p_with and po.allow_messages
   and public.is_group_member(po.group_id) and not public.is_content_hidden('post',po.id) for share;
 if not found then raise exception 'This post is not available for messaging'; end if;
 return steppe_messaging_private.start_contact(p_with,p_body,p_about_post,null);
end; $$;

create or replace function public.start_group_thread(p_with uuid,p_body text,p_group uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_version integer;
begin
 if not public.is_active_account() or not public.is_verified() then raise exception 'Group contact unavailable'; end if;
 select messaging_rules_version into v_version from public.groups where id=p_group
   and not is_system and archived_at is null and messaging_rules is not null for share;
 if not found then raise exception 'Group contact unavailable'; end if;
 -- Lock in deterministic member order; consent/membership loss cannot race a send.
 perform 1 from public.group_members where group_id=p_group and user_id in(auth.uid(),p_with) and status='active'
   order by user_id for share;
 if (select count(*) from public.group_members where group_id=p_group and user_id in(auth.uid(),p_with) and status='active')<>2
   then raise exception 'Group contact unavailable'; end if;
 perform 1 from public.group_message_preferences where group_id=p_group and member_id in(auth.uid(),p_with)
   and acknowledged_version=v_version and (member_id=auth.uid() or allow_requests) order by member_id for share;
 if (select count(*) from public.group_message_preferences where group_id=p_group and member_id in(auth.uid(),p_with)
   and acknowledged_version=v_version and (member_id=auth.uid() or allow_requests))<>2
   then raise exception 'Group contact unavailable'; end if;
 return steppe_messaging_private.start_contact(p_with,p_body,null,p_group);
end; $$;

create or replace function public.respond_message_request(p_thread uuid,p_response text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.threads; v_other uuid;
begin
 if not public.is_active_account() or not public.is_verified() or p_response not in('accept','decline','block') or p_response is null
   then raise exception 'Request unavailable'; end if;
 select * into t from public.threads where id=p_thread and support_contact_id is null
   and auth.uid() in(member_a,member_b) and auth.uid()<>started_by for update;
 if not found or t.request_status<>'pending' then raise exception 'Request unavailable'; end if;
 v_other:=t.started_by;
 if p_response='accept' and (not exists(select 1 from public.profiles where id=v_other and verified and deleted_at is null)
   or exists(select 1 from public.member_blocks where
     (blocker_id=auth.uid() and blocked_id=v_other) or (blocker_id=v_other and blocked_id=auth.uid())))
   then raise exception 'Request unavailable'; end if;
 update public.threads set request_status=case when p_response='accept' then 'accepted' else 'declined' end where id=t.id;
 if p_response='block' then
   insert into public.member_blocks(blocker_id,blocked_id) values(auth.uid(),v_other) on conflict do nothing;
 end if;
 -- No message, notification, or audit row for Decline/Block.
end; $$;

-- Support deliberately bypasses requests, including a prior pending pair, while
-- preserving its first context/history. No arbitrary support recipient input.
create or replace function public.start_support_thread(p_body text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_me uuid:=auth.uid(); v_contact uuid; v_a uuid; v_b uuid; v_thread uuid;
begin
  if v_me is null or not exists(select 1 from public.profiles where id=v_me and deleted_at is null)
    then raise exception 'Contact Steppe is unavailable'; end if;
  if btrim(coalesce(p_body,''))='' or char_length(p_body)>4000
    then raise exception 'Write a message first'; end if;
  select c.contact_id into v_contact from public.steppe_contact_settings c
    join public.profiles p on p.id=c.contact_id
   where p.role='admin' and p.verified and p.deleted_at is null;
  if v_contact is null or v_contact=v_me
    or exists(select 1 from public.member_blocks where
      (blocker_id=v_me and blocked_id=v_contact) or (blocker_id=v_contact and blocked_id=v_me))
    then raise exception 'Contact Steppe is unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended('steppe-support:'||v_me::text,0));
  v_a:=least(v_me,v_contact); v_b:=greatest(v_me,v_contact);
  insert into public.threads(member_a,member_b,started_by,support_contact_id)
    values(v_a,v_b,v_me,v_contact)
    on conflict(member_a,member_b) do update set support_contact_id=excluded.support_contact_id, request_status='accepted'
    returning id into v_thread;
  insert into public.thread_state(thread_id,member_id)
    values(v_thread,v_a),(v_thread,v_b) on conflict do nothing;
  insert into public.messages(thread_id,sender_id,body) values(v_thread,v_me,btrim(p_body));
  update public.thread_state set last_read_at=now(),left_at=null where thread_id=v_thread and member_id=v_me;
  return v_thread;
end;
$$;


revoke all on all functions in schema steppe_messaging_private from public,anon,authenticated;
revoke all on function public.set_group_messaging_rules(uuid,text),public.set_group_contact_preference(uuid,integer,boolean),
 public.disable_group_contact(uuid),public.group_message_contacts(uuid),public.start_group_thread(uuid,text,uuid),
 public.respond_message_request(uuid,text),public.start_thread(uuid,text,uuid),public.can_send(uuid),public.start_support_thread(text)
 from public,anon,authenticated;
grant execute on function public.set_group_messaging_rules(uuid,text),public.set_group_contact_preference(uuid,integer,boolean),
 public.disable_group_contact(uuid),public.group_message_contacts(uuid),public.start_group_thread(uuid,text,uuid),
 public.respond_message_request(uuid,text),public.start_thread(uuid,text,uuid),public.can_send(uuid),public.start_support_thread(text)
 to authenticated;
notify pgrst,'reload schema';
commit;
