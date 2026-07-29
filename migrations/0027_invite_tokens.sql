-- ============================================================================
-- Migration 0027 — invite tokens (bearer, capped) — MANUAL APPLY
-- ----------------------------------------------------------------------------
-- Implements docs/decisions/invite-tokens.md (Accepted, 2026-07-29).
--
-- WHAT THIS REPLACES: migration 0024 made account creation invite-only but built
-- no way to put an email on the allowlist. There is exactly one reference to
-- invited_emails in application code and it is a read, so every invitation today
-- is a hand-written SQL statement typed by one person. This migration adds the
-- write path: a moderator mints one capped token, and everyone holding it can
-- put their own address on the list until the cap or the expiry stops them.
--
-- THE CENTRAL PROPERTY — DUAL-LAYER PRESERVATION.
--   enforce_invited_signup() is NOT TOUCHED by this migration. Its predicate
--   stays one sentence — "is this email on invited_emails" — reading one table.
--   redeem_invite() is a WRITER to that list, never a second gate. The token
--   subsystem can be wrong, revoked, redesigned, or dropped entirely and the
--   guarantee is unchanged: no account exists for an email that is not on the
--   list. Teaching the trigger about tokens would grow its read surface to three
--   tables and move cap arithmetic, expiry and revocation inside the thing that
--   guards account creation, after which every change to token semantics becomes
--   a change to the gate.
--
--   REGRESSION CRITERION. enforce_invited_signup() must come out of this build
--   byte-identical. Baseline captured from production 2026-07-29 and verified
--   equal on the local prod-shaped database before this migration was written:
--     sha256(pg_get_functiondef('public.enforce_invited_signup'::regproc))
--       = 8f2f632e92d2eab9900fd11b9a0bd9156c2f867bedff33d211f322086366532e
--   If that hash moves, this build has failed no matter what else works. The
--   regression that matters most is not that a valid token admits someone — it
--   is that an email which never passed through a token still cannot sign up.
--
-- G-flags / decisions taken here:
--   G-INV-1  Tokens are BEARER with a use cap, not single-use. Single-use would
--            fix the interface and leave the bottleneck (fifty invitations =
--            fifty mint actions). The cap makes founder work one action per
--            cohort while bounding what a leaked token costs (ADR §1).
--   G-INV-2  NO profiles.invited_by. The invite graph lives only in this
--            subsystem — invited_emails.invited_by plus invite_tokens.created_by
--            joined to invite_redemptions — so it is prunable as a unit. A column
--            on the member record would make the edge permanent and would survive
--            every purge of a subsystem it is not part of (ADR §3).
--   G-INV-3  The token string is stored in PLAINTEXT, deliberately. It is a
--            distribution artifact meant to be printed, reprinted, and read
--            aloud, not a secret to be verified against a hash. A moderator has
--            to be able to re-read a token to reprint a card. Expiry, the cap,
--            revocation, and moderator-only RLS are the controls; confidentiality
--            of the string at rest is not one of them, and pretending otherwise
--            by hashing it would break reprinting while protecting nothing that
--            the cap does not already bound.
--   G-INV-4  ANON GETS NOTHING. redeem_invite() is granted to service_role only,
--            and so is purge_stale_invites(). No object in this migration is
--            reachable by anon — not the tables, not the functions.
--            This reverses an earlier decision in this build to grant anon
--            EXECUTE on redeem_invite, on the reasoning that "the redeemer has
--            no session". That conflated two different things: an anonymous
--            PERSON does not imply an anonymous DATABASE ROLE. The redeem route
--            is server-side and holds the service key already — the same shape
--            requestSignInLink() uses for its allowlist read.
--            What the anon grant actually bought was exposure: PostgREST hands
--            the RPC to anyone holding the public anon key, and a printed token
--            is meant to be photographed. A holder could script garbage
--            addresses against a 25-use token and exhaust the cap before a
--            single real neighbor arrived. The cap is a blast-radius dial, not
--            an abuse budget, and a rate limit that can be walked around is not
--            a rate limit. ADR §4 stands unamended.
--   G-INV-5  Redemption records inherit the 180-day bound from the stalled-
--            campaign rule (docs/decisions/neighborhood-pledge-campaigns.md):
--            they hold an email address in the hope of a conversion that may
--            never come, which is the same class of data for the same reason.
--   G-INV-6  invite_tokens.neighborhood_id is NULLABLE with ON DELETE SET NULL.
--            NULL is not a missing value — it is the general-purpose token
--            (counter cards, press), which is the majority case. A set value
--            means the token was minted for one neighborhood and prefills the
--            pledge landing. SET NULL rather than CASCADE because a closed
--            campaign must not destroy invite history, and rather than
--            RESTRICT because invite history must not veto a geography edit:
--            the failure mode of losing the reference is a token that reverts
--            to general-purpose, which is a state the schema already models.
--            The column is the reference only — the routing it enables is
--            Phase 4, and no function in this migration reads it.
--
-- STUDIO-SAFE: pure SQL, no psql meta-commands. Prove first with
-- seed/matrix-0027.sql (one rolled-back transaction, writes nothing), then apply
-- BY HAND in the Supabase SQL editor as owner at the stop-gate — verify the
-- project-ref first. Record it in docs/migrations-applied.md once applied.
-- Safe to re-run.
--
-- ----------------------------------------------------------------------------
-- CANONICAL APPLY-STATUS PROBE for docs/migrations-applied.md. Paste this clause
-- into the ledger's probe query at the stop-gate.
--
-- The two anon assertions are SEPARATE on purpose. An earlier draft of this
-- probe checked only `information_schema.role_table_grants ... grantee='anon'`
-- and reported APPLIED while anon held EXECUTE on redeem_invite — table grants
-- and function grants live in different catalogs, so one clause covering "no
-- anon grant" could be true and false at the same time and still pass. Table
-- privileges and function privileges are now asserted independently, and each
-- names which surface it covers.
--
--   ('0027 invite tokens',
--    'tables + fns + moderator-only RLS + NOTHING reachable by anon + nullable SET NULL neighborhood_id + no profiles.invited_by',
--    exists (select 1 from information_schema.tables
--             where table_schema='public' and table_name='invite_tokens')
--      and exists (select 1 from information_schema.tables
--                   where table_schema='public' and table_name='invite_redemptions')
--      and exists (select 1 from pg_proc where proname='redeem_invite')
--      and exists (select 1 from pg_proc where proname='purge_stale_invites')
--      and (select count(*) from pg_policies
--            where tablename in ('invite_tokens','invite_redemptions')) = 2
--      -- (i) no anon DML on either table
--      and not exists (select 1 from information_schema.role_table_grants
--                       where table_schema='public'
--                         and table_name in ('invite_tokens','invite_redemptions')
--                         and grantee='anon')
--      -- (ii) no anon EXECUTE on either function, and no PUBLIC default either
--      and not has_function_privilege('anon','public.redeem_invite(text,text)','EXECUTE')
--      and not has_function_privilege('anon','public.purge_stale_invites(interval)','EXECUTE')
--      and not has_function_privilege('public','public.redeem_invite(text,text)','EXECUTE')
--      and not has_function_privilege('public','public.purge_stale_invites(interval)','EXECUTE')
--      -- (iii) the neighborhood reference exists, is nullable, and its delete
--      --       rule is SET NULL ('n'). The delete rule is asserted, not assumed:
--      --       the column existing says nothing about whether deleting a
--      --       neighborhood would take its tokens with it (G-INV-6).
--      and exists (select 1 from information_schema.columns
--                   where table_schema='public' and table_name='invite_tokens'
--                     and column_name='neighborhood_id' and is_nullable='YES')
--      and exists (select 1 from pg_constraint c
--                   where c.conrelid = 'public.invite_tokens'::regclass
--                     and c.contype = 'f'
--                     and c.confrelid = 'public.neighborhoods'::regclass
--                     and c.confdeltype = 'n')
--      -- the invite graph did not escape its subsystem (G-INV-2)
--      and not exists (select 1 from information_schema.columns
--                       where table_name='profiles' and column_name='invited_by'))
-- ----------------------------------------------------------------------------
-- ============================================================================

