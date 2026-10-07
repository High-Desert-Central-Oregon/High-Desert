-- Apply BY HAND as owner after 0044 and local verification, before app release.
-- Archive is a lifecycle change, never deletion; personal history remains readable.
begin;
create schema if not exists steppe_groups_private;
revoke all on schema steppe_groups_private from public, anon, authenticated;

create or replace function public.archive_group(p_group uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_group public.groups%rowtype;
begin
  if not public.is_active_account() or not public.is_verified() then
    raise exception 'Group unavailable';
  end if;
  select * into v_group from public.groups where id=p_group for update;
  if not found or v_group.is_system then raise exception 'Group unavailable'; end if;
  perform 1 from public.group_members where group_id=p_group and user_id=auth.uid()
    and role='maintainer' and status='active' for share;
  if not found then raise exception 'Group unavailable'; end if;
  if v_group.archived_at is not null then return; end if;
  update public.groups set archived_at=now() where id=p_group;
  perform public.log_audit('group.archived','group',p_group);
end; $$;
revoke all on function public.archive_group(uuid) from public,anon;
grant execute on function public.archive_group(uuid) to authenticated;

-- Existing RPCs enforce membership/author rights. This private trigger adds the
-- lifecycle gate beneath stale forms and direct writes. SHARE locks serialize
-- new participation with archive_group's group-row lock. DELETE stays available
-- for leaving, account removal and deleting one's own data.
create or replace function steppe_groups_private.require_open_group()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.groups where id=new.group_id and archived_at is null for share;
  if not found then raise exception 'Group unavailable'; end if;
  return new;
end; $$;
revoke all on function steppe_groups_private.require_open_group() from public,anon,authenticated;
drop trigger if exists zz_require_open_group on public.group_members;
create trigger zz_require_open_group before insert or update on public.group_members
  for each row execute function steppe_groups_private.require_open_group();
drop trigger if exists zz_require_open_group on public.posts;
create trigger zz_require_open_group before insert on public.posts
  for each row execute function steppe_groups_private.require_open_group();
-- Runs after default_event_group for inserts that omit the Everyone group ID.
drop trigger if exists zz_require_open_group on public.events;
create trigger zz_require_open_group before insert on public.events
  for each row execute function steppe_groups_private.require_open_group();

-- Preserve the existing settings RPC contract, but reject stale archived forms.
create or replace function public.update_group_settings(
  p_group uuid,p_name text,p_description text,p_category_id uuid,
  p_visibility public.group_visibility,p_join_policy public.group_join_policy)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_active_account() or not public.is_verified() then raise exception 'Group unavailable'; end if;
  perform 1 from public.groups where id=p_group and not is_system and archived_at is null for update;
  if not found or not public.is_group_maintainer(p_group) then raise exception 'Group unavailable'; end if;
  update public.groups set
    name=coalesce(nullif(btrim(p_name),''),name),
    description=coalesce(p_description,description),
    category_id=coalesce(p_category_id,category_id),
    visibility=coalesce(p_visibility,visibility),
    join_policy=coalesce(p_join_policy,join_policy)
  where id=p_group;
  perform public.log_audit('group.settings_updated','group',p_group);
end; $$;
revoke all on function public.update_group_settings(uuid,text,text,uuid,public.group_visibility,public.group_join_policy) from public,anon;
grant execute on function public.update_group_settings(uuid,text,text,uuid,public.group_visibility,public.group_join_policy) to authenticated;
commit;
