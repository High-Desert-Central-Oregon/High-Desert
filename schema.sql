-- ============================================================================
-- HIGH DESERT — Prototype schema.sql  (v1, June 2026)
-- Implements Build Spec v2 §03 (data model) and §04 (RLS — the constitution in code).
--
-- TARGET: a fresh Supabase project (Postgres 15+). Paste into the SQL editor, or
--         run via `supabase db push`. Idempotent-ish for a clean DB, not for re-runs.
-- ROLES:  Supabase provides `anon` (logged-out) and `authenticated` (logged-in);
--         auth.uid() = current user id; `service_role` bypasses RLS for server tasks.
--
-- DESIGN INVARIANTS BAKED IN HERE (not just in the UI):
--   • verified status, role, and tenure are server-set — never client-writable   (P18)
--   • vote WEIGHT is computed from tenure by a trigger, never trusted from client (P6)
--   • one vote per member per proposal; ballots are SECRET until close            (P6)
--   • verify, then forget: evidence pointer is dropped the instant a decision is made (P2)
--   • votes / moderation / consents / audit are APPEND-ONLY                        (P18)
--   • a human decides verifications and moderation; code only assists              (P19)
--
-- INTENTIONALLY STUBBED (see NOTES at bottom): Storage bucket + true file deletion
--   (edge function), scheduled proposal closing, transactional email.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ============================================================================
-- 1 · ENUMS
-- ============================================================================
create type verification_status as enum ('pending','approved','rejected');
create type member_role          as enum ('member','moderator','admin');
create type rsvp_status          as enum ('going','maybe');
create type proposal_kind        as enum ('minor','major','immutable');
create type proposal_status      as enum ('draft','open','closed');
create type vote_choice          as enum ('yes','no','abstain');
create type mod_action           as enum ('warn','temp_ban','extended_ban','review');
create type appeal_status        as enum ('open','upheld','overturned');
create type doc_kind             as enum ('terms','privacy');

-- ============================================================================
-- 2 · TABLES
-- ============================================================================

create table neighborhoods (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text
);

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text not null default 'New member',
  neighborhood_id uuid references neighborhoods(id),
  verified        boolean not null default false,   -- true only after a human approves residency
  role            member_role not null default 'member',
  tenure_start    date,                              -- set once, on first approval; drives vote weight
  locale          text not null default 'en',
  created_at      timestamptz not null default now()
);

create table verifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  method        text not null,            -- 'id'|'utility_bill'|'voter_reg'|'property_record'|'postcard_code'
  status        verification_status not null default 'pending',
  evidence_path text,                      -- path in PRIVATE 'verification-evidence' bucket; NULLed on decision
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table documents (
  id           uuid primary key default gen_random_uuid(),
  kind         doc_kind not null,
  version      text not null,
  body         text not null,
  published_at timestamptz not null default now(),
  unique (kind, version)
);

create table consents (                    -- append-only
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  document_id uuid not null references documents(id),
  accepted_at timestamptz not null default now(),
  unique (user_id, document_id)
);

create table events (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references profiles(id) on delete cascade,
  neighborhood_id uuid references neighborhoods(id),
  title           text not null,
  body            text,
  starts_at       timestamptz not null,
  location        text,
  capacity        int,
  status          text not null default 'active',   -- 'active' | 'cancelled'
  created_at      timestamptz not null default now()
);

create table event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  status     rsvp_status not null default 'going',
  bringing   text,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)              -- light coordination only; one row per member per event
);

create table proposals (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references profiles(id) on delete set null,
  title      text not null,
  body       text,
  kind       proposal_kind not null default 'minor',
  status     proposal_status not null default 'open',
  opens_at   timestamptz not null default now(),
  closes_at  timestamptz not null,
  created_at timestamptz not null default now()
);

create table votes (                       -- append-only; SECRET (no member-facing select policy)
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  choice      vote_choice not null,
  weight      numeric(3,1) not null default 1.0,    -- set by trigger from tenure; never client-supplied
  created_at  timestamptz not null default now(),
  unique (proposal_id, user_id)            -- hard guarantee of one vote per member per proposal
);