-- 1 · the tokens ------------------------------------------------------------
create table if not exists public.invite_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null default encode(gen_random_bytes(16), 'hex'),
  max_uses    int not null check (max_uses > 0),
  uses_count  int not null default 0 check (uses_count >= 0),
  expires_at  timestamptz not null,
  created_by  uuid references auth.users(id) on delete set null,
  revoked_at  timestamptz,
  label       text,
  created_at  timestamptz not null default now(),
  -- G-INV-6. Nullable, and SET NULL on delete — see the column comment below.
  neighborhood_id uuid references public.neighborhoods(id) on delete set null
);

-- The column is in the CREATE above for a fresh apply, and repeated here as an
-- idempotent ALTER because `create table if not exists` adds nothing to a table
-- that already exists. An earlier revision of this file (branch commits 9899c0c
-- and 893a4de) had no neighborhood_id; anyone who applied that revision gets the
-- column from this statement rather than a silently-missing one. Same reason 0026
-- extends `neighborhoods` by ALTER.
alter table public.invite_tokens
  add column if not exists neighborhood_id uuid references public.neighborhoods(id)
  on delete set null;

comment on table public.invite_tokens is
  'Bearer invite tokens with a use cap (0027). A moderator mints one; anyone '
  'holding it may put their own address on invited_emails until uses_count '
  'reaches max_uses or expires_at passes. Never a gate — redemption writes to '
  'the allowlist that enforce_invited_signup() already reads.';

