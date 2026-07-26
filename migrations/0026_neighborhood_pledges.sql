-- ============================================================================
-- Migration 0026 — neighborhood pledge campaigns (public /n/[slug]) — MANUAL APPLY
-- ----------------------------------------------------------------------------
-- Implements docs/decisions/neighborhood-pledge-campaigns.md (Accepted,
-- 2026-07-25) and the momentum pack (docs/decisions/steppe-momentum-pack-v1.2.md).
--
-- THE MECHANIC: Steppe opens in a neighborhood only once N households have
-- pledged. Until then: no address verification, no payment, no account. A pledge
-- is an email address and nothing else. The count and the threshold are PUBLIC —
-- on the page and reprinted on mail, yard signs, and door hangers — because the
-- count is the mechanism, not decoration: it gives a pledger a reason to return
-- and makes their outcome depend on their neighbors.
--
-- WHY THIS EXTENDS `neighborhoods` RATHER THAN ADDING A PARALLEL TABLE:
--   Slugs are printed on physical mail and a printed URL cannot be changed. A
--   second table would create a second slug namespace and force a reconciliation
--   when a pledger converts to a member. One namespace means the URL is stable
--   across the threshold event and the conversion is a join against the same row.
--   (Decision record § Schema; the pledge_neighborhoods alternative was rejected.)
--
-- G-flags / decisions taken here:
--   G-PLG-a  `threshold` is NULLABLE, not `not null`. The 35 seeded Redmond rows
--            are membership geography, not campaigns. NULL = "not running a
--            campaign" = no public /n/ page = 404. Steppe does not publish a
--            browsable directory of neighborhoods it has no presence in. The
--            founder opts a neighborhood in by hand with one UPDATE.
--   G-PLG-b  `pledges` is deny-by-default at BOTH layers: RLS enabled with ZERO
--            policies, AND every table privilege revoked from anon,
--            authenticated, and service_role. No client role can read or write it
--            under any query shape — not by policy, not by grant, not via a view
--            or a PostgREST embed. Every access is through the SECURITY DEFINER
--            functions in this migration, which run as the table owner. This is
--            the interest_signups posture (0014) taken one step further: 0014
--            still grants service_role direct table access; this does not.
--   G-PLG-c  `pledges` is deliberately NOT append-only, and is deliberately NOT
--            registered with the 0012 backstop. Removal is a HARD DELETE via
--            token — consistent with verify-then-forget: when someone leaves,
--            nothing is retained. A reader who expects the append-only norm here
--            should read this as an intentional exception, not an omission.
--   G-PLG-d  A pledge holds no user_id and no member-authored content — it is
--            pre-account data keyed by email, exactly like invited_emails
--            (G-INV-a). delete_my_account() is therefore left unchanged: a
--            member who deletes their account may still hold a pledge under the
--            same address, and removes it with the token in their own email.
--   G-PLG-e  A threshold may be LOWERED mid-campaign and may not be RAISED once
--            anyone has pledged — people pledged in reliance on the printed
--            number. Enforced by trg_guard_neighborhood_threshold below, which
--            binds every role including the owner. Correcting a genuine typo is
--            therefore a deliberate two-step (disable trigger, fix, re-enable),
--            which is the intended friction on a consequential edit (invariant 10).
--
-- RETENTION — the known departure, stated plainly (decision record § Data handling):
--   The rest of Steppe avoids holding contact data. A pledge address is held
--   until the neighborhood reaches threshold, which may be months or never. That
--   obligation is BOUNDED at 180 days from a neighborhood's first pledge; the
--   purge itself lands with the deletion paths in this migration.
--
-- STUDIO-SAFE: pure SQL, no psql meta-commands. Prove first with
-- seed/matrix-0026.sql (one rolled-back transaction, writes nothing), then apply
-- BY HAND in the Supabase SQL editor as owner at the stop-gate — verify the
-- project-ref first. Record it in docs/migrations-applied.md once applied.
-- Safe to re-run.
-- ============================================================================

