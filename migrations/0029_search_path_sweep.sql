-- ============================================================================
-- Migration 0029 — search_path sweep, stale comment, created_by default
--                                                              — MANUAL APPLY
-- ----------------------------------------------------------------------------
-- Closes deferred-hardening items 1, 3 and 8. Pins every remaining SECURITY
-- DEFINER-era function to `search_path = public, pg_temp`, corrects one column
-- comment that describes withdrawn work, and gives invite_tokens.created_by the
-- database-side default the ADR always claimed it had.
--
-- NO GRANT CHANGES IN THIS FILE. Not one GRANT, not one REVOKE. The grant
-- surface — service_role's blanket DML, `authenticated` holding TRUNCATE on the
-- invite tables, anon's privileges on the 0001/0013/0014/0015/schema.sql tables
-- — is **migration 0030**, which must be written from PROD's inventory read at
-- its own stop-gate, not from a local pass (ledger convention 5). 0030 does not
-- begin until 0029 is applied and verified.
--
-- ----------------------------------------------------------------------------
-- WHAT THE SWEEP DOES, AND WHY IT IS NARROWER THAN IT LOOKS
--
-- 47 functions carry `SET search_path TO 'public'`; 10 already carry
-- `public, pg_temp` (the standard 0026 established). There are ZERO unpinned
-- functions — every one already has a proconfig. That matters, because it makes
-- the change provably non-destructive:
--
--   today:  pg_temp  ->  pg_catalog  ->  public    (pg_temp is implicitly FIRST
--                                                   when not named explicitly)
--   after:  pg_catalog  ->  public  ->  pg_temp    (naming it moves it LAST)
--
-- No schema is removed from any path. `public` and `pg_catalog` are still
-- there. The single semantic change is that pg_temp stops being searched first,
-- so a temporary table can no longer shadow a real one inside a definer body —
-- which is the entire point of the standard.
--
-- Verified before writing this, not assumed:
--   · No function in public creates or references a temp object (0 matches for
--     `create temp` / `on commit` across all 57). Nothing relies on shadowing.
--   · pgcrypto, uuid-ossp, pg_net and pg_stat_statements live in the
--     `extensions` schema, NOT in public — so an unqualified call to one would
--     be a real break. None of the 47 makes one. The only two users,
--     mint_calendar_feed and rotate_calendar_feed, both write
--     `extensions.gen_random_bytes` fully qualified.
--   · The only cross-schema references anywhere in the 57 are `auth.` and
--     `extensions.`, all qualified.
--
-- ----------------------------------------------------------------------------
-- BASELINE ROTATION — READ THIS BEFORE APPLYING
--
-- `ALTER FUNCTION ... SET search_path` changes what pg_get_functiondef() emits,
-- so **all 47 body hashes rotate**, including the signup gate's. That is
-- deliberate and it is the reason this is its own migration.
--
-- 0027 did NOT fix enforce_invited_signup's search_path, on purpose: byte-
-- identity of that function was 0027's regression criterion — the proof that
-- adding a write path to the allowlist had not touched the gate that reads it.
-- Hardening it inside that build would have destroyed the very check that made
-- the build trustworthy. The two changes wanted separate commits and separate
-- verification. This is that second commit.
--
--   PRE-ALTER gate hash (the value this migration expects to find):
--     8f2f632e92d2eab9900fd11b9a0bd9156c2f867bedff33d211f322086366532e
--
--   OPERATOR STEP — run this in prod IMMEDIATELY BEFORE applying, and stop if
--   it does not match the value above. It proves the ALTER is landing on the
--   definition this migration was written against:
--
--     select encode(sha256(pg_get_functiondef(p.oid)::bytea),'hex')
--       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.proname = 'enforce_invited_signup';
--
--   POST-ALTER gate hash (the new baseline, asserted by the probe below):
--     4a88b18c388fa8c78a4766892774069d562b887e0df9751db0cc288991c29a07
--
-- The pre-ALTER value is now HISTORICAL. Every reference to it in the repo was
-- rotated in the same commit as this file — the 0027 header, seed/matrix-0027,
-- steppe/tests/invite-tokens.test.ts, docs/decisions/invite-tokens.md,
-- docs/migrations-applied.md, and docs/ops/deferred-hardening.md item 1. Six
-- places, not five; the sixth is the sweep item that describes this migration.
--
-- Only the GATE's hash is pinned anywhere. The other 46 rotate too, but no file
-- asserts them, and none should — pinning 46 body hashes would create 46 ways
-- for a future maintenance edit to fail a check for no security reason.
--
-- ----------------------------------------------------------------------------
-- CANONICAL APPLY-STATUS PROBE for docs/migrations-applied.md.
--
--   ('0029 search_path sweep + created_by default',
--    'all 57 public functions pinned to (public, pg_temp); gate rotated; neighborhood_id comment corrected; created_by defaults to auth.uid()',
--    -- (i) EVERY function in public carries the standard. Asserted over all 57
--    --     rather than a list, so a function added later without it fails here.
--    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--                 where n.nspname = 'public' and p.prokind = 'f'
--                   and coalesce(array_to_string(p.proconfig, ','), '')
--                       is distinct from 'search_path=public, pg_temp')
--    -- (ii) the gate is the NEW baseline, and only the gate is pinned by hash
--      and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--                   where n.nspname = 'public' and p.proname = 'enforce_invited_signup'
--                     and encode(sha256(pg_get_functiondef(p.oid)::bytea),'hex')
--                         = '4a88b18c388fa8c78a4766892774069d562b887e0df9751db0cc288991c29a07')
--    -- (iii) created_by defaults to auth.uid() in the DATABASE, not just in the
--    --       one write path that happens to set it (ADR §4, corrected in 1.1)
--      and exists (select 1 from information_schema.columns
--                   where table_schema = 'public' and table_name = 'invite_tokens'
--                     and column_name = 'created_by'
--                     and column_default ilike '%auth.uid()%')
--    -- (iv) the column comment no longer describes the withdrawn pledge landing
--      and (select col_description('public.invite_tokens'::regclass, ordinal_position)
--             from information_schema.columns
--            where table_schema='public' and table_name='invite_tokens'
--              and column_name='neighborhood_id') not ilike '%pledge landing%')
-- ----------------------------------------------------------------------------
--
-- STUDIO-SAFE: pure SQL, no psql meta-commands. Prove first with
-- seed/matrix-0029.sql (one rolled-back transaction, writes nothing), then apply
-- BY HAND in the Supabase SQL editor as owner at the stop-gate — verify the
-- project-ref first, and run the PRE-ALTER hash check above. Record it in
-- docs/migrations-applied.md once applied. Safe to re-run.
-- ============================================================================