create table moderation_actions (          -- append-only; public for transparency (uuids only)
  id          uuid primary key default gen_random_uuid(),
  target_type text not null,               -- 'profile' | 'event' | 'rsvp' | ...
  target_id   uuid not null,
  actor_id    uuid not null references profiles(id),
  action      mod_action not null,
  reason      text,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table appeals (
  id                   uuid primary key default gen_random_uuid(),
  moderation_action_id uuid not null references moderation_actions(id) on delete cascade,
  user_id              uuid not null references profiles(id) on delete cascade,
  body                 text not null,
  status               appeal_status not null default 'open',
  created_at           timestamptz not null default now()
);

create table audit_log (                    -- append-only; public for transparency (uuids only)
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles(id),
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3 · HELPERS  (SECURITY DEFINER so they bypass RLS and never cause policy recursion)
-- ============================================================================
create or replace function public.is_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and verified);
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('moderator','admin'));
$$;

create or replace function public.vote_weight_for(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when tenure_start is null                                  then 1.0
    when tenure_start > current_date - interval '1 year'       then 1.0   -- Year 1
    when tenure_start > current_date - interval '2 years'      then 1.2   -- Year 2
    else 1.5                                                              -- Year 3+
  end
  from profiles where id = p_user;
$$;

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id uuid, p_metadata jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_log(actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata,'{}'::jsonb));
$$;

-- ============================================================================
-- 4 · TRIGGERS  (the integrity guarantees)
-- ============================================================================

-- New auth user -> profile row (starts unverified, role 'member')
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'display_name','New member'),
          coalesce(new.raw_user_meta_data->>'locale','en'));
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A member editing their own profile cannot change verified / role / tenure
create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = new.id then
    new.verified     := old.verified;
    new.role         := old.role;
    new.tenure_start := old.tenure_start;
  end if;
  return new;
end; $$;
create trigger trg_guard_profile_columns
  before update on profiles
  for each row execute function public.guard_profile_columns();

-- Vote weight + voter id are set server-side, never trusted from the client
create or replace function public.set_vote_weight()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.weight  := coalesce(public.vote_weight_for(auth.uid()), 1.0);
  return new;
end; $$;
create trigger trg_set_vote_weight
  before insert on votes
  for each row execute function public.set_vote_weight();

