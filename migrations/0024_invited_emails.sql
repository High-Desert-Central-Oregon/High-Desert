-- ============================================================================
-- Migration 0024 — invited-email allowlist (invite-only signup gate) — MANUAL APPLY
-- ----------------------------------------------------------------------------
-- Closes the open-signup door before launch. Account creation becomes
-- INVITE-ONLY: only an email the founder has added to the allowlist may create
-- an account. Everything else stays reachable (interest signup at /join) — this
-- gates *membership onboarding*, not the marketing surface.
--
-- WHY A DB BACKSTOP, NOT JUST AN APP CHECK:
--   The publishable/anon key is public, so anyone can call GoTrue's
--   signInWithOtp({ shouldCreateUser: true }) directly and create an account,
--   bypassing any server action. The only non-bypassable enforcement is at the
--   database: a BEFORE INSERT trigger on auth.users that refuses a signup whose
--   email is not on the allowlist. The server action (app layer) is the clean-UX
--   first line; THIS trigger is the correctness guarantee.
--
-- G-flags / decisions:
--   G-INV-a  The allowlist is the founder's cohort roster, keyed by EMAIL (pre-
--            account invite data). It is NOT member-authored content and is NOT
--            member-linked by user_id, so delete_my_account() is left unchanged
--            (nothing member-owned to purge; the founder may prune a departed
--            member's email by hand). Flagged for founder ratification.
--   G-INV-b  The enforcement trigger fires ONLY for inserts made by the auth
--            service (current_user = 'supabase_auth_admin') — i.e. every real
--            signup path. Owner/service_role direct inserts (seeds, admin
--            provisioning) are intentionally NOT gated: that is the trusted
--            founder path, and it keeps `supabase db reset` + dry-run seeding
--            working without allowlisting every test persona.
--   G-INV-c  The roster is readable ONLY by moderators/admins (RLS). No anon or
--            member grant — the "who is invited" list must not leak, and there is
--            no function a client can call to probe membership (no enumeration
--            oracle at the DB; the app's neutral messaging closes it at the edge).
--
-- MECHANISM:
--   1. invited_emails(email pk, invited_at, invited_by, note) — the roster.
--   2. A BEFORE INSERT/UPDATE trigger normalizes email to lower(btrim(email)) so
--      every write path (founder SQL, app, backfill) stores a canonical value and
--      the gate comparison always matches.
--   3. RLS: moderators/admins manage; nobody else reads or writes. service_role
--      bypasses RLS for the app's gate read.
--   4. enforce_invited_signup(): BEFORE INSERT on auth.users. When the auth
--      service inserts a new user, refuse (check_violation) if the email is not
--      on the allowlist. Fires before NOT NULL/other checks (BEFORE trigger), so
--      a blocked signup fails cleanly on the invite rule, not a column error.
--   5. Backfill: every pre-existing account's email is added, so no current
--      member is locked out of signing in after this lands.
--
-- delete / export: invited_emails holds no member-authored data (see G-INV-a);
--   delete_my_account() and the account export are intentionally untouched.
--
-- STUDIO-SAFE: pure SQL, no psql meta-commands. Prove first with
-- seed/matrix-0024.sql (one rolled-back transaction, writes nothing), then apply
-- BY HAND in the Supabase SQL editor as owner at the stop-gate — verify the
-- project-ref first. Record it in docs/migrations-applied.md once applied.
-- ============================================================================

-- 1 · the roster ------------------------------------------------------------
create table if not exists public.invited_emails (
  email       text primary key,
  invited_at  timestamptz not null default now(),
  invited_by  uuid references auth.users(id) on delete set null,
  note        text
);

comment on table public.invited_emails is
  'Invite-only signup allowlist (0024). One row per invited email; the founder''s '
  'cohort roster. Enforced by enforce_invited_signup() on auth.users. Not '
  'member-authored data — excluded from delete_my_account by design (G-INV-a).';

-- 2 · normalize every write so the gate comparison is canonical -------------
create or replace function public.normalize_invited_email()
returns trigger language plpgsql set search_path = public as $$
begin
  new.email := lower(btrim(coalesce(new.email, '')));
  if new.email = '' then
    raise exception 'invited_emails.email must be non-empty';
  end if;
  return new;
end; $$;

drop trigger if exists trg_normalize_invited_email on public.invited_emails;
create trigger trg_normalize_invited_email
  before insert or update on public.invited_emails
  for each row execute function public.normalize_invited_email();

-- 3 · RLS: moderators/admins manage; nobody else reads or writes -------------
alter table public.invited_emails enable row level security;

drop policy if exists invited_manage on public.invited_emails;
create policy invited_manage on public.invited_emails
  for all to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- Explicit grants (this project grants per-table; new tables get nothing by
-- default). authenticated is still gated by RLS to moderators above; anon gets
-- nothing; service_role (the app's gate read) bypasses RLS.
revoke all on public.invited_emails from anon;
grant select, insert, update, delete on public.invited_emails to authenticated;

-- 4 · the non-bypassable gate: refuse non-allowlisted signups at auth.users --
create or replace function public.enforce_invited_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Gate only inserts made by the auth service (real signups). Owner/service_role
  -- direct inserts (seeds, provisioning) are the trusted founder path (G-INV-b).
  -- Use SESSION_USER, not current_user: this function is SECURITY DEFINER (it must
  -- read invited_emails past RLS), so current_user is the definer (postgres) and
  -- would never match. session_user is the login role — 'supabase_auth_admin' when
  -- GoTrue performs a signup, 'postgres'/owner for seeds and provisioning.
  if session_user = 'supabase_auth_admin'
     and new.email is not null
     and not exists (
       select 1 from public.invited_emails
        where email = lower(btrim(new.email))
     ) then
    raise exception 'signups are invite-only'
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

drop trigger if exists trg_enforce_invited_signup on auth.users;
create trigger trg_enforce_invited_signup
  before insert on auth.users
  for each row execute function public.enforce_invited_signup();

-- 5 · backfill existing accounts so no current member is locked out ----------
--     (normalize trigger lowercases; PK + on-conflict make this idempotent).
insert into public.invited_emails (email, note)
select email, 'backfill: pre-existing account (0024)'
  from auth.users
 where email is not null
   and email not like '%@deleted.invalid'
on conflict (email) do nothing;
