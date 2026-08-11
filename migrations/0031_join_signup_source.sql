-- ============================================================================
-- Migration 0031 — join-page signup source tracking (interest_signups.source)
-- ----------------------------------------------------------------------------
-- Printed collateral (business card, postcard, bookmark) now carries a QR code
-- with a ?r= source param. This records which printed piece produced each
-- pre-launch signup, so the answer to "did the postcard run work" comes from
-- the database instead of a guess.
--
-- WHY A CHECK CONSTRAINT AND NOT A FREE-TEXT COLUMN: `source` is an allowlist
-- of print-run codes the founder controls, not member input. A CHECK is the
-- backstop of last resort — the route handler (app/api/interest/route.ts)
-- coerces anything unrecognised to 'direct' before it ever reaches this
-- column, so the constraint should never actually fire in normal operation.
-- Defaulting to 'direct' means every pre-existing row and every signup that
-- arrives with no ?r= at all reads the same, unremarkable way.
--
-- WHY NO NEW GRANTS: interest_signups (0014) has exactly one writer —
-- app/api/interest/route.ts, using the server-only service-role client
-- (createAdminClient(), lib/supabase/admin.ts). service_role holds
-- rolbypassrls = true in this project (confirmed against prod, 2026-08-10)
-- and was never narrowed by a column-specific REVOKE on this table — the
-- 0018 revoke that stripped blanket INSERT/UPDATE targeted `posts` and
-- `events` only, not this table. A column added by plain ALTER TABLE rides
-- the existing table-level grant; there is no narrower grant to fall out of,
-- and the writer role bypasses grant checks anyway. Adding a column-level
-- grant here would be dead code defending against a failure mode that does
-- not exist on this table (see docs/migrations-applied.md for the audited
-- prod grant state at time of writing).
--
-- RLS: unchanged, deny-by-default (RLS on, ZERO policies, per 0014). This
-- migration adds no policy for anon or authenticated — do not add one.
--
-- No function is touched by this migration, so there is nothing to pin a
-- search_path on.
--
-- NOT folded into schema.sql, matching every migration since 0016. schema.sql is
-- a BASELINE THROUGH 0015 (scripts/reset-local.sh:40), and a fresh database is
-- built by running it and then replaying migrations 0016+ in order. Folding this
-- one column in would make schema.sql a baseline-plus-one, which no downstream
-- reader could tell apart from a fully-folded file.
--
-- Safe to re-run: the column add is `if not exists`, and the constraint is
-- dropped-if-exists immediately before it is added, so a partial apply completes
-- on a second run.
-- ============================================================================

alter table public.interest_signups
  add column if not exists source text not null default 'direct';

alter table public.interest_signups
  drop constraint if exists interest_signups_source_check;

alter table public.interest_signups
  add constraint interest_signups_source_check
  check (source in ('bc', 'pc', 'bm', 'direct'));

comment on column public.interest_signups.source is
  'Which printed piece produced this signup: bc = business card, pc = postcard, '
  'bm = bookmark, direct = no ?r= param or an unrecognised one (0031). The route '
  'handler coerces unknown values to ''direct'' before insert; the CHECK is a '
  'backstop, not the primary defense.';
