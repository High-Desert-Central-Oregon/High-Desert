-- ============================================================================
-- STEPPE — Prototype schema.sql  (v1, June 2026)
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
-- SETUP STILL NEEDED (see NOTES at bottom): create the private Storage bucket +
--   its policies, enable pg_cron for the scheduled close, wire transactional email.
-- (Evidence file deletion and the scheduled close are IMPLEMENTED — in the
--  decideVerification server action and close_due_proposals()/pg_cron respectively.)
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
create type mod_action           as enum ('warn','temp_ban','extended_ban','review','remove','restore');
create type appeal_status        as enum ('open','upheld','overturned');
create type doc_kind             as enum ('terms','privacy');
create type neighborhood_request_status as enum ('open','resolved');

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
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz                        -- set when the member deletes their account; row kept as a scrubbed tombstone to anchor the append-only record
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

create table neighborhood_requests (      -- "none of the listed neighborhoods fit" queue
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  note        text,                         -- optional, member-supplied: where they actually live
  status      neighborhood_request_status not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,                  -- stamped server-side on resolution (trigger), never by client
  resolved_by uuid references profiles(id)  -- the member (if they later picked) or the moderator who closed it
);
-- At most one OPEN request per member; resolved ones are kept as light history.
create unique index neighborhood_requests_one_open_per_user
  on neighborhood_requests (user_id) where (status = 'open');

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

create table votes (                       -- SECRET ballot; one row per member, revisable only while open
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  choice      vote_choice not null,
  weight      numeric(3,1) not null default 1.0,    -- set by trigger from tenure; never client-supplied
  created_at  timestamptz not null default now(),
  unique (proposal_id, user_id)            -- hard guarantee of one vote per member per proposal
);
-- A member may overwrite their OWN ballot while the proposal is open; at close it
-- freezes permanently (enforced in the policies below). A member reads only their
-- own ballot — never anyone else's. No delete. (Invariant 6 amended; see
-- DECISIONS.md 2026-06-09. The audit log stays strictly append-only.)

create table moderation_actions (          -- append-only; public for transparency (uuids only)
  id          uuid primary key default gen_random_uuid(),
  target_type text not null,               -- 'event' | 'proposal' | 'profile' | ...
  target_id   uuid not null,
  actor_id    uuid not null references profiles(id),
  action      mod_action not null,         -- content: 'remove' hides, 'restore' un-hides (a reversal is a NEW row)
  reason      text,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  -- No silent removal: content actions must carry a written reason.
  constraint moderation_reason_required
    check (action not in ('remove','restore')
           or (reason is not null and length(btrim(reason)) > 0))
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
  select exists (select 1 from profiles
                  where id = auth.uid() and verified and deleted_at is null);
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                  where id = auth.uid() and role in ('moderator','admin') and deleted_at is null);
$$;

-- Tenure vote-weight: Business Plan v11's 1×–3× range. Provisional config the
-- cohort ratifies like the other governance numbers; brackets by how long ago
-- tenure_start was. Change here + migration + seed/dry-run-accounts.sql + the
-- dry-run runbook together (the test math depends on these exact numbers).
create or replace function public.vote_weight_for(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when tenure_start is null                                  then 1.0
    when tenure_start > current_date - interval '1 year'       then 1.0   -- < 1 yr
    when tenure_start > current_date - interval '2 years'      then 1.5   -- 1–2 yr
    when tenure_start > current_date - interval '4 years'      then 2.0   -- 2–4 yr
    else 3.0                                                              -- 4 yr+
  end
  from profiles where id = p_user;
$$;

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id uuid, p_metadata jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_log(actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata,'{}'::jsonb));
$$;

-- Is a piece of content currently hidden? True iff its LATEST remove/restore
-- moderation action is a 'remove'. Used in the votes RLS and proposal_results so
-- moderation state is DB-authoritative, not just enforced in the UI.
create or replace function public.is_content_hidden(p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.action = 'remove'
       from moderation_actions m
      where m.target_type = p_type and m.target_id = p_id
        and m.action in ('remove','restore')
      order by m.created_at desc, m.id desc
      limit 1),
    false);
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