-- 1 · THE SWEEP — 47 functions, grouped by the migration that created them ---
--     One statement per function. Bodies are NOT touched: `ALTER FUNCTION ...
--     SET` changes only the proconfig. No CREATE OR REPLACE appears in this
--     file, so no function body can drift through it.

-- schema.sql — the original prototype schema (v1, June 2026)
alter function public.decide_verification(p_id uuid, p_approve boolean) set search_path = public, pg_temp;
alter function public.guard_profile_columns() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.is_content_hidden(p_type text, p_id uuid) set search_path = public, pg_temp;
alter function public.log_moderation() set search_path = public, pg_temp;
alter function public.purge_verification_evidence() set search_path = public, pg_temp;
alter function public.stamp_neighborhood_request_resolution() set search_path = public, pg_temp;

-- 0001 neighborhood requests
alter function public.resolve_open_neighborhood_requests() set search_path = public, pg_temp;

-- 0002 votes revisable
alter function public.set_vote_weight() set search_path = public, pg_temp;

-- 0006 appeals
alter function public.resolve_appeal(p_appeal_id uuid, p_uphold boolean, p_reason text) set search_path = public, pg_temp;

-- 0007 RLS hardening
alter function public.guard_proposal_columns() set search_path = public, pg_temp;
alter function public.log_audit(p_action text, p_entity text, p_entity_id uuid, p_metadata jsonb) set search_path = public, pg_temp;
alter function public.log_proposal_created() set search_path = public, pg_temp;

-- 0008 privacy hardening
alter function public.log_proposal_closed() set search_path = public, pg_temp;

-- 0009 account data
alter function public.is_moderator() set search_path = public, pg_temp;
alter function public.is_verified() set search_path = public, pg_temp;

-- 0010 scheduled close
alter function public.close_due_proposals() set search_path = public, pg_temp;

-- 0011 tenure weight range
alter function public.vote_weight_for(p_user uuid) set search_path = public, pg_temp;

-- 0012 append-only backstop
alter function public.forbid_write() set search_path = public, pg_temp;
alter function public.guard_votes_immutable() set search_path = public, pg_temp;

-- 0013 groups core
alter function public.add_member(p_group uuid, p_user uuid) set search_path = public, pg_temp;
alter function public.approve_member(p_group uuid, p_user uuid) set search_path = public, pg_temp;
alter function public.create_group(p_name text, p_slug text, p_description text, p_category_id uuid, p_visibility group_visibility, p_join_policy group_join_policy) set search_path = public, pg_temp;
alter function public.deny_member(p_group uuid, p_user uuid) set search_path = public, pg_temp;
alter function public.is_group_maintainer(p_group uuid) set search_path = public, pg_temp;
alter function public.is_group_member(p_group uuid) set search_path = public, pg_temp;
alter function public.join_group(p_group uuid) set search_path = public, pg_temp;
alter function public.leave_group(p_group uuid) set search_path = public, pg_temp;
alter function public.remove_member(p_group uuid, p_user uuid) set search_path = public, pg_temp;
alter function public.set_member_role(p_group uuid, p_user uuid, p_role group_member_role) set search_path = public, pg_temp;
alter function public.suggest_category(p_name text) set search_path = public, pg_temp;
alter function public.update_group_settings(p_group uuid, p_name text, p_description text, p_category_id uuid, p_visibility group_visibility, p_join_policy group_join_policy) set search_path = public, pg_temp;

