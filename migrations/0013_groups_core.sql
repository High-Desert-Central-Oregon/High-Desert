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