-- A proposal's voting window, threshold, and author are fixed at creation. Freeze
-- them on update so a moderator (the only role that can update a proposal) can't
-- move the deadline (reveal a tally early / reopen a closed vote), change the
-- threshold, or reassign authorship. Only `status` (to record a close) and the
-- title/body stay editable.
create or replace function public.guard_proposal_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.opens_at  := old.opens_at;
  new.closes_at := old.closes_at;
  new.kind      := old.kind;
  new.author_id := old.author_id;
  return new;
end; $$;
create trigger trg_guard_proposal_columns
  before update on proposals
  for each row execute function public.guard_proposal_columns();

-- Vote weight + voter id are set server-side, never trusted from the client
create or replace function public.set_vote_weight()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.weight  := coalesce(public.vote_weight_for(auth.uid()), 1.0);
  return new;
end; $$;
create trigger trg_set_vote_weight
  before insert or update on votes
  for each row execute function public.set_vote_weight();

-- Verify, then forget: drop the evidence pointer the instant a decision is recorded
create or replace function public.purge_verification_evidence()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.evidence_path := null;
  -- This nulls the POINTER. The Storage OBJECT is deleted by the app's
  -- decideVerification server action via the service-role client, BEFORE it
  -- commits the decision (delete-before-commit, so a storage failure can never
  -- orphan a file). Postgres can't reliably delete a Storage object inline.
  return new;
end; $$;
create trigger trg_purge_evidence
  before update of status on verifications
  for each row when (new.status in ('approved','rejected'))
  execute function public.purge_verification_evidence();

-- A neighborhood-help request is resolved either by a moderator (who marks it
-- done) or automatically when the member later picks a neighborhood. Either way
-- resolved_at / resolved_by are stamped here, server-side, never by the client.
create or replace function public.stamp_neighborhood_request_resolution()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
    new.resolved_by := coalesce(new.resolved_by, auth.uid());
  end if;
  return new;
end; $$;
create trigger trg_stamp_neighborhood_request
  before update on neighborhood_requests
  for each row execute function public.stamp_neighborhood_request_resolution();

-- When a member picks a neighborhood, the question their request was asking is
-- answered — auto-resolve any open request of theirs (the stamp trigger above
-- records who/when).
create or replace function public.resolve_open_neighborhood_requests()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.neighborhood_id is not null
     and new.neighborhood_id is distinct from old.neighborhood_id then
    update neighborhood_requests
       set status = 'resolved'
     where user_id = new.id and status = 'open';
  end if;
  return new;
end; $$;
create trigger trg_resolve_neighborhood_requests
  after update of neighborhood_id on profiles
  for each row execute function public.resolve_open_neighborhood_requests();

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

-- Governance audit is DB-driven: a proposal logs `proposal.created` on insert and
-- `proposal.closed` (with the aggregate result, no per-ballot data) on the
-- transition to 'closed'. Writing these in the database — rather than via a
-- client log_audit() call — means they can't be forged or skipped, and lets
-- log_audit() stay un-exposed to clients (see GRANTS).
create or replace function public.log_proposal_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_audit('proposal.created', 'proposal', new.id,
                           jsonb_build_object('kind', new.kind));
  return null;
end; $$;
create trigger trg_log_proposal_created
  after insert on proposals
  for each row execute function public.log_proposal_created();

create or replace function public.log_proposal_closed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ballots int; v_yes numeric; v_no numeric; v_abstain numeric;
begin
  select count(*),
         coalesce(sum(case when choice='yes'     then weight end), 0),
         coalesce(sum(case when choice='no'      then weight end), 0),
         coalesce(sum(case when choice='abstain' then weight end), 0)
    into v_ballots, v_yes, v_no, v_abstain
  from votes where proposal_id = new.id;

  -- Always record the close + turnout; withhold the weighted breakdown below
  -- MIN_TURNOUT (provisional 5) so a small-N close can't de-anonymise a ballot
  -- via the audit log — the same floor proposal_results applies.
  if v_ballots >= 5 then
    perform public.log_audit('proposal.closed', 'proposal', new.id,
      jsonb_build_object('ballots', v_ballots, 'revealed', true,
                         'yes_weight', v_yes, 'no_weight', v_no,
                         'abstain_weight', v_abstain));
  else
    perform public.log_audit('proposal.closed', 'proposal', new.id,
      jsonb_build_object('ballots', v_ballots, 'revealed', false));
  end if;
  return null;