-- 0015 qr_counts
alter function public.increment_qr_count(p_variant text, p_kind text) set search_path = public, pg_temp;

-- 0018 exchange posts
alter function public.default_event_group() set search_path = public, pg_temp;
alter function public.guard_event_columns() set search_path = public, pg_temp;
alter function public.guard_post_columns() set search_path = public, pg_temp;
alter function public.set_post_pin(p_post uuid, p_pin boolean) set search_path = public, pg_temp;

-- 0019 post appeals
alter function public.file_appeal(p_moderation_action_id uuid, p_body text) set search_path = public, pg_temp;

-- 0020 calendar feeds
alter function public.calendar_feed_payload(p_token text) set search_path = public, pg_temp;
alter function public.mint_calendar_feed(p_group uuid) set search_path = public, pg_temp;
alter function public.rotate_calendar_feed(p_feed uuid) set search_path = public, pg_temp;

-- 0021 reports intake
alter function public.resolve_report(p_report uuid, p_outcome text) set search_path = public, pg_temp;

-- 0022 member messages
alter function public.can_send(p_thread uuid) set search_path = public, pg_temp;
alter function public.delete_my_account() set search_path = public, pg_temp;
alter function public.start_thread(p_with uuid, p_body text, p_about_post uuid) set search_path = public, pg_temp;

-- 0024 invite-only signup allowlist
alter function public.enforce_invited_signup() set search_path = public, pg_temp;
alter function public.normalize_invited_email() set search_path = public, pg_temp;

-- (grouped: 47 of 47)
-- 2 · THE STALE COLUMN COMMENT (deferred item 8) -----------------------------
--     0027's comment says neighborhood_id "prefills the pledge landing at
--     /n/<slug>" and that "routing behavior is Phase 4". Both claims were
--     WITHDRAWN by docs/decisions/invite-tokens.md §9 (v1.2): pledging never
--     required an account, so routing a redeemed member to a pledge page
--     answered a question nobody had, and the column was redesignated as
--     mint-time provenance.
--
--     The ADR supersedes the migration, but the database is the surface
--     consulted first — someone running \d+ invite_tokens reads the comment,
--     not the record. 0027 is applied and a COMMENT is DDL, so correcting it
--     is a migration. This is it.
comment on column public.invite_tokens.neighborhood_id is
  'MINT-TIME PROVENANCE: which audience a batch of cards was printed for. '
  'NULL = general-purpose (counter cards, press), which is the majority case. '
  'Written at mint, shown in the token list, and read by NOTHING else — that is '
  'the intended end state, not unfinished work. ON DELETE SET NULL: losing the '
  'neighborhood degrades the token to general-purpose and never destroys invite '
  'history (0027, G-INV-6). The pledge-landing routing this comment used to '
  'describe was withdrawn — see docs/decisions/invite-tokens.md §9 (v1.2).';

-- 3 · created_by GETS ITS DATABASE-SIDE DEFAULT (deferred item 3) ------------
--     ADR §4 originally said created_by is taken from auth.uid() "inside the
--     database". Version 1.1 corrected that to what was actually true: 0027
--     ships the column with no default and no trigger, so the mint server
--     action supplies it from the caller's session. The property that matters —
--     a client cannot choose the attribution — held either way, but "the
--     database guarantees it" and "the one write path happens to do it" are
--     different assurances, and only one survives a second write path.
--
--     This makes the ADR's original sentence true.
--
--     WHY THIS CANNOT BREAK THE MINT ACTION: a DEFAULT applies only when the
--     INSERT omits the column. app/protected/invites/actions.ts supplies
--     created_by explicitly from getCurrentUser(), and an explicit value always
--     wins over a default. The action is unchanged and unaffected.
--
--     WHAT IT ADDS: any future write path that forgets the column now records
--     the acting user instead of NULL. Under service_role with no JWT claims
--     auth.uid() is NULL — exactly what the column stored before — so nothing
--     regresses for server-side callers.
--
--     NOT retroactive, deliberately: existing rows keep whatever they have.
--     A guessed attribution is indistinguishable from a recorded one, which is
--     the rule invited_emails.invited_by already states in its own comment.
alter table public.invite_tokens
  alter column created_by set default auth.uid();

comment on column public.invite_tokens.created_by is
  'Who minted this token. DEFAULT auth.uid() (0029) so the database records the '
  'attribution even if a write path forgets to; the mint action still supplies '
  'it explicitly, and an explicit value wins. Never client-supplied. '
  'ON DELETE SET NULL: losing the minter''s account must not delete the token '
  'or orphan its redemptions.';