-- Verify, then forget: drop the evidence pointer the instant a decision is recorded
create or replace function public.purge_verification_evidence()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.evidence_path := null;
  -- The actual Storage object is removed by an edge function keyed on this id
  -- (Postgres can't reliably delete a Storage object inline). See NOTES.
  return new;
end; $$;
create trigger trg_purge_evidence
  before update of status on verifications
  for each row when (new.status in ('approved','rejected'))
  execute function public.purge_verification_evidence();

-- Moderation action -> audit entry
create or replace function public.log_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_audit('moderation.' || new.action, new.target_type, new.target_id,
                           jsonb_build_object('reason', new.reason));
  return new;
end; $$;
create trigger trg_log_moderation
  after insert on moderation_actions
  for each row execute function public.log_moderation();

-- ============================================================================
-- 5 · MODERATOR ACTION: decide a verification (human-in-the-loop)
--     Sets tenure_start once, on first approval; writes audit; purge trigger fires.
-- ============================================================================
create or replace function public.decide_verification(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_moderator() then
    raise exception 'only moderators may decide verifications';
  end if;

  update verifications
     set status      = case when p_approve then 'approved' else 'rejected' end::verification_status,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id
   returning user_id into v_user;

  if p_approve then
    update profiles
       set verified     = true,
           tenure_start = coalesce(tenure_start, current_date)
     where id = v_user;
  end if;

  perform public.log_audit(
    case when p_approve then 'verification.approved' else 'verification.rejected' end,
    'verification', p_id, '{}'::jsonb);
end; $$;

-- ============================================================================
-- 6 · VIEW: proposal_results  (aggregate, weighted, SECRET UNTIL CLOSE)
--     Owned by the migration role, so it reads votes past RLS to aggregate —
--     but only ever exposes proposals that are closed.
-- ============================================================================
create or replace view proposal_results as
select
  p.id as proposal_id, p.title, p.kind, p.status, p.closes_at,
  count(v.id)                                                       as ballots,
  coalesce(sum(case when v.choice='yes'     then v.weight end),0)   as yes_weight,
  coalesce(sum(case when v.choice='no'      then v.weight end),0)   as no_weight,
  coalesce(sum(case when v.choice='abstain' then v.weight end),0)   as abstain_weight
from proposals p
left join votes v on v.proposal_id = p.id
where p.status = 'closed' or now() > p.closes_at
group by p.id;

-- ============================================================================
-- 7 · ROW-LEVEL SECURITY
-- ============================================================================
alter table neighborhoods      enable row level security;
alter table profiles           enable row level security;
alter table verifications      enable row level security;
alter table documents          enable row level security;
alter table consents           enable row level security;
alter table events             enable row level security;
alter table event_rsvps        enable row level security;
alter table proposals          enable row level security;
alter table votes              enable row level security;
alter table moderation_actions enable row level security;
alter table appeals            enable row level security;
alter table audit_log          enable row level security;

-- Public reference data
create policy nb_read  on neighborhoods for select to anon, authenticated using (true);
create policy doc_read on documents     for select to anon, authenticated using (true);

-- Profiles: anyone logged-in can read; you may edit only your own row
-- (protected columns are frozen by trg_guard_profile_columns). Inserts happen via
-- the signup trigger (security definer), so no insert policy is needed.
create policy pf_read   on profiles for select to authenticated using (true);
create policy pf_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Verifications: see your own (+ moderators see all); submit your own as 'pending';
-- moderators update status (normally via decide_verification()).
create policy vf_read   on verifications for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy vf_insert on verifications for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy vf_update on verifications for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- Consents: your own; append-only (no update/delete policy)
create policy cs_read   on consents for select to authenticated using (user_id = auth.uid());
create policy cs_insert on consents for insert to authenticated with check (user_id = auth.uid());

-- Events: verified members read; verified members create; creator or moderator edits
create policy ev_read   on events for select to authenticated using (public.is_verified());
create policy ev_insert on events for insert to authenticated
  with check (public.is_verified() and creator_id = auth.uid());
create policy ev_update on events for update to authenticated
  using (creator_id = auth.uid() or public.is_moderator())
  with check (creator_id = auth.uid() or public.is_moderator());
create policy ev_delete on events for delete to authenticated
  using (creator_id = auth.uid() or public.is_moderator());

-- RSVPs: verified members read; manage your own
create policy rs_read   on event_rsvps for select to authenticated using (public.is_verified());
create policy rs_insert on event_rsvps for insert to authenticated
  with check (public.is_verified() and user_id = auth.uid());
create policy rs_update on event_rsvps for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rs_delete on event_rsvps for delete to authenticated using (user_id = auth.uid());

-- Proposals: verified members read & open; status transitions by moderators (or a scheduled job)
create policy pr_read   on proposals for select to authenticated using (public.is_verified());
create policy pr_insert on proposals for insert to authenticated
  with check (public.is_verified() and author_id = auth.uid());
create policy pr_update on proposals for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- Votes: INSERT only — verified, proposal open, not already voted. No select policy => SECRET.
-- (user_id + weight are overwritten by trg_set_vote_weight; unique constraint is the hard guard.)
create policy vt_insert on votes for insert to authenticated
  with check (
    public.is_verified()
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
    and not exists (select 1 from votes v
                where v.proposal_id = proposal_id and v.user_id = auth.uid())
  );

-- Moderation: public read (transparency); moderators insert; append-only
create policy mod_read   on moderation_actions for select to authenticated using (true);
create policy mod_insert on moderation_actions for insert to authenticated
  with check (public.is_moderator() and actor_id = auth.uid());

-- Appeals: your own (+ moderators); you file; moderators resolve
create policy ap_read   on appeals for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy ap_insert on appeals for insert to authenticated with check (user_id = auth.uid());
create policy ap_update on appeals for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- Audit log: public read (transparency); writes only via log_audit() (security definer)
create policy al_read on audit_log for select to authenticated using (true);

-- ============================================================================
-- 8 · GRANTS  (RLS still gates every row; these are the table-level privileges
--     PostgREST needs. Supabase usually manages these — included for portability.)
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select on neighborhoods, documents, proposal_results to anon, authenticated;
grant select, insert, update, delete on
  profiles, verifications, consents, events, event_rsvps,
  proposals, votes, moderation_actions, appeals, audit_log
  to authenticated;

-- ============================================================================
-- 9 · SEED — Redmond neighborhoods (35; from the Enjoy Bend Life map; Wildflower corrected)
--     Eagle Crest is a resort outside city limits — delete the last row to exclude it.
-- ============================================================================
insert into neighborhoods (slug, name) values
  ('braydon-park','Braydon Park'),
  ('canyon-crossing','Canyon Crossing'),
  ('canyon-rim-village','Canyon Rim Village'),
  ('cascade-view-estates','Cascade View Estates'),
  ('cascade-west','Cascade West'),
  ('cinder-butte-village','Cinder Butte Village'),
  ('deer-crossing','Deer Crossing'),
  ('diamond-bar-ranch','Diamond Bar Ranch'),
  ('echo-rim-estates','Echo Rim Estates'),
  ('emerald-view-estates','Emerald View Estates'),
  ('evansville','Evansville'),
  ('fieldstone','Fieldstone'),
  ('greens-at-redmond','Greens at Redmond'),
  ('maple-meadows','Maple Meadows'),
  ('maplewood','Maplewood'),
  ('mckenzie-rim-estates','McKenzie Rim Estates'),
  ('meadowbrook-estates','Meadowbrook Estates'),
  ('megan-park','Megan Park'),
  ('mountain-glenn','Mountain Glenn'),
  ('north-rim','North Rim'),
  ('obsidian-trails','Obsidian Trails'),
  ('pine-tree-meadows','Pine Tree Meadows'),
  ('pleasant-view','Pleasant View'),
  ('red-bar-estates','Red-Bar Estates'),
  ('red-hawk','Red Hawk'),
  ('rimrock-west-estate','Rimrock West Estate'),
  ('sterling-pointe','Sterling Pointe'),
  ('summit-crest','Summit Crest'),
  ('triple-ridge','Triple Ridge'),
  ('village-at-ridgeview','Village at Ridgeview'),
  ('vista-meadows','Vista Meadows'),
  ('west-canyon-estates','West Canyon Estates'),
  ('wildflower','Wildflower'),
  ('windsong','Windsong'),
  ('eagle-crest','Eagle Crest');           -- ⚑ outside city limits — remove if excluding

-- ============================================================================
-- 10 · SEED — Terms & Privacy (placeholder bodies; replace with the final text)
-- ============================================================================
insert into documents (kind, version, body) values
  ('terms','0.1',
   'PLACEHOLDER — replace with the final plain-language Terms of Membership '
   '(companion: highdesert-terms-privacy-v1). Pending Oregon legal review.'),
  ('privacy','0.1',
   'PLACEHOLDER — replace with the final plain-language Privacy Policy '
   '(companion: highdesert-terms-privacy-v1). Pending Oregon legal review.');

-- ============================================================================
-- NOTES — what to do alongside this file
-- ----------------------------------------------------------------------------
-- • Make yourself an admin (so you can review verifications):
--     update profiles set role = 'admin' where id = '<your-auth-user-id>';
--
-- • STORAGE: create a PRIVATE bucket named 'verification-evidence', then add:
--     create policy "evidence upload (own folder)" on storage.objects
--       for insert to authenticated
--       with check (bucket_id = 'verification-evidence'
--                   and (storage.foldername(name))[1] = auth.uid()::text);
--     create policy "evidence read (moderators)" on storage.objects
--       for select to authenticated
--       using (bucket_id = 'verification-evidence' and public.is_moderator());
--   An edge function deletes the object when decide_verification() runs
--   (verify-then-forget — the DB drops the pointer; the function drops the file).
--
-- • SCHEDULED: a cron/edge function flips proposals open -> closed at closes_at
--   (or a moderator closes one). proposal_results only shows closed proposals.
--
-- • Casting a vote (client): insert { proposal_id, choice } only — the trigger sets
--   user_id and weight. Reading results: select from proposal_results.
-- ============================================================================