-- 1 · the campaign columns on the existing neighborhoods table ---------------
--     Both nullable. `threshold` NULL means no campaign (G-PLG-a). `opened_at`
--     is the HUMAN-RECORDED fact that the neighborhood actually went live — it
--     is never stamped by a trigger when the count crosses. Crossing the
--     threshold is arithmetic; opening a neighborhood is work a person does
--     (notifying every pledger, seeding the first content). Deriving "open" from
--     the count alone would let the page claim "neighbors here are already
--     posting" before that was true. Invariant 5: automation surfaces the count,
--     a human records the opening.
alter table public.neighborhoods
  add column if not exists threshold int,
  add column if not exists opened_at timestamptz;

alter table public.neighborhoods
  drop constraint if exists neighborhoods_threshold_positive;
alter table public.neighborhoods
  add constraint neighborhoods_threshold_positive
  check (threshold is null or threshold > 0);

comment on column public.neighborhoods.threshold is
  'Pledge campaign threshold (households). NULL = not running a campaign, so '
  'neighborhood_status() returns no row and /n/<slug> is a 404 (0026, G-PLG-a). '
  'May be lowered mid-campaign, never raised once anyone has pledged (G-PLG-e).';
comment on column public.neighborhoods.opened_at is
  'Set BY HAND when the neighborhood actually opened — never stamped by a '
  'trigger on the count crossing. This is the human-in-the-loop record that the '
  'neighborhood is live, and it is what is_open reports (0026).';

-- 2 · a threshold may be lowered, never raised once anyone has pledged --------
--     Deliberately NOT security definer and with no role test: it binds the
--     owner and service_role too, the way the 0012 append-only backstop does.
--     Starting a campaign (NULL -> n) and lowering (n -> smaller) both pass.
create or replace function public.guard_neighborhood_threshold()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.threshold is not null
     and old.threshold is not null
     and new.threshold > old.threshold
     and exists (select 1 from public.pledges p where p.neighborhood_id = old.id)
  then
    raise exception
      'a pledge threshold cannot be raised once neighbors have pledged (was %, tried %)',
      old.threshold, new.threshold
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

comment on function public.guard_neighborhood_threshold() is
  'Refuses raising a pledge threshold once anyone has pledged — they pledged in '
  'reliance on the printed number (0026, G-PLG-e). Binds every role, owner '
  'included. Correcting a genuine typo is a deliberate disable/fix/re-enable.';

-- 3 · the pledge record ------------------------------------------------------
--     A neighborhood reference, a normalized email, a removal token, a
--     timestamp. No name, no street address, no payment information, no
--     identity evidence — and no user_id (G-PLG-d).
create table if not exists public.pledges (
  id               uuid primary key default gen_random_uuid(),
  neighborhood_id  uuid not null references public.neighborhoods(id) on delete cascade,
  email_normalized text not null,
  removal_token    uuid not null default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  unique (neighborhood_id, email_normalized)
);

comment on table public.pledges is
  'Pre-member pledge capture for the /n/<slug> campaign (0026). NEVER readable '
  'by any client role under any policy or grant (G-PLG-b) — reads happen only '
  'through neighborhood_status() / pledge_activity(). Not append-only: removal '
  'is a hard delete via removal_token (G-PLG-c).';

-- The trigger below is defence in depth, not the primary normalizer: submit_pledge()
-- lowercases and trims before it inserts. This guarantees the stored value is
-- canonical no matter which path writes it (a future backfill, a founder INSERT),
-- so the unique constraint can never be defeated by casing or a stray space.
-- Mirrors normalize_invited_email() (0024).
create or replace function public.normalize_pledge_email()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.email_normalized := lower(btrim(coalesce(new.email_normalized, '')));
  if new.email_normalized = '' then
    raise exception 'pledges.email_normalized must be non-empty'
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

drop trigger if exists trg_normalize_pledge_email on public.pledges;
create trigger trg_normalize_pledge_email
  before insert or update on public.pledges
  for each row execute function public.normalize_pledge_email();

-- Deferred to here: the guard reads public.pledges, so the table must exist first.
drop trigger if exists trg_guard_neighborhood_threshold on public.neighborhoods;
create trigger trg_guard_neighborhood_threshold
  before update on public.neighborhoods
  for each row execute function public.guard_neighborhood_threshold();

