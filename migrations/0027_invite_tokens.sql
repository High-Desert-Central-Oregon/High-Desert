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
--   G-INV-4  redeem_invite() is granted to ANON. The redeemer has no session and
--            no account yet, so the write cannot be authorised as them. This is
--            the only function in this migration that anon can reach.
--            ⚑ Consequence, stated so it is not discovered later: because anon
--            can call it directly through PostgREST, a rate limit applied at the
--            route handler is advisory, not binding. See the note at the GRANT.
--   G-INV-5  Redemption records inherit the 180-day bound from the stalled-
--            campaign rule (docs/decisions/neighborhood-pledge-campaigns.md):
--            they hold an email address in the hope of a conversion that may
--            never come, which is the same class of data for the same reason.
--
-- STUDIO-SAFE: pure SQL, no psql meta-commands. Prove first with
-- seed/matrix-0027.sql (one rolled-back transaction, writes nothing), then apply
-- BY HAND in the Supabase SQL editor as owner at the stop-gate — verify the
-- project-ref first. Record it in docs/migrations-applied.md once applied.
-- Safe to re-run.
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
  created_at  timestamptz not null default now()
);

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
-- ANON IS INTENTIONAL (G-INV-4): the person redeeming has no session and no
-- account, so the write cannot be authorised as them.
-- ⚑ CONSEQUENCE: PostgREST therefore exposes this as a public RPC, so any rate
--   limit applied at the route handler can be bypassed by calling the function
--   directly. The token's 128 bits make guessing infeasible and the cap bounds
--   what a valid token can do, but unbounded failed-lookup traffic is not
--   bounded by anything in this migration. If that becomes a problem the fix is
--   to revoke anon and route through service_role, which makes the route the
--   only door — the posture calendar_feed_payload() and submit_pledge() already
--   use. Recorded here rather than discovered later.
revoke all on function public.redeem_invite(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.redeem_invite(text, text) to anon, service_role;

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