-- ENTROPY. gen_random_bytes(16) is 16 cryptographically-random bytes from
-- pgcrypto = 128 bits, hex-encoded to 32 characters. Not sequential, not
-- derived from any row value, and not guessable: at 128 bits an attacker
-- enumerating a billion candidates per second would need on the order of 10^22
-- years to expect one hit, so the cap and the expiry — not the search space —
-- are what actually bound a token's reach. Hex rather than base64url because a
-- token that may be typed or read aloud must not depend on case or on
-- distinguishing +/- from /_; lookups lower(btrim()) the input to match.
comment on column public.invite_tokens.token is
  'The bearer string, 128 bits of gen_random_bytes hex-encoded. STORED IN '
  'PLAINTEXT ON PURPOSE (G-INV-3): this is a distribution artifact meant to be '
  'printed, reprinted, and read aloud, not a secret to verify against a hash — '
  'a moderator must be able to re-read it to reprint a card. Expiry, max_uses, '
  'revoked_at, and moderator-only RLS are the controls.';
comment on column public.invite_tokens.expires_at is
  'MANDATORY. NOT NULL with no default, so minting must state an end date — '
  'there is deliberately no nullable-means-forever token.';
comment on column public.invite_tokens.created_by is
  'Who minted it. Set from auth.uid() by the mint path, never client-supplied. '
  'ON DELETE SET NULL: losing the minter''s account must not delete the token '
  'or orphan the redemptions that reference it.';
comment on column public.invite_tokens.revoked_at is
  'Stamped to stop further redemptions. Does NOT retract allowlist rows already '
  'written — a revocation cascade is prerequisite work for member-minted tokens '
  'and is deliberately not built here (ADR §5).';
comment on column public.invite_tokens.neighborhood_id is
  'NULL = general-purpose token (counter cards, press). Set = minted for one '
  'neighborhood, and prefills the pledge landing at /n/<slug>. ON DELETE SET '
  'NULL: a token can never be orphaned and can never be cascade-deleted — '
  'losing the geography degrades the token to general-purpose, it does not '
  'destroy invite history (0027, G-INV-6). Routing behavior is Phase 4.';

