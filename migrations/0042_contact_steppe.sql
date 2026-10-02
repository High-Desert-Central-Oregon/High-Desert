-- Contact Steppe: a named, participant-only support conversation, including
-- members awaiting verification. Apply BY HAND after local boundary tests.
-- No general DM exception, role-wide message read, or operator auto-enrollment.
begin;

create table if not exists public.steppe_contact_settings (
  singleton boolean primary key default true check (singleton),
  contact_id uuid not null references public.profiles(id)
);
alter table public.steppe_contact_settings enable row level security;
revoke all on public.steppe_contact_settings from public, anon, authenticated;
grant all on public.steppe_contact_settings to service_role;

-- The approved beta destination. A missing/deleted/unverified/non-admin account
-- leaves contact unavailable; it never chooses another admin automatically.
insert into public.steppe_contact_settings(singleton, contact_id)
select true, p.id from public.profiles p join auth.users u on u.id=p.id
 where lower(u.email)='greg@steppe.community'
   and p.role='admin' and p.verified and p.deleted_at is null
on conflict (singleton) do nothing;

alter table public.threads add column if not exists support_contact_id uuid
  references public.profiles(id);
do $$ begin
  alter table public.threads add constraint threads_support_inside
    check (support_contact_id is null or support_contact_id in (member_a, member_b));
exception when duplicate_object then null; end $$;
comment on column public.threads.support_contact_id is
  'Explicit Contact Steppe context. A pinned participant, not role-based read access. Existing post context and one-conversation-per-pair remain intact.';

create or replace function public.steppe_contact_status()
returns table(contact_name text, thread_id uuid, is_contact boolean)
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(nullif(p.display_name,''),'Steppe'), t.id, auth.uid()=p.id
    from public.steppe_contact_settings c
    join public.profiles p on p.id=c.contact_id
    left join public.threads t on t.support_contact_id=p.id
      and auth.uid() in (t.member_a,t.member_b)
   where auth.uid() is not null and p.role='admin' and p.verified
     and p.deleted_at is null
     and exists(select 1 from public.profiles me where me.id=auth.uid() and me.deleted_at is null)
   order by t.created_at limit 1;
$$;

create or replace function public.my_support_threads()
returns table(thread_id uuid, contact_id uuid, counterpart_name text)
language sql stable security definer set search_path=public,pg_temp as $$
  select t.id,t.support_contact_id,
    case when p.deleted_at is not null then null else p.display_name end
    from public.threads t
    join public.profiles p on p.id=case when t.member_a=auth.uid() then t.member_b else t.member_a end
   where t.support_contact_id is not null and auth.uid() in (t.member_a,t.member_b)
     and exists(select 1 from public.profiles me where me.id=auth.uid() and me.deleted_at is null);
$$;

-- Keep the existing participant/block/alive gates. Only explicitly designated
-- support threads accept an unverified participant; ordinary replies still
-- require both members verified. A contact change freezes old support sends
-- and never grants the replacement contact access to old conversations.
create or replace function public.can_send(p_thread uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists (
    select 1 from public.threads t
     join public.profiles a on a.id=t.member_a and a.deleted_at is null
     join public.profiles b on b.id=t.member_b and b.deleted_at is null
    where t.id=p_thread and auth.uid() in (t.member_a,t.member_b)
      and not exists(select 1 from public.member_blocks bl
        where (bl.blocker_id=t.member_a and bl.blocked_id=t.member_b)
           or (bl.blocker_id=t.member_b and bl.blocked_id=t.member_a))
      and (
        (t.support_contact_id is null and a.verified and b.verified)
        or (t.support_contact_id in (t.member_a,t.member_b) and exists(
          select 1 from public.steppe_contact_settings c join public.profiles p on p.id=c.contact_id
           where c.contact_id=t.support_contact_id and p.role='admin' and p.verified and p.deleted_at is null))
      )
  );
$$;

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
    on conflict(member_a,member_b) do update set support_contact_id=excluded.support_contact_id
    returning id into v_thread;
  insert into public.thread_state(thread_id,member_id)
    values(v_thread,v_a),(v_thread,v_b) on conflict do nothing;
  insert into public.messages(thread_id,sender_id,body) values(v_thread,v_me,btrim(p_body));
  update public.thread_state set last_read_at=now(),left_at=null where thread_id=v_thread and member_id=v_me;
  return v_thread;
end;
$$;

-- Limit support messages at INSERT too, so direct authenticated replies cannot
-- bypass it. Serialize per sender, including simultaneous submissions. This
-- provisional beta cap is 20 support messages per requester in a rolling day.
-- The designated contact can answer the cohort without a shared reply quota.
create or replace function public.guard_support_message()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.threads where id=new.thread_id and support_contact_id is not null) then
    if new.sender_id is distinct from auth.uid() or not public.can_send(new.thread_id)
      then raise exception 'Contact Steppe is unavailable'; end if;
    perform pg_advisory_xact_lock(hashtextextended('steppe-support:'||new.sender_id::text,0));
    if not exists(select 1 from public.threads where id=new.thread_id and support_contact_id=new.sender_id)
      and (select count(*) from public.messages m join public.threads t on t.id=m.thread_id
        where m.sender_id=new.sender_id and t.support_contact_id is not null
          and m.created_at>now()-interval '24 hours')>=20
      then raise exception 'Please try again later'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_support_message on public.messages;
create trigger trg_guard_support_message before insert on public.messages
  for each row execute function public.guard_support_message();

-- Unverified members keep the safety valves on their own support conversation.
-- These exceptions cannot be used to block arbitrary members or report posts.
drop policy if exists bl_insert on public.member_blocks;
create policy bl_insert on public.member_blocks for insert to authenticated
  with check(blocker_id=auth.uid()
    and exists(select 1 from public.profiles me where me.id=auth.uid() and me.deleted_at is null)
    and (
    public.is_verified() or exists(select 1 from public.threads t
      where t.support_contact_id is not null and auth.uid() in (t.member_a,t.member_b)
        and blocked_id=case when t.member_a=auth.uid() then t.member_b else t.member_a end)
  ));
drop policy if exists rp_insert on public.reports;
create policy rp_insert on public.reports for insert to authenticated
  with check(reporter_id=auth.uid()
    and exists(select 1 from public.profiles me where me.id=auth.uid() and me.deleted_at is null)
    and (
    (public.is_verified() and (
      (target_type='post' and exists(select 1 from public.posts where id=target_id))
      or (target_type='event' and exists(select 1 from public.events where id=target_id))
      or (target_type='message_thread' and exists(select 1 from public.threads t
        where t.id=target_id and auth.uid() in (t.member_a,t.member_b)))
    ))
    or (target_type='message_thread' and exists(select 1 from public.threads t
      where t.id=target_id and t.support_contact_id is not null and auth.uid() in (t.member_a,t.member_b)))
  ));

revoke all on function public.steppe_contact_status(), public.my_support_threads(),
  public.start_support_thread(text), public.can_send(uuid), public.guard_support_message()
  from public,anon,authenticated;
grant execute on function public.steppe_contact_status(), public.my_support_threads(),
  public.start_support_thread(text), public.can_send(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
