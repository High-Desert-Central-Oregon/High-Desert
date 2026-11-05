-- Apply by hand after 0045 and the local security regression suite.
-- Historical audit rows are filtered in place by RLS, never rewritten.
begin;

create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_verified() and (
  exists(select 1 from public.group_members where group_id=p_group and user_id=auth.uid() and status='active')
  or exists(select 1 from public.groups where id=p_group and is_system and slug='everyone'));
$$;
create or replace function public.is_group_maintainer(p_group uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_verified() and exists(select 1 from public.group_members
  where group_id=p_group and user_id=auth.uid() and role='maintainer' and status='active');
$$;

-- Resolve group scope for all audit representations, including pin actions
-- whose entity is a post and historical metadata that outlives deleted posts.
create function public.can_read_group_audit(p_entity text,p_id uuid,p_metadata jsonb)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare g uuid;
begin
 if p_entity='group' then return public.is_group_member(p_id); end if;
 if p_metadata ? 'group_id' then
  return exists(select 1 from public.groups where id::text=p_metadata->>'group_id' and public.is_group_member(id));
 end if;
 if p_entity='post' then select group_id into g from public.posts where id=p_id;
 elsif p_entity='event' then select group_id into g from public.events where id=p_id;
 else return true;
 end if;
 return coalesce(public.is_group_member(g),false);
end; $$;
revoke all on function public.can_read_group_audit(text,uuid,jsonb) from public,anon;
grant execute on function public.can_read_group_audit(text,uuid,jsonb) to authenticated;

drop policy if exists al_read on public.audit_log;
create policy al_read on public.audit_log for select to authenticated using (
 actor_id=auth.uid() or (public.is_verified() and
  public.can_read_group_audit(entity,entity_id,metadata)));

drop policy if exists ev_read on public.events;
create policy ev_read on public.events for select to authenticated using (
 public.is_group_member(group_id) and
 (not public.is_content_hidden('event',id) or creator_id=auth.uid() or public.is_moderator()));

-- A definer helper avoids relying on a UI read or a caller's arbitrary event ID.
create function public.can_rsvp_event(p_event uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_verified() and exists(select 1 from public.events e
  where e.id=p_event and public.is_group_member(e.group_id)
   and not public.is_content_hidden('event',e.id));
$$;
revoke all on function public.can_rsvp_event(uuid) from public,anon;
grant execute on function public.can_rsvp_event(uuid) to authenticated;
drop policy if exists rs_read on public.event_rsvps;
create policy rs_read on public.event_rsvps for select to authenticated using (
 user_id=auth.uid() or public.can_rsvp_event(event_id));
drop policy if exists rs_insert on public.event_rsvps;
create policy rs_insert on public.event_rsvps for insert to authenticated
 with check(user_id=auth.uid() and public.can_rsvp_event(event_id));
drop policy if exists rs_update on public.event_rsvps;
create policy rs_update on public.event_rsvps for update to authenticated
 using(user_id=auth.uid() and public.can_rsvp_event(event_id))
 with check(user_id=auth.uid() and public.can_rsvp_event(event_id));
-- rs_delete stays self-owned, including after group departure/removal.
create function public.guard_rsvp_identity() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if new.event_id is distinct from old.event_id or new.user_id is distinct from old.user_id then
  raise exception 'RSVP identity is immutable' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function public.guard_rsvp_identity() from public,anon,authenticated;
create trigger rsvp_identity_guard before update on public.event_rsvps
 for each row execute function public.guard_rsvp_identity();
notify pgrst,'reload schema';
commit;
