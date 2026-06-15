-- ============================================================================
-- Migration 0013 — Groups core (Spec v2 §1/§6; build phase 1a, secure backend)
-- ----------------------------------------------------------------------------
-- The community-hub container: categories, groups (visibility × join_policy),
-- and group_members (role × status). This file is built in two commits that both
-- land in 0013 (no env has applied it yet):
--   Part 1 (this section) — enums, tables, membership helpers, seeds. RLS is
--     ENABLED immediately with NO policies, so the tables are default-DENY (safe)
--     until Part 2 adds the policies + RPCs. Nothing is readable/writable yet.
--   Part 2 (below)        — RLS policies, the directory view, grants, and the
--     security-definer RPCs (status/role are never client-forgeable — G8–G10/G12).
--
-- Stays inside the verified-only read model (no anon/public reads — G6/G7 are
-- phase 2). New invariants: G8 (membership-scoped reads), G9 (maintainer scoping),
-- G10 (join-policy enforcement), G12 (cross-group isolation), G13 (audit coverage).
-- Folded into schema.sql. Safe to re-run.
-- ============================================================================

-- 1 · ENUMS (idempotent)
do $$ begin create type group_visibility    as enum ('public','members_only'); exception when duplicate_object then null; end $$;
do $$ begin create type group_join_policy   as enum ('open','request','locked'); exception when duplicate_object then null; end $$;
do $$ begin create type group_member_role   as enum ('maintainer','member');    exception when duplicate_object then null; end $$;
do $$ begin create type group_member_status as enum ('active','pending','invited'); exception when duplicate_object then null; end $$;

-- 2 · TABLES
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  created_by uuid references profiles(id),     -- null for the seeded taxonomy
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  category_id uuid references categories(id),
  visibility  group_visibility  not null default 'members_only',
  join_policy group_join_policy not null default 'request',
  is_system   boolean not null default false,  -- the built-in Everyone group
  created_by  uuid references profiles(id),     -- null for system groups
  created_at  timestamptz not null default now(),
  archived_at timestamptz                       -- soft-delete; there is no hard DELETE
);

create table if not exists group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       group_member_role   not null default 'member',
  status     group_member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- 3 · HELPERS (mirror is_verified()'s shape — sql stable security definer, so they
--     read group_members past RLS and never cause policy recursion).
-- is_group_member: an ACTIVE member of the group, OR — for the built-in Everyone
-- group, whose membership is implicit (never materialized) — any verified member.
create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members gm
                  where gm.group_id = p_group and gm.user_id = auth.uid()
                    and gm.status = 'active')
      or exists (select 1 from groups g
                  where g.id = p_group and g.is_system and g.slug = 'everyone'
                    and public.is_verified());
$$;

-- is_group_maintainer: an ACTIVE maintainer of the group.
create or replace function public.is_group_maintainer(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members gm
                  where gm.group_id = p_group and gm.user_id = auth.uid()
                    and gm.role = 'maintainer' and gm.status = 'active');
$$;

-- 4 · ROW-LEVEL SECURITY — enable now, default-DENY until Part 2 adds policies.
alter table categories    enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;

-- 5 · SEED — the §6 category taxonomy (12) + the built-in Everyone group.
insert into categories (slug, name) values
  ('neighborhood-place',  'Neighborhood & Place'),
  ('housing-rentals',     'Housing & Rentals'),
  ('pets-sitting',        'Pets & Sitting'),
  ('buy-sell-trade-free', 'Buy / Sell / Trade / Free'),
  ('help-mutual-aid',     'Help & Mutual Aid'),
  ('services-skills',     'Services & Skills'),
  ('civic-government',    'Civic & Government'),
  ('families-schools',    'Families & Schools'),
  ('interests-hobbies',   'Interests & Hobbies'),
  ('health-wellbeing',    'Health & Wellbeing'),
  ('arts-culture',        'Arts & Culture'),
  ('events-happenings',   'Events & Happenings')
on conflict (slug) do nothing;

-- The Everyone group: system-owned, public, every verified member belongs
-- implicitly (no materialized membership rows — see is_group_member). Its calendar
-- /board is the community-wide surface (Spec §1).
insert into groups (slug, name, description, category_id, visibility, join_policy, is_system, created_by)
values ('everyone', 'Everyone',
        'The community-wide board and calendar. Every verified member is here.',
        null, 'public', 'open', true, null)
on conflict (slug) do nothing;

-- ============================================================================
-- Migration 0013 — Groups core · PART 2: RLS policies, directory view, RPCs
-- ----------------------------------------------------------------------------
-- Reads: a verified member sees public groups fully and members_only groups only
-- as an active member (G8/G12). groups_directory mirrors the public_profiles idiom
-- (owner-rights view, limited columns) so members_only groups are listed by name +
-- category + member count, with descriptions/rosters gated. ALL writes go through
-- the security-definer RPCs below — there are NO insert/update/delete policies, so
-- status/role can never be client-forged (G8-G10/G12). Every state change writes
-- an audit entry (G13). No DELETE on groups (archive via archived_at). Safe to re-run.
-- ============================================================================

