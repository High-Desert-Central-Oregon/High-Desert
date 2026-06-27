-- ============================================================================
-- Migration 0015 — qr_counts (QR A/B aggregate counter)
-- ----------------------------------------------------------------------------
-- A first-party, zero-PII counter for the printed-QR A/B test on the pre-launch
-- /join page. It holds AGGREGATE COUNTS ONLY — four rolling counters per day
-- (variant {quiet,square} × kind {scan,join}) — and never an IP, user-agent,
-- cookie, or any identifier. This is the privacy-by-architecture alternative to a
-- third-party analytics tracker, and is what keeps it inside CLAUDE.md invariant 8
-- and the live /privacy + /legal/terms "no third-party trackers, no behavioral
-- profiles" promise: it counts events, not people.
--
-- RLS is ENABLED with NO policies, so the table is default-DENY for anon and
-- authenticated (the publishable-key clients can neither read nor write it).
-- Every write goes through the server-only service-role client
-- (lib/supabase/admin.ts → /api/qr), which bypasses RLS. You read the counts from
-- the Supabase SQL editor (service role bypasses RLS).
--
-- The atomic increment ("create the row at 1, else bump it") can't be expressed
-- through PostgREST/supabase-js, so it lives in increment_qr_count(). The function
-- runs SECURITY INVOKER: only the service role is granted EXECUTE (revoked from
-- PUBLIC), and only the service role holds the table write grant — so even a stray
-- caller could not move a counter.
--
-- Folded into schema.sql. Safe to re-run.
-- ============================================================================

create table if not exists qr_counts (
  variant text not null check (variant in ('quiet','square')),
  kind    text not null check (kind in ('scan','join')),
  day     date not null default current_date,
  count   integer not null default 0,
  primary key (variant, kind, day)
);

alter table qr_counts enable row level security;
-- No policies, by design: deny-by-default. Do NOT add an anon/authenticated read
-- or write policy — the counter is written only by the service role.

-- Atomic per-day increment. Re-validates the labels (defense in depth) and is the
-- single write path the /api/qr route calls.
create or replace function public.increment_qr_count(p_variant text, p_kind text)
returns void language plpgsql set search_path = public as $$
begin
  if p_variant not in ('quiet','square') or p_kind not in ('scan','join') then
    raise exception 'invalid qr counter';
  end if;
  insert into qr_counts (variant, kind, day, count)
  values (p_variant, p_kind, current_date, 1)
  on conflict (variant, kind, day)
  do update set count = qr_counts.count + 1;
end; $$;

-- Lock both the table and the function to the service role only.
revoke all on function public.increment_qr_count(text, text) from public;
grant select, insert, update on qr_counts to service_role;
grant execute on function public.increment_qr_count(text, text) to service_role;