end; $$;
create trigger trg_log_proposal_closed
  after update of status on proposals
  for each row when (new.status = 'closed' and old.status is distinct from 'closed')
  execute function public.log_proposal_closed();

-- Scheduled close: record the official close of any proposal whose window has
-- passed. The OUTCOME is the voters' tally; this only stamps that clock-determined
-- result into the log (invariant 5 — automation records, never decides) via the
-- trigger above. The moderator path (recordProposalClose) stays as a manual,
-- idempotent override. Run on a schedule by pg_cron — see the SCHEDULED note at
-- the bottom for the cron.schedule wiring (kept out of the main body so this file
-- still runs where pg_cron isn't installed).
create or replace function public.close_due_proposals()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with closed as (
    update proposals set status = 'closed'
     where status = 'open' and now() > closes_at
    returning 1
  )
  select count(*) into v_count from closed;
  return v_count;
end; $$;
revoke execute on function public.close_due_proposals() from public, anon, authenticated;

-- Append-only immutability backstop (in-DB, role-independent). RLS + grant
-- revocation stop the client roles, but a BYPASSRLS role (service_role, owner)
-- could still alter/erase the record. A trigger fires regardless of rolbypassrls,
-- so it binds EVERY role. audit_log / consents / moderation_actions are truly
-- append-only (block UPDATE + DELETE). votes is immutable-after-close /
-- revisable-while-open, so its guard refuses INSERT/UPDATE once the proposal is
-- closed (the EXACT vt_insert/vt_update while-open predicate, negated — so they
-- can't drift) and refuses DELETE always. TRUNCATE is blocked on all four
-- (statement-level; truncate skips row triggers). INSERT stays open on the three
-- append-only tables or the record stops recording. (Migration 0012.)
create or replace function public.forbid_write()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'table "%" is append-only: % is not permitted', tg_table_name, tg_op
    using errcode = 'check_violation';
end; $$;

create or replace function public.guard_votes_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'votes are immutable: a ballot cannot be deleted'
      using errcode = 'check_violation';
  end if;
  if not exists (select 1 from proposals pr
                 where pr.id = new.proposal_id and pr.status = 'open'
                   and now() between pr.opens_at and pr.closes_at) then
    raise exception 'votes are immutable once the proposal is closed (proposal %)', new.proposal_id
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create trigger trg_append_only before update or delete on audit_log
  for each row execute function public.forbid_write();
create trigger trg_append_only before update or delete on consents
  for each row execute function public.forbid_write();
create trigger trg_append_only before update or delete on moderation_actions
  for each row execute function public.forbid_write();
create trigger trg_guard_votes_immutable before insert or update or delete on votes
  for each row execute function public.guard_votes_immutable();

create trigger trg_no_truncate before truncate on audit_log
  for each statement execute function public.forbid_write();
create trigger trg_no_truncate before truncate on consents
  for each statement execute function public.forbid_write();
create trigger trg_no_truncate before truncate on moderation_actions
  for each statement execute function public.forbid_write();
create trigger trg_no_truncate before truncate on votes
  for each statement execute function public.forbid_write();

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

-- ----------------------------------------------------------------------------
-- 5b · APPEALS: file (affected member) + resolve (a DIFFERENT moderator).
--      These run with definer rights and enforce the two rules RLS can't express
--      (polymorphic ownership; separation of duties), so the direct insert/update
--      policies on `appeals` are intentionally absent — all writes go through here.
-- ----------------------------------------------------------------------------
create or replace function public.file_appeal(p_moderation_action_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_type text; v_target uuid; v_owner uuid; v_appeal uuid;
begin
  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'an appeal statement is required';
  end if;

  select target_type, target_id into v_type, v_target
  from moderation_actions
  where id = p_moderation_action_id and action = 'remove';
  if v_target is null then raise exception 'no removal to appeal'; end if;

  if exists (select 1 from appeals where moderation_action_id = p_moderation_action_id) then
    raise exception 'this action has already been appealed';
  end if;

  if v_type = 'event' then
    select creator_id into v_owner from events where id = v_target;
  elsif v_type = 'proposal' then
    select author_id into v_owner from proposals where id = v_target;
  end if;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'only the affected member may appeal this action';
  end if;

  insert into appeals (moderation_action_id, user_id, body)
  values (p_moderation_action_id, auth.uid(), p_body)
  returning id into v_appeal;
  return v_appeal;
end; $$;

create or replace function public.resolve_appeal(p_appeal_id uuid, p_uphold boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_action uuid; v_actor uuid; v_type text; v_target uuid;
begin
  if not public.is_moderator() then
    raise exception 'only moderators may resolve appeals';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'a reason is required';
  end if;

  select a.moderation_action_id, m.actor_id, m.target_type, m.target_id
    into v_action, v_actor, v_type, v_target
  from appeals a join moderation_actions m on m.id = a.moderation_action_id
  where a.id = p_appeal_id and a.status = 'open';
  if v_action is null then raise exception 'appeal not found or already resolved'; end if;

  -- Separation of duties: no one judges an appeal of their own action.
  if v_actor = auth.uid() then
    raise exception 'separation of duties: you cannot resolve an appeal of your own action';
  end if;

  update appeals
     set status = case when p_uphold then 'upheld' else 'overturned' end::appeal_status
   where id = p_appeal_id;

  if not p_uphold then
    insert into moderation_actions (target_type, target_id, actor_id, action, reason)
    values (v_type, v_target, auth.uid(), 'restore', 'Appeal overturned: ' || p_reason);
  end if;

  perform public.log_audit(
    case when p_uphold then 'appeal.upheld' else 'appeal.overturned' end,
    'appeal', p_appeal_id,
    jsonb_build_object('moderation_action_id', v_action, 'reason', p_reason));
end; $$;

-- ----------------------------------------------------------------------------
-- 5c · ACCOUNT DELETION: erase the person, preserve the tamper-evident record.
--      Self-pinned (acts only on auth.uid(); no user-id parameter). Definer so it
--      can reach past the append-only RLS on consents/appeals. Deletes the
--      personal rows and scrubs the profile's PII, but KEEPS votes /
--      moderation_actions / audit_log / proposals (re-anchored to the scrubbed
--      tombstone) — a hard delete would CASCADE votes and change closed tallies.
--      The guarded trust fields (verified/role/tenure_start) and the auth identity
--      are scrubbed by the service-role admin client in the delete server action
--      (it has no auth.uid(), so the self-edit guard doesn't fire — the guard is
--      never loosened). See migrations/0009_account_data.sql.
-- ----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'must be signed in to delete your account';
  end if;

  delete from event_rsvps           where user_id   = v_uid;
  delete from events                where creator_id = v_uid;  -- cascades their rsvps
  delete from verifications         where user_id   = v_uid;   -- evidence already purged on decision
  delete from neighborhood_requests where user_id   = v_uid;
  delete from consents              where user_id   = v_uid;

  update appeals set body = '[removed when the member deleted their account]'
   where user_id = v_uid;

  update profiles set
      display_name    = 'Former member',
      neighborhood_id = null,
      locale          = 'en',
      deleted_at      = now()
   where id = v_uid;

  perform public.log_audit('account.deleted', 'profile', v_uid, '{}'::jsonb);
end; $$;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================================
-- 6 · VIEW: proposal_results  (aggregate, weighted, SECRET UNTIL CLOSE)
--     Owned by the migration role, so it reads votes past RLS to aggregate —
--     but reveals ONLY after a proposal's close TIME has passed. Visibility is
--     purely temporal (now() > closes_at), never coupled to `status`: voting is
--     gated on time, so a status flip can never reveal a tally early.
-- ============================================================================
-- `revealed` is the MIN_TURNOUT floor (provisional 5): with one or two ballots a
-- weighted breakdown can reveal how an individual voted, so the breakdown is
-- withheld (NULL) until at least 5 distinct members vote. 5 is cohort-ratifiable
-- config alongside the governance thresholds; it sits below quorum (15% of ~50 ≈
-- 7.5), so it never hides a legitimately-decided result. Members-only (no anon
-- grant); the same floor is applied to the close audit entry (log_proposal_closed).
create view proposal_results as
with tally as (
  select
    p.id as proposal_id, p.title, p.kind, p.status, p.closes_at,
    count(v.id)                                                     as ballots,
    coalesce(sum(case when v.choice='yes'     then v.weight end),0) as yes_weight,
    coalesce(sum(case when v.choice='no'      then v.weight end),0) as no_weight,
    coalesce(sum(case when v.choice='abstain' then v.weight end),0) as abstain_weight
  from proposals p
  left join votes v on v.proposal_id = p.id
  where now() > p.closes_at
    and not public.is_content_hidden('proposal', p.id)   -- a removed proposal surfaces no result
  group by p.id
)
select
  proposal_id, title, kind, status, closes_at, ballots,
  (ballots >= 5) as revealed,
  case when ballots >= 5 then yes_weight     end as yes_weight,
  case when ballots >= 5 then no_weight      end as no_weight,
  case when ballots >= 5 then abstain_weight end as abstain_weight
from tally;

-- Public profile fields — the genuinely-public columns of every member, for any
-- authenticated member to read (display_name, neighborhood, verified, role).
-- Owner-rights view: it reads past the base profiles RLS, but exposes ONLY these
-- columns — tenure_start (a vote-weight tell) is deliberately absent (N1).
create or replace view public_profiles as
  select id, display_name, neighborhood_id, verified, role
  from profiles;

-- Current visibility of a piece of content = its LATEST remove/restore action
-- ('remove' ⇒ hidden, 'restore'/none ⇒ visible). The append-only history stays
-- in moderation_actions; this view just reads the top of the stack so the app
-- can ask "is this hidden, and why?" in one query. Reads only columns already
-- public (to authenticated) via moderation_actions' mod_read policy.
create or replace view content_moderation as
select distinct on (target_type, target_id)
  id as action_id, target_type, target_id, action, reason, actor_id, created_at
from moderation_actions
where action in ('remove','restore')
order by target_type, target_id, created_at desc, id desc;

-- ============================================================================
-- 7 · ROW-LEVEL SECURITY
-- ============================================================================
alter table neighborhoods      enable row level security;
alter table profiles           enable row level security;
alter table verifications      enable row level security;
alter table neighborhood_requests enable row level security;
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

-- Profiles: the BASE table is readable only by the member themselves and
-- moderators — it carries tenure_start, which reveals a member's vote-weight
-- tier, so it is not public (rls-audit N1). Everyone else reads the genuinely
-- public columns through the `public_profiles` view (section 6). You may edit
-- only your own row (protected columns are frozen by trg_guard_profile_columns).
-- Inserts happen via the signup trigger (security definer), so no insert policy.
create policy pf_read   on profiles for select to authenticated
  using (id = auth.uid() or public.is_moderator());
create policy pf_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Verifications: see your own (+ moderators see all); submit your own as 'pending'.
-- There is deliberately NO update policy: a decision is recorded ONLY through
-- decide_verification() (SECURITY DEFINER), which also sets profiles.verified +
-- tenure and writes the audit entry. A direct moderator UPDATE would leave an
-- unaudited, half-verified state, so that path is closed (G3).
create policy vf_read   on verifications for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy vf_insert on verifications for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- Neighborhood-help requests: a member opens & reads their own; moderators read
-- all and resolve them. No delete policy — resolved rows stay as light history.
create policy nr_read   on neighborhood_requests for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy nr_insert on neighborhood_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'open');
create policy nr_update on neighborhood_requests for update to authenticated
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
-- Creator self-delete only. A moderator must NOT silently hard-delete an event —
-- moderation goes through the legible, appealable remove flow (moderation_actions),
-- never a quiet DELETE (G4, P7).
create policy ev_delete on events for delete to authenticated
  using (creator_id = auth.uid());

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

-- Votes: SECRET ballot, revisable only while open. user_id + weight are always
-- set by trg_set_vote_weight (on insert AND update); the unique constraint is the
-- hard one-row guard. A re-vote flows through UPDATE, so vt_insert has no
-- "not already voted" clause (it would block the upsert's insert probe).
--   • SELECT: a member reads ONLY their own ballot — never another's, not even moderators.
--   • INSERT: verified, own row, proposal open.
--   • UPDATE: own row, only while open → frozen forever once closed.
--   • (no DELETE policy: a ballot can't be withdrawn.)
create policy vt_select on votes for select to authenticated
  using (user_id = auth.uid());
create policy vt_insert on votes for insert to authenticated
  with check (
    public.is_verified()
    and user_id = auth.uid()
    and not public.is_content_hidden('proposal', proposal_id)   -- not on a removed proposal (G1)
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
  );
create policy vt_update on votes for update to authenticated
  using (
    user_id = auth.uid()
    and not public.is_content_hidden('proposal', proposal_id)   -- not on a removed proposal (G1)
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
  )
  with check (
    user_id = auth.uid()
    and not public.is_content_hidden('proposal', proposal_id)   -- not on a removed proposal (G1)
    and exists (select 1 from proposals pr
                where pr.id = proposal_id and pr.status = 'open'
                  and now() between pr.opens_at and pr.closes_at)
  );

-- Moderation: public read (transparency); moderators insert; append-only
create policy mod_read   on moderation_actions for select to authenticated using (true);
create policy mod_insert on moderation_actions for insert to authenticated
  with check (public.is_moderator() and actor_id = auth.uid());

-- Appeals: a member reads their own; moderators read all. Filing and resolving
-- go ONLY through file_appeal()/resolve_appeal() (security definer) — there are
-- deliberately no direct insert/update policies, so the "affected member only"
-- and "separation of duties" rules can't be bypassed via PostgREST.
create policy ap_read   on appeals for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());

-- Audit log: members read (transparency; no anon); writes only via the security-definer
-- log_audit(), which clients cannot call (its EXECUTE was revoked — see GRANTS)
create policy al_read on audit_log for select to authenticated using (true);

-- ============================================================================
-- 8 · GRANTS  (RLS still gates every row; these are the table-level privileges
--     PostgREST needs. Supabase usually manages these — included for portability.)
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select on neighborhoods, documents to anon, authenticated;
-- Governance results are members-only (no anon): the breakdown reveals how the
-- cohort voted and is withheld below MIN_TURNOUT (rls-audit N3). public_profiles
-- exposes only the public member columns; tenure_start stays on the base table.
grant select on proposal_results, public_profiles, content_moderation to authenticated;
grant select, insert, update, delete on
  profiles, verifications, neighborhood_requests, consents, events, event_rsvps,
  proposals, votes, moderation_actions, appeals, audit_log
  to authenticated;

-- log_audit() and vote_weight_for() are internal primitives — only ever called
-- from owner-context SECURITY DEFINER code (triggers, decide_verification,
-- resolve_appeal, set_vote_weight), which keeps EXECUTE as the owner. Revoke the
-- default PUBLIC execute so a member can't call them directly as a PostgREST RPC:
-- log_audit would forge audit entries; vote_weight_for would leak any member's
-- weight (G2). Self-guarding RPCs (decide_verification, file_appeal,
-- resolve_appeal) and the RLS helpers (is_verified, is_moderator,
-- is_content_hidden) intentionally keep their public EXECUTE.
revoke execute on function public.log_audit(text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.vote_weight_for(uuid)              from public, anon, authenticated;

-- Append-only tables can't be wiped: the trg_no_truncate triggers refuse TRUNCATE
-- for every role, and the privilege itself is revoked here as belt-and-suspenders
-- (Supabase's defaults grant TRUNCATE broadly). (Migration 0012.)
revoke truncate on audit_log, consents, moderation_actions, votes
  from anon, authenticated, service_role;

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
--   Verify-then-forget is completed in-app: the trg_purge_evidence trigger nulls
--   the pointer, and the decideVerification server action deletes the Storage
--   object via the service-role client BEFORE committing the decision
--   (delete-before-commit — a storage failure can't orphan a file). No edge
--   function is involved.
--
-- • SCHEDULED CLOSE: enable pg_cron, then schedule close_due_proposals() (defined
--   above) so a proposal's official close is recorded ~5 min after its window:
--     create extension if not exists pg_cron;
--     select cron.schedule('close-due-proposals', '*/5 * * * *',
--       $$ select public.close_due_proposals(); $$);
--   This RECORDS the clock-determined close (the outcome is the voters' tally;
--   invariant 5 — automation records, never decides). The moderator path remains
--   a manual override. proposal_results reveals results purely on time — only once
--   now() > closes_at — so the schedule adds the record, never the visibility.
--   See migrations/0010_scheduled_close.sql.
--
-- • Casting a vote (client): insert { proposal_id, choice } only — the trigger sets
--   user_id and weight. Reading results: select from proposal_results.
-- ============================================================================