-- ---- RLS policies (reads only) ---------------------------------------------
drop policy if exists cat_read on categories;
create policy cat_read on categories for select to authenticated
  using (public.is_verified());

drop policy if exists grp_read on groups;
create policy grp_read on groups for select to authenticated
  using (public.is_verified() and (visibility = 'public' or public.is_group_member(id)));

drop policy if exists gm_read on group_members;
create policy gm_read on group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id));

-- ---- Directory view (owner-rights; mirrors public_profiles) -----------------
-- Limited, directory-safe columns for ALL groups to any verified member: name,
-- category, visibility, join_policy, member count. description ONLY for public
-- groups; members_only descriptions/rosters stay gated (G8).
create or replace view groups_directory as
  select g.id, g.slug, g.name, g.category_id, g.visibility, g.join_policy,
         g.is_system, g.created_at, g.archived_at,
         case when g.visibility = 'public' then g.description end as description,
         (select count(*) from group_members gm
           where gm.group_id = g.id and gm.status = 'active') as member_count
  from groups g
  where public.is_verified();

-- ---- Grants (reads only; writes are RPC-only) ------------------------------
grant select on categories, groups, group_members, groups_directory to authenticated;

-- ---- RPCs (security definer, verified/maintainer-gated, audit-writing) ------
-- create_group: creator becomes the first active maintainer.
create or replace function public.create_group(
  p_name text, p_slug text, p_description text,
  p_category_id uuid, p_visibility group_visibility, p_join_policy group_join_policy)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_group uuid;
begin
  if not public.is_verified() then raise exception 'only verified members may create groups'; end if;
  if p_name is null or length(btrim(p_name)) = 0 then raise exception 'a group name is required'; end if;
  if p_slug is null or length(btrim(p_slug)) = 0 then raise exception 'a group slug is required'; end if;

  insert into groups (slug, name, description, category_id, visibility, join_policy, is_system, created_by)
  values (lower(btrim(p_slug)), btrim(p_name), p_description, p_category_id,
          coalesce(p_visibility,'members_only'), coalesce(p_join_policy,'request'), false, v_uid)
  returning id into v_group;

  insert into group_members (group_id, user_id, role, status)
  values (v_group, v_uid, 'maintainer', 'active');

  perform public.log_audit('group.created', 'group', v_group,
    jsonb_build_object('slug', lower(btrim(p_slug)),
                       'visibility', coalesce(p_visibility,'members_only'),
                       'join_policy', coalesce(p_join_policy,'request')));
  return v_group;
end; $$;

-- join_group: open -> active; request -> pending; locked -> rejected (G10).
create or replace function public.join_group(p_group uuid)
returns group_member_status language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_policy group_join_policy; v_system boolean;
        v_archived timestamptz; v_status group_member_status;
begin
  if not public.is_verified() then raise exception 'only verified members may join groups'; end if;

  select join_policy, is_system, archived_at into v_policy, v_system, v_archived
    from groups where id = p_group;
  if v_policy is null then raise exception 'group not found'; end if;
  if v_archived is not null then raise exception 'this group is archived'; end if;
  if v_system then raise exception 'membership in the Everyone group is automatic'; end if;

  if exists (select 1 from group_members where group_id = p_group and user_id = v_uid) then
    raise exception 'you already have a membership or pending request for this group';
  end if;
  if v_policy = 'locked' then
    raise exception 'this group is invite-only; a maintainer must add you';
  end if;

  v_status := case when v_policy = 'open' then 'active' else 'pending' end::group_member_status;
  insert into group_members (group_id, user_id, role, status)
  values (p_group, v_uid, 'member', v_status);

  perform public.log_audit(
    case when v_status = 'active' then 'group.joined' else 'group.join_requested' end,
    'group', p_group, jsonb_build_object('status', v_status));
  return v_status;
end; $$;

-- leave_group: remove own membership; refuse if sole active maintainer.
create or replace function public.leave_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role group_member_role; v_status group_member_status;
begin
  select role, status into v_role, v_status
    from group_members where group_id = p_group and user_id = v_uid;
  if v_role is null then raise exception 'you are not a member of this group'; end if;
  if v_role = 'maintainer' and v_status = 'active'
     and (select count(*) from group_members
            where group_id = p_group and role = 'maintainer' and status = 'active') = 1 then
    raise exception 'you are the only maintainer; assign another before leaving';
  end if;
  delete from group_members where group_id = p_group and user_id = v_uid;
  perform public.log_audit('group.left', 'group', p_group, '{}'::jsonb);
end; $$;

