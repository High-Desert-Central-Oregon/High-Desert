-- ============================================================================
-- Migration 0014 — interest_signups (pre-launch mailing list)
-- ----------------------------------------------------------------------------
-- A standalone capture table for the public pre-launch interest form
-- (app/(site)/join). It is deliberately OUTSIDE the member trust model: no
-- profile, no auth user, no verification — just an email and an optional name so
-- we can notify people when Steppe opens to the public.
--
-- RLS is ENABLED with NO policies, so the table is default-DENY for anon and
-- authenticated (the publishable-key clients can neither read nor write it).
-- Every write goes through the server-only service-role client
-- (lib/supabase/admin.ts → /api/interest), which bypasses RLS. This keeps the
-- list of who-is-interested off the public API entirely.
--
-- Folded into schema.sql. Safe to re-run.
-- ============================================================================

create table if not exists interest_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  first_name text,
  in_area    boolean,
  consent    boolean not null,
  created_at timestamptz not null default now()
);

alter table interest_signups enable row level security;
-- No policies, by design: deny-by-default. Do NOT add an anon/authenticated
-- read or write policy — the signup list must never be exposed through the API.

-- Explicit (Supabase usually manages service_role grants; included for
-- portability). Only the service role touches this table.
grant select, insert on interest_signups to service_role;