-- 4 · indexes ----------------------------------------------------------------
--     The count query filters by neighborhood on every page render and every
--     submission, so it gets the index the spec asks for.
create index if not exists pledges_neighborhood_idx
  on public.pledges (neighborhood_id);

--     The removal path looks a row up by token alone. UNIQUE rather than a plain
--     index because "one token addresses exactly one row" is a correctness
--     property of the removal contract, not merely a lookup convenience — it is
--     what makes "deletes exactly one row and nothing else" true by construction
--     rather than by hope. (gen_random_uuid collisions are not a real risk; this
--     documents and enforces the contract.)
create unique index if not exists pledges_removal_token_idx
  on public.pledges (removal_token);

-- 5 · RLS + privileges: deny-by-default at BOTH layers (G-PLG-b) -------------
alter table public.pledges enable row level security;

-- NO POLICIES, BY DESIGN. Do not add a SELECT policy for anon or authenticated
-- under any condition, and do not add an INSERT policy for anon — submission
-- flows through submit_pledge(), which is the only place the per-IP rate limit,
-- the honeypot, and the confirmation send can be enforced together.
--
-- Belt and braces: RLS alone would still leave the table-level privilege that
-- Supabase's default grants hand to anon/authenticated/service_role on a new
-- public table. Revoke it, so the table is unreachable by privilege as well as
-- by policy. service_role is revoked too (unlike interest_signups, 0014): the
-- admin client must not be able to `.from("pledges").select()`, because that
-- would be a second door past the definer functions and past the moderator gate
-- on pledge_activity(). The SECURITY DEFINER functions run as the table OWNER,
-- so they are unaffected by every revoke here.
revoke all on public.pledges from anon, authenticated, service_role;

-- No UPDATE or DELETE path exists for any client role, by policy or by grant.
-- Deletion happens only through the token path in the deletion-path section of
-- this migration.