-- WHY neighborhoods.id AND NOT THE SLUG. 0026 deliberately did not create a
-- campaign table — it ALTERed `neighborhoods` with nullable `threshold` and
-- `opened_at`, so the campaign IS the neighborhood row and there is no campaign
-- id to reference (0026, "WHY THIS EXTENDS `neighborhoods`"). That leaves two
-- referenceable columns, and only one survives the lifecycle:
--   · Closing a campaign is `threshold = null` (or the stalled-campaign purge in
--     close_stale_pledge_campaigns), and reopening is setting `threshold` again.
--     NEITHER touches the neighborhood row, so an id reference is untouched by a
--     close/reopen cycle — which is precisely the case a token must survive,
--     since a printed card outlives the campaign it was minted for.
--   · `slug` is unique-not-null and so is FK-able, but it is mutable text. A
--     token pointing at a slug would break the moment a slug were corrected,
--     and it would store the same string that is already printed on the card —
--     duplicating the one value 0026 keeps in a single namespace on purpose.
-- The id is immutable, opaque, and the same key `profiles.neighborhood_id` and
-- `pledges.neighborhood_id` already use. Resolving id → slug for the prefill is
-- a join the pledge landing already performs.

-- Indexed because the mint surface lists tokens by neighborhood, and because
-- ON DELETE SET NULL must scan this column on every neighborhood delete.
create index if not exists invite_tokens_neighborhood_idx
  on public.invite_tokens (neighborhood_id) where neighborhood_id is not null;

-- 2 · the redemptions -------------------------------------------------------
--     MINIMUM VIABLE RECORD. Four columns, each load-bearing:
--
--     token_id          which token admitted this address. One half of the
--                       invite-graph edge, and the cascade boundary — deleting a
--                       token takes its redemptions with it, which is what makes
--                       the graph prunable as a unit (G-INV-2).
--     email_normalized  the other half of the edge. Stored already lowered and
--                       trimmed so that casing cannot produce a second row for
--                       the same person, which is what makes the primary key
--                       below an honest idempotency guarantee.
--     redeemed_at       the 180-day purge clock (G-INV-5). Without it the
--                       retention bound cannot be enforced.
--     PRIMARY KEY       (token_id, email_normalized) is not decoration. It is
--                       the in-database serialization point that makes
--                       redeem_invite idempotent per address under concurrency:
--                       two simultaneous redemptions of the same token by the
--                       same email cannot both insert, so only one can claim a
--                       use. Enforced by the database, not by application logic.
--
--     Deliberately ABSENT: no surrogate id (the pair IS the identity); no
--     user_id (no account exists at redemption time); no IP address, no user
--     agent, no request metadata. None of it is needed to answer "who invited
--     whom", and all of it would deepen a retention obligation the ADR bounds
--     rather than extends.
create table if not exists public.invite_redemptions (
  token_id         uuid not null references public.invite_tokens(id) on delete cascade,
  email_normalized text not null,
  redeemed_at      timestamptz not null default now(),
  primary key (token_id, email_normalized)
);

comment on table public.invite_redemptions is
  'One row per (token, address) redemption (0027). Joined to invite_tokens it '
  'yields the invite graph; deleted with the token it takes the graph with it. '
  'Inherits the 180-day bound from the stalled-campaign rule (G-INV-5).';

create index if not exists invite_redemptions_email_idx
  on public.invite_redemptions (email_normalized);

-- 3 · attribution on the existing allowlist ---------------------------------
--     No schema change — invited_by has existed since 0024. What it lacked was a
--     writer, and a statement of what its absence means.
comment on column public.invited_emails.invited_by is
  'Who put this address on the list. Written by redeem_invite() from the '
  'token''s created_by, and by the mint/manage surface for hand-added rows. '
  'NULL means the row predates attribution — added by hand in the SQL editor '
  'before any writer existed, or by the 0024 backfill of pre-existing accounts. '
  'DO NOT BACKFILL: a guessed attribution is indistinguishable from a recorded '
  'one, and this column is read as the invite graph.';

-- 4 · RLS — deny by default, moderators manage ------------------------------
--     Matches the invited_manage pattern from 0024: authenticated is granted DML
--     but every row is gated on is_moderator(); anon gets nothing at all. The
--     tables hold the roster of who was invited and by whom, which must not leak.
alter table public.invite_tokens enable row level security;
alter table public.invite_redemptions enable row level security;