-- Maintainer actions — each requires is_group_maintainer(p_group), acting ONLY on
-- p_group (G9, G12). status/role are set here, never by the client (G8-G10/G12).
create or replace function public.approve_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_maintainer(p_group) then
    raise exception 'only a maintainer of this group may approve members'; end if;
  update group_members set status = 'active'
   where group_id = p_group and user_id = p_user and status in ('pending','invited');
  if not found then raise exception 'no pending request for that member in this group'; end if;
  perform public.log_audit('group.member_approved', 'group', p_group,
    jsonb_build_object('user_id', p_user));
end; $$;

create or replace function public.deny_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_maintainer(p_group) then
    raise exception 'only a maintainer of this group may deny requests'; end if;
  delete from group_members
   where group_id = p_group and user_id = p_user and status in ('pending','invited');
  if not found then raise exception 'no pending request for that member in this group'; end if;
  perform public.log_audit('group.member_denied', 'group', p_group,
    jsonb_build_object('user_id', p_user));
end; $$;

create or replace function public.remove_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_maintainer(p_group) then
    raise exception 'only a maintainer of this group may remove members'; end if;
  if p_user = auth.uid() then raise exception 'use leave_group to remove yourself'; end if;
  if exists (select 1 from group_members
               where group_id = p_group and user_id = p_user
                 and role = 'maintainer' and status = 'active')
     and (select count(*) from group_members
            where group_id = p_group and role = 'maintainer' and status = 'active') = 1 then
    raise exception 'cannot remove the only maintainer'; end if;
  delete from group_members where group_id = p_group and user_id = p_user;
  if not found then raise exception 'that member is not in this group'; end if;
  perform public.log_audit('group.member_removed', 'group', p_group,
    jsonb_build_object('user_id', p_user));
end; $$;

-- add_member: maintainer adds a verified member directly (the locked-group path).
create or replace function public.add_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_maintainer(p_group) then
    raise exception 'only a maintainer of this group may add members'; end if;
  if not exists (select 1 from profiles where id = p_user and verified and deleted_at is null) then
    raise exception 'can only add a verified member'; end if;
  insert into group_members (group_id, user_id, role, status)
  values (p_group, p_user, 'member', 'active')
  on conflict (group_id, user_id) do update set status = 'active';
  perform public.log_audit('group.member_added', 'group', p_group,
    jsonb_build_object('user_id', p_user));
end; $$;

-- set_member_role: maintainer-only; refuse demoting the last maintainer.
create or replace function public.set_member_role(p_group uuid, p_user uuid, p_role group_member_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_maintainer(p_group) then
    raise exception 'only a maintainer of this group may change roles'; end if;
  if p_role = 'member'
     and exists (select 1 from group_members
                   where group_id = p_group and user_id = p_user
                     and role = 'maintainer' and status = 'active')
     and (select count(*) from group_members
            where group_id = p_group and role = 'maintainer' and status = 'active') = 1 then
    raise exception 'cannot demote the last maintainer'; end if;
  update group_members set role = p_role
   where group_id = p_group and user_id = p_user and status = 'active';
  if not found then raise exception 'that active member is not in this group'; end if;
  perform public.log_audit('group.role_set', 'group', p_group,
    jsonb_build_object('user_id', p_user, 'role', p_role));
end; $$;

-- update_group_settings: maintainer-only (G9); the Everyone system group is fixed.
create or replace function public.update_group_settings(
  p_group uuid, p_name text, p_description text, p_category_id uuid,
  p_visibility group_visibility, p_join_policy group_join_policy)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_maintainer(p_group) then
    raise exception 'only a maintainer of this group may edit its settings'; end if;
  if exists (select 1 from groups where id = p_group and is_system) then
    raise exception 'the Everyone group cannot be reconfigured'; end if;
  update groups set
    name        = coalesce(nullif(btrim(p_name), ''), name),
    description = coalesce(p_description, description),
    category_id = coalesce(p_category_id, category_id),
    visibility  = coalesce(p_visibility, visibility),
    join_policy = coalesce(p_join_policy, join_policy)
  where id = p_group;
  perform public.log_audit('group.settings_updated', 'group', p_group, '{}'::jsonb);
end; $$;

-- suggest_category: any verified member; dedupe on slug (returns the existing id).
create or replace function public.suggest_category(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_slug text; v_id uuid;
begin
  if not public.is_verified() then raise exception 'only verified members may suggest categories'; end if;
  if p_name is null or length(btrim(p_name)) = 0 then raise exception 'a category name is required'; end if;
  v_slug := btrim(regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'), '-');
  if v_slug = '' then raise exception 'invalid category name'; end if;

  select id into v_id from categories where slug = v_slug;
  if v_id is not null then return v_id; end if;          -- dedupe: return existing

  insert into categories (slug, name, created_by) values (v_slug, btrim(p_name), v_uid)
  on conflict (slug) do nothing
  returning id into v_id;
  if v_id is null then                                   -- lost a concurrent race
    select id into v_id from categories where slug = v_slug;
    return v_id;
  end if;
  perform public.log_audit('category.suggested', 'category', v_id,
    jsonb_build_object('slug', v_slug));
  return v_id;
end; $$;