-- 6 · the public count — the ONLY way a client learns anything about pledges ---
--     Returns an aggregate and four public facts, nothing else. No email, no id,
--     no removal token, no timestamp: nothing that could enumerate or correlate
--     the people who pledged. The RETURNS TABLE signature is the contract — a
--     column added to `pledges` later cannot widen it by accident.
--
--     UNKNOWN SLUG RETURNS ZERO ROWS RATHER THAN RAISING, so the page renders a
--     clean 404 instead of catching an exception. `threshold is not null` in the
--     predicate is what makes a non-campaign neighborhood indistinguishable from
--     a nonexistent one: Steppe does not publish a browsable directory of
--     neighborhoods it has no presence in (G-PLG-a).
--
--     `is_open` is `opened_at is not null` — the human-recorded fact, NOT
--     `pledge_count >= threshold`. Crossing the threshold is arithmetic; opening
--     a neighborhood is work a person does. The page distinguishes the two
--     states itself by comparing the count to the threshold it already has, so
--     "threshold reached, opening soon" never becomes the false claim that
--     neighbors are already posting there (invariant 5).
create or replace function public.neighborhood_status(p_slug text)
returns table (
  slug         text,
  name         text,
  threshold    int,
  pledge_count bigint,
  is_open      boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  select n.slug,
         n.name,
         n.threshold,
         (select count(*) from public.pledges p where p.neighborhood_id = n.id),
         (n.opened_at is not null)
    from public.neighborhoods n
   where n.slug = lower(btrim(coalesce(p_slug, '')))
     and n.threshold is not null;
$$;

comment on function public.neighborhood_status(text) is
  'Public pledge count for /n/<slug> (0026). Aggregate only — never a row, an '
  'id, an address, or a timestamp. Zero rows for an unknown slug or a '
  'neighborhood with no campaign, so the route 404s cleanly.';

-- Explicit grants only. The default EXECUTE-to-PUBLIC that every function is
-- created with is revoked first, then handed back to exactly the two client
-- roles that need it — anon included, because the page must render its count
-- for someone who scanned a QR code and has no account and never will.
revoke all on function public.neighborhood_status(text)
  from public, anon, authenticated, service_role;
grant execute on function public.neighborhood_status(text) to anon, authenticated;

-- The two trigger functions above are created with the default EXECUTE-to-PUBLIC
-- like every other function. A trigger function cannot usefully be invoked as an
-- RPC (Postgres refuses to call one outside a trigger context), so this is
-- hygiene rather than a hole — but 34 of the 44 pre-existing SECURITY DEFINER
-- functions in this database still carry that default grant, and this migration
-- should not add two more to that pile. Explicit grants only, everywhere.
revoke all on function public.normalize_pledge_email()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_neighborhood_threshold()
  from public, anon, authenticated, service_role;

-- 7 · submission -------------------------------------------------------------
--     WHY service_role AND NOT anon, despite anon being the caller in spirit:
--     if anon could execute this, PostgREST would expose it as a public RPC and
--     a script could call it directly — skipping the route handler, and with it
--     the per-IP rate limit, the honeypot, and the confirmation send. The limit
--     would be decorative. Routing every submission through the route handler,
--     which holds the only service-role key, is what makes those three real.
--     Same posture as calendar_feed_payload() (0020).
--
--     Returns ONLY the four public facts. Not the row, not the id, not the
--     removal token — the token is fetched separately by the one caller that
--     needs it (the confirmation email), so it cannot ride along in an HTTP
--     response by accident.
create or replace function public.submit_pledge(p_slug text, p_email text)
returns table (
  pledge_count    bigint,
  threshold       int,
  is_open         boolean,
  already_pledged boolean
)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id        uuid;
  v_threshold int;
  v_opened    timestamptz;
  v_email     text := lower(btrim(coalesce(p_email, '')));
  v_rows      int;
  v_count     bigint;
begin
  -- Server-side shape validation. The client validates too, for a decent error
  -- message; this is the one that counts. Deliberately permissive on the local
  -- part — real addresses are stranger than most patterns allow, and the cost of
  -- rejecting a valid address is a neighbor who does not pledge.
  if length(v_email) > 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid email address' using errcode = 'check_violation';
  end if;

  select n.id, n.threshold, n.opened_at
    into v_id, v_threshold, v_opened
    from public.neighborhoods n
   where n.slug = lower(btrim(coalesce(p_slug, '')))
     and n.threshold is not null;

  if v_id is null then
    raise exception 'no pledge campaign for that neighborhood'
      using errcode = 'no_data_found';
  end if;

  insert into public.pledges (neighborhood_id, email_normalized)
  values (v_id, v_email)
  on conflict (neighborhood_id, email_normalized) do nothing;
  get diagnostics v_rows = row_count;

  select count(*) into v_count
    from public.pledges p where p.neighborhood_id = v_id;

  -- already_pledged is derived from ROW_COUNT, never from a prior lookup: we do
  -- not read the table to ask "is this address here already", because that read
  -- is the enumeration oracle we are trying not to build. The conflict tells us.
  return query select v_count, v_threshold, (v_opened is not null), (v_rows = 0);
end; $$;

comment on function public.submit_pledge(text, text) is
  'Records one pledge and returns the four public facts (0026). service_role '
  'only, so the route handler''s rate limit and honeypot cannot be bypassed by '
  'calling the RPC directly. Idempotent per (neighborhood, email).';

revoke all on function public.submit_pledge(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_pledge(text, text) to service_role;

-- 8 · the removal token, fetched only to compose the confirmation email -------
--     Split from submit_pledge so that function's return can stay exactly the
--     four public facts. The token goes into the email body server-side and
--     never enters an HTTP response.
create or replace function public.pledge_removal_token(p_slug text, p_email text)
returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.removal_token
    from public.pledges p
    join public.neighborhoods n on n.id = p.neighborhood_id
   where n.slug = lower(btrim(coalesce(p_slug, '')))
     and p.email_normalized = lower(btrim(coalesce(p_email, '')));
$$;

comment on function public.pledge_removal_token(text, text) is
  'Returns one pledge''s removal token so the confirmation email can carry the '
  'unsubscribe link (0026). service_role only — never reachable by a client.';

revoke all on function public.pledge_removal_token(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.pledge_removal_token(text, text) to service_role;

-- 9 · removal: a hard delete, by token (G-PLG-c) ------------------------------
--     Verify-then-forget applied to pre-member data: when someone leaves,
--     nothing is retained — no tombstone, no suppression flag, no "unsubscribed"
--     row. The token is the whole credential, exactly like the calendar feed
--     token (0020), and pledges_removal_token_idx makes "exactly one row" a
--     property of the schema rather than of this function's WHERE clause.
create or replace function public.remove_pledge(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_rows int;
begin
  if p_token is null then
    return false;
  end if;
  delete from public.pledges where removal_token = p_token;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end; $$;

comment on function public.remove_pledge(uuid) is
  'Hard-deletes one pledge by removal token and reports whether it existed '
  '(0026). Nothing is retained. service_role only.';

revoke all on function public.remove_pledge(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.remove_pledge(uuid) to service_role;

-- 10 · the after-the-fact anomaly view (moderators) ---------------------------
--      The count is public and printed on signage, which makes it a target for
--      inflation. Steppe deliberately does not answer that with CAPTCHA, a
--      confirmation loop, or address verification: at this scale those suppress
--      genuine conversions far more than abuse, and verifying an address at
--      pledge time would defeat the mechanic outright. The proportionate defence
--      for a number whose only consequence is when an email is sent is to make
--      anomalies VISIBLE after the fact — a burst of pledges within one minute
--      reads very differently from twenty spread over a week.
--
--      Timestamps and counts only. No address ever leaves this function, so a
--      moderator reviewing for abuse still cannot see who pledged.
create or replace function public.pledge_activity()
returns table (
  slug         text,
  name         text,
  threshold    int,
  pledge_count bigint,
  pledged_at   timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_moderator() then
    raise exception 'pledge activity is moderators only'
      using errcode = 'insufficient_privilege';
  end if;
  return query
    select n.slug, n.name, n.threshold,
           count(*) over (partition by n.id)::bigint,
           p.created_at
      from public.pledges p
      join public.neighborhoods n on n.id = p.neighborhood_id
     order by n.slug, p.created_at desc;
end; $$;

comment on function public.pledge_activity() is
  'Moderator-only pledge timestamps grouped by neighborhood, for spotting '
  'inflation after the fact (0026). Never returns an email address.';

revoke all on function public.pledge_activity()
  from public, anon, authenticated, service_role;
grant execute on function public.pledge_activity() to authenticated;   -- gated internally

-- 11 · the retention bound (decision record § Data handling) ------------------
--      THE KNOWN DEPARTURE, BOUNDED. The rest of Steppe avoids holding contact
--      data at all; a pledge address is held until the neighborhood reaches its
--      threshold, which may be months, or never. The published commitment bounds
--      that at 180 days from a neighborhood's FIRST pledge: the records are
--      deleted and those people are told the campaign closed.
--
--      ⚠ DELIBERATELY NOT SCHEDULED. Unlike close_due_proposals() (0010) there is
--      no cron.schedule() call here, because the commitment has two halves —
--      delete AND notify — and SQL can only do the first. Scheduling this alone
--      would silently delete addresses without telling anyone, which is worse
--      than not running it. It therefore returns the addresses it removed, so a
--      caller that can send mail performs both halves in one pass. Wiring that
--      caller is a separate decision; until then this is invoked by hand.
create or replace function public.close_stale_pledge_campaigns(
  p_max_age interval default '180 days'
)
returns table (slug text, email_normalized text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  with stale as (
    select n.id, n.slug
      from public.neighborhoods n
     where n.threshold is not null
       and n.opened_at is null
       and (select min(p.created_at) from public.pledges p
             where p.neighborhood_id = n.id) < now() - p_max_age
  ),
  gone as (
    delete from public.pledges p
     where p.neighborhood_id in (select s.id from stale s)
    returning p.neighborhood_id, p.email_normalized
  )
  select s.slug, g.email_normalized
    from gone g join stale s on s.id = g.neighborhood_id;
end; $$;

comment on function public.close_stale_pledge_campaigns(interval) is
  'Deletes every pledge for a campaign that has not opened within p_max_age of '
  'its first pledge, returning the addresses removed so the caller can send the '
  'campaign-closed notice (0026). NOT cron-scheduled — see the migration note.';

revoke all on function public.close_stale_pledge_campaigns(interval)
  from public, anon, authenticated, service_role;
grant execute on function public.close_stale_pledge_campaigns(interval) to service_role;