drop policy if exists invite_tokens_manage on public.invite_tokens;
create policy invite_tokens_manage on public.invite_tokens
  for all to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

drop policy if exists invite_redemptions_manage on public.invite_redemptions;
create policy invite_redemptions_manage on public.invite_redemptions
  for all to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

revoke all on public.invite_tokens       from anon;
revoke all on public.invite_redemptions  from anon;
grant select, insert, update, delete on public.invite_tokens      to authenticated;
grant select, insert, update, delete on public.invite_redemptions to authenticated;

-- 5 · redemption ------------------------------------------------------------
--     ATOMIC, IDEMPOTENT, AND SILENT ABOUT WHY IT FAILED.
--
--     Ordering matters and is not arbitrary:
--
--       a. Resolve the token. A miss returns false immediately.
--       b. Claim the (token, email) pair by INSERTing the redemption row with
--          ON CONFLICT DO NOTHING. This is the serialization point. If the row
--          already existed, this address has already redeemed this token: heal
--          the allowlist row if needed and return true WITHOUT incrementing, so
--          a double-tap cannot burn two of twenty-five.
--       c. Only a genuinely new redemption claims a use, and it does so with a
--          single conditional UPDATE whose WHERE clause carries every validity
--          test. Under READ COMMITTED a second transaction blocks on the row
--          lock and then re-evaluates that WHERE against the committed row, so
--          two simultaneous redemptions of a 1-use token cannot both pass.
--       d. If the claim fails, the redemption row inserted in (b) is deleted —
--          undoing this call's own write — and false is returned. Partial
--          success is impossible: the whole function is one transaction.
--
--     NO ORACLE. Every failure returns plain `false`: unknown token, expired,
--     exhausted, revoked, and malformed address are indistinguishable in the
--     return value and in the (absent) error text. Timing is equalised only as
--     far as is practical in SQL — a token miss does less work than a successful
--     redemption, and closing that gap belongs at the route, not here.
create or replace function public.redeem_invite(p_token text, p_email text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email      text := lower(btrim(coalesce(p_email, '')));
  v_token      text := lower(btrim(coalesce(p_token, '')));
  v_id         uuid;
  v_created_by uuid;
  v_claimed    int;      -- GET DIAGNOSTICS ROW_COUNT is an integer, not a boolean
begin
  -- Shape check only. Deliberately permissive, and it returns the SAME false as
  -- every other failure so a malformed address is not a distinguishable answer.
  if length(v_email) > 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or v_token = '' then
    return false;
  end if;

  -- (a) resolve. Validity is re-tested inside the claim below; this lookup only
  --     establishes which row to claim, and misses cheaply.
  select t.id, t.created_by into v_id, v_created_by
    from public.invite_tokens t
   where t.token = v_token;
  if v_id is null then
    return false;
  end if;

  -- (b) claim the (token, address) pair. The primary key is the mutex.
  insert into public.invite_redemptions (token_id, email_normalized)
  values (v_id, v_email)
  on conflict (token_id, email_normalized) do nothing;
  get diagnostics v_claimed = row_count;

  if v_claimed = 0 then
    -- Already redeemed by this address. Idempotent success: no use is burned.
    -- The allowlist insert is repeated in case a prior call was interrupted
    -- between (c) and (e) — on conflict makes it a no-op when it was not.
    insert into public.invited_emails (email, invited_by, note)
    values (v_email, v_created_by, 'invite token')
    on conflict (email) do nothing;
    return true;
  end if;

  -- (c) claim a use. Every validity test lives in this WHERE clause so the
  --     check and the increment are one statement and cannot interleave.
  update public.invite_tokens t
     set uses_count = t.uses_count + 1
   where t.id = v_id
     and t.uses_count < t.max_uses
     and t.expires_at > now()
     and t.revoked_at is null;

  if not found then
    -- (d) exhausted, expired, or revoked. Undo this call's own redemption row
    --     and answer exactly as an unknown token would.
    delete from public.invite_redemptions
     where token_id = v_id and email_normalized = v_email;
    return false;
  end if;

  -- (e) the allowlist write. This is the entire point: the email is now on the
  --     list that enforce_invited_signup() reads, through the ordinary door.
  insert into public.invited_emails (email, invited_by, note)
  values (v_email, v_created_by, 'invite token')
  on conflict (email) do nothing;

  return true;
end; $$;

comment on function public.redeem_invite(text, text) is
  'Redeem a bearer invite token for one address (0027). Atomic, idempotent per '
  '(token, address), and neutral: every failure returns false with no reason. '
  'Writes to invited_emails — it is not a second signup gate.';

-- Explicit grants only. The default EXECUTE-to-PUBLIC that every function is
-- created with is revoked first, then handed back deliberately.
--
-- SERVICE_ROLE ONLY. NOT anon — and the reasoning matters, because an earlier
-- revision of this file did grant anon and the argument for it sounded right:
-- "the person redeeming has no session, so the write cannot be authorised as
-- them." That conflates an anonymous PERSON with an anonymous DATABASE ROLE. The
-- redeem route runs on the server and already holds the service key, exactly as
-- requestSignInLink() does for its allowlist read. Nothing about the redeemer
-- being logged out requires the database to trust the public key.
--
-- What the anon grant cost: PostgREST exposes the RPC to anyone holding the
-- publishable key, and a printed token is meant to be photographed and passed
-- around. A holder could point a script at a 25-use token with garbage
-- addresses and exhaust the cap before one real neighbor redeemed. The cap
-- bounds how far a leaked token reaches; it is not an allowance for abuse. And a
-- rate limit at the route means nothing if the route can be stepped around.
--
-- With service_role only, the route handler is the sole door and its rate limit
-- binds — the posture calendar_feed_payload() and submit_pledge() already use.
-- ADR §4 stands unamended.
revoke all on function public.redeem_invite(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.redeem_invite(text, text) to service_role;

-- 6 · retention -------------------------------------------------------------
--     The 180-day bound from the stalled-campaign rule, applied to the same
--     class of data for the same reason (G-INV-5).
--
--     ⚠ DELIBERATELY NOT SCHEDULED, exactly as close_stale_pledge_campaigns()
--     is not: the delete is half the obligation and telling the person is the
--     other half, SQL can only do the first, and a scheduled delete-without-
--     notice is worse than not running it. It returns the addresses it pruned
--     so a caller that can send mail performs both halves in one pass.
--
--     Scope is narrow on purpose. Only allowlist rows this subsystem created
--     are pruned — the join to invite_redemptions is what distinguishes them
--     from the founder's hand-added roster, whose lifetime is a separate
--     question this migration does not answer. An address that already has an
--     account is never pruned: the allowlist row is what lets them sign in.
create or replace function public.purge_stale_invites(
  p_max_age interval default '180 days'
)
returns table (email_normalized text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  with stale as (
    select r.token_id, r.email_normalized
      from public.invite_redemptions r
     where r.redeemed_at < now() - p_max_age
       and not exists (
         select 1 from auth.users u
          where lower(btrim(u.email)) = r.email_normalized
       )
  ),
  gone_rows as (
    delete from public.invite_redemptions d
     using stale s
     where d.token_id = s.token_id and d.email_normalized = s.email_normalized
    returning d.email_normalized
  ),
  gone_allow as (
    delete from public.invited_emails ie
     where ie.email in (select g.email_normalized from gone_rows g)
       and ie.note = 'invite token'
    returning ie.email
  )
  select g.email from gone_allow g;
end; $$;

comment on function public.purge_stale_invites(interval) is
  'Deletes redemption records older than p_max_age whose address never became '
  'an account, and the allowlist rows this subsystem wrote for them, returning '
  'the addresses removed so the caller can send notice (0027). NOT cron-'
  'scheduled — see the migration note. Never touches hand-added roster rows.';

revoke all on function public.purge_stale_invites(interval)
  from public, anon, authenticated, service_role;
grant execute on function public.purge_stale_invites(interval) to service_role;
