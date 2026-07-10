# Dry-run runbook — Steppe (Step 10)

Two end-to-end walkthroughs that double as an **invariant smoke test** for the
closed-beta hardening. Walkthrough A is the first conflict (verify → post →
remove → appeal → overturn → restore). Walkthrough B is the first vote (open →
weighted ballots → revise → close → result). Section C is the targeted negative
checks that prove the RLS hardening (G1–G5 from [docs/rls-audit.md](rls-audit.md))
holds end to end.

> ⚠️ **Staging / dev only.** This drives the synthetic accounts from
> [seed/dry-run-accounts.sql](../seed/dry-run-accounts.sql), **not** the real
> cohort. Run it against a throwaway database.

---

## How to run it

The runbook is **pure SQL**, so it needs neither the magic-link email (still on
Resend, not wired) nor the UI. It exercises the *real* policies the way the app
does, using Supabase's standard RLS-testing pattern: become the `authenticated`
role and set the JWT `sub` to the member you're acting as. Every check is a copy-
paste block.

**Setup**

1. Apply `schema.sql` to a fresh staging DB — that's all. `schema.sql` is the
   complete current schema (the snapshot through head). The numbered migrations
   `0001`–`0016` are historical deltas already folded into it (except `0016`, the
   Supabase-only Storage bucket, applied separately); they exist only to
   bring an *existing* DB forward and must **not** be replayed on top of
   `schema.sql` (doing so collides — e.g. `0003` fails with `cannot drop columns
   from view`, since the snapshot already has the evolved `proposal_results`). If
   you are instead migrating a pre-existing DB and reach `0010` (scheduled close)
   without the `pg_cron` extension, skip it — the manual close still works.
2. Run [seed/dry-run-accounts.sql](../seed/dry-run-accounts.sql). Confirm the
   roster check at the end prints the six accounts spanning weights 1.0 / 1.5 / 2.0 / 3.0.
   Then run [seed/dry-run-groups.sql](../seed/dry-run-groups.sql) (it depends on the
   accounts) for the §D groups checks; its roster check prints the three preset
   groups and their members.
3. Run the blocks below **in order**, as the project owner (Supabase SQL editor =
   `postgres`, or `psql` as a superuser). Select a whole block and run it as one
   statement batch.

**The impersonation pattern.** Each "▶ **as &lt;Name&gt;**" block is a
transaction that switches to the member's identity, does the action, and either
`commit`s (keep the state) or `rollback`s (a probe we don't want to persist). The
owner bypasses RLS, so the `set local role authenticated` line is what makes the
policies actually apply:

```sql
begin;
  -- become the member: auth.uid() now returns this sub, and RLS is enforced
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000XX","role":"authenticated"}', true);
  set local role authenticated;

  -- ...the member's action(s)...

commit;   -- or: rollback;  (for a probe / negative check)
```

Blocks marked **▶ as owner** are plain reads run without impersonation (e.g.
`vote_weight_for`, which is intentionally *not* callable by members — see G2).

**The cast** (UUIDs you'll paste as the `sub`):

| Short | Name | UUID | Role | Neighborhood | Weight |
|---|---|---|---|---|---|
| a1 | Aida Ramirez | `00000000-0000-0000-0000-0000000000a1` | member | Braydon Park | 3.0× (4 yr+) |
| b2 | Ben Okafor | `00000000-0000-0000-0000-0000000000b2` | member | Braydon Park | 1.5× (1–2 yr) |
| c3 | Carla Nguyen | `00000000-0000-0000-0000-0000000000c3` | member | Canyon Crossing | 1.0× (< 1 yr) |
| d4 | Diego Flores | `00000000-0000-0000-0000-0000000000d4` | member (unverified) | Canyon Crossing | — → 1.0× |
| e5 | Esther Cohen | `00000000-0000-0000-0000-0000000000e5` | **moderator** | Deer Crossing | 3.0× (4 yr+) |
| f6 | Frank Mbeki | `00000000-0000-0000-0000-0000000000f6` | **moderator** | Deer Crossing | 2.0× (2–4 yr) |

Fixed content UUIDs created during the run (so every check can reference them):

| What | UUID |
|---|---|
| Diego's verification | `0d000000-0000-0000-0000-000000000001` |
| Diego's event | `0e000000-0000-0000-0000-000000000001` |
| Esther's removal action | `0a000000-0000-0000-0000-000000000001` |
| Aida's proposal (the vote) | `0b000000-0000-0000-0000-000000000001` |
| G1 probe proposal | `0c000000-0000-0000-0000-000000000001` |

If a run gets messy, reset for a clean slate: `supabase db reset` → apply
`schema.sql` → run the seed. (The append-only tables are immutable in place since
migration 0012, so there's no in-place teardown — the seed is fresh-DB-only.)

---

## Walkthrough A — the first conflict

Diego (a newcomer) verifies, posts an event, a moderator mistakenly removes it,
Diego appeals, and a **different** moderator overturns it and restores the event.
Proves: verify-then-forget, the audit chain, separation of duties, and the
legible remove/restore flow.

### A0 · Pre-state — Diego is an unverified newcomer

**▶ as owner**

```sql
select verified, tenure_start from profiles
where id = '00000000-0000-0000-0000-0000000000d4';
-- Expected: verified = false, tenure_start = null
```

### A1 · Diego submits a verification

**▶ as Diego** (`...d4`) — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
  set local role authenticated;

  insert into verifications (id, user_id, method, evidence_path) values (
    '0d000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000d4',
    'utility_bill',
    'd4/utility-bill.jpg'   -- pointer into the private evidence bucket (simulated)
  );
commit;
-- Expected: INSERT 1. vf_insert allows own row with status defaulting to 'pending'.
```

Confirm it's pending and the evidence pointer is present:

```sql
select status, evidence_path, reviewed_by from verifications
where id = '0d000000-0000-0000-0000-000000000001';
-- Expected: pending | d4/utility-bill.jpg | null
```

### A1-neg · Diego cannot verify himself (invariant 2, G3)

**▶ as Diego** — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
  set local role authenticated;

  -- (a) direct UPDATE: there is NO update policy on verifications (G3 dropped it)
  update verifications set status = 'approved'
  where id = '0d000000-0000-0000-0000-000000000001';
  -- Expected: UPDATE 0 — RLS permits no row; the half-state path is closed.

  -- (b) the RPC self-guards on is_moderator()
  select public.decide_verification('0d000000-0000-0000-0000-000000000001', true);
  -- Expected: ERROR  only moderators may decide verifications
rollback;
```

### A2 · Esther (moderator) approves — verify, then forget

**▶ as Esther** (`...e5`) — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}', true);
  set local role authenticated;

  select public.decide_verification('0d000000-0000-0000-0000-000000000001', true);
commit;
-- Expected: the RPC sets status=approved, stamps reviewer, sets profiles.verified
-- + tenure_start, purges the evidence pointer, and writes the audit entry.
```

Confirm all four guarantees at once:

```sql
select status, evidence_path, reviewed_by is not null as reviewed
  from verifications where id = '0d000000-0000-0000-0000-000000000001';
-- Expected: approved | null (← evidence pointer purged: verify-then-forget) | true

select verified, tenure_start = current_date as tenure_set
  from profiles where id = '00000000-0000-0000-0000-0000000000d4';
-- Expected: true | true  (Diego is now verified, tenure starts today → 1.0× tier)

select action, actor_id from audit_log
where entity = 'verification' and entity_id = '0d000000-0000-0000-0000-000000000001';
-- Expected: verification.approved | ...e5  (the deciding moderator)
```

> The DB drops the `evidence_path` pointer synchronously (shown above). The
> Storage *object* itself is deleted in-app by the `decideVerification` server
> action (service-role client, delete-before-commit) — out of scope for a SQL
> dry-run, but the pointer purge is the row-level half of verify-then-forget.

### A3 · Diego posts an event

**▶ as Diego** — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
  set local role authenticated;

  insert into events (id, creator_id, neighborhood_id, title, body, starts_at, location)
  values (
    '0e000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000d4',
    (select id from neighborhoods where slug = 'canyon-crossing'),
    'Canyon Crossing tool-share',
    'Bring anything you can lend — drills, ladders, a wheelbarrow.',
    timestamptz '2026-07-01 17:00-07:00',
    'My driveway'
  );
commit;
-- Expected: INSERT 1. ev_insert requires is_verified() AND creator_id = own — both true now.

select public.is_content_hidden('event', '0e000000-0000-0000-0000-000000000001');
-- Expected: false (visible)
```

### A4 · Esther removes it — with a reason (the legible takedown)

A good-faith mistake: Esther thinks Diego posted to the wrong neighborhood.

**▶ as Esther** — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}', true);
  set local role authenticated;

  insert into moderation_actions (id, target_type, target_id, actor_id, action, reason)
  values (
    '0a000000-0000-0000-0000-000000000001',
    'event', '0e000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000e5',
    'remove',
    'Looks posted to the wrong neighborhood — please repost in your own.'
  );
commit;
-- Expected: INSERT 1. The reason CHECK requires non-empty text; trg_log_moderation
-- writes the 'moderation.remove' audit entry automatically.
```

Confirm hidden, with a reason, and audited:

```sql
select public.is_content_hidden('event', '0e000000-0000-0000-0000-000000000001');
-- Expected: true (now hidden)

select action, reason, actor_id from content_moderation
where target_id = '0e000000-0000-0000-0000-000000000001';
-- Expected: remove | 'Looks posted to the wrong neighborhood…' | ...e5

select action, actor_id from audit_log
where entity_id = '0e000000-0000-0000-0000-000000000001';
-- Expected: moderation.remove | ...e5
```

### A5 · The affected member appeals — and only the affected member can

**▶ as Ben** (`...b2`, a bystander) — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
  set local role authenticated;

  select public.file_appeal('0a000000-0000-0000-0000-000000000001', 'Seems harsh.');
  -- Expected: ERROR  only the affected member may appeal this action
rollback;
```

**▶ as Diego** (the event's creator) — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
  set local role authenticated;

  select public.file_appeal(
    '0a000000-0000-0000-0000-000000000001',
    'This IS my own neighborhood — I live in Canyon Crossing. Please restore it.'
  );
commit;
-- Expected: returns the new appeal's UUID.
```

Capture the appeal id (used in A6/A7):

```sql
select id, status from appeals
where moderation_action_id = '0a000000-0000-0000-0000-000000000001';
-- Expected: <appeal-uuid> | open
```

### A6 · Separation of duties — the acting moderator cannot judge her own action

**▶ as Esther** (who did the removal) — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}', true);
  set local role authenticated;

  -- paste the appeal id from A5
  select public.resolve_appeal('<appeal-uuid>', false, 'On reflection, restore it.');
  -- Expected: ERROR  separation of duties: you cannot resolve an appeal of your own action
rollback;
```

### A7 · A different moderator overturns → the event is restored

**▶ as Frank** (`...f6`, did not act before) — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true);
  set local role authenticated;

  -- paste the appeal id from A5
  select public.resolve_appeal(
    '<appeal-uuid>', false,
    'Confirmed Diego lives in Canyon Crossing; the removal was a mistake.'
  );
commit;
-- Expected: p_uphold=false → appeal 'overturned'; the RPC inserts a 'restore'
-- moderation_actions row (un-hiding the event) and writes 'appeal.overturned'.
```

Confirm the appeal resolved, the event restored, and the full chain:

```sql
select status from appeals
where moderation_action_id = '0a000000-0000-0000-0000-000000000001';
-- Expected: overturned

select public.is_content_hidden('event', '0e000000-0000-0000-0000-000000000001');
-- Expected: false (restored — latest action is 'restore')

select action, actor_id, reason from moderation_actions
where target_id = '0e000000-0000-0000-0000-000000000001'
order by created_at;
-- Expected, in order:
--   remove  | ...e5 | 'Looks posted to the wrong neighborhood…'
--   restore | ...f6 | 'Appeal overturned: Confirmed Diego lives in Canyon Crossing…'
```

### A8 · The public transparency view

This is the exact shape the transparency page reads — moderation/appeal events,
**naming the acting moderator, never the moderated member** (DECISIONS,
2026-06-09).

```sql
select action, entity, actor_id, metadata->>'reason' as reason, created_at
from audit_log
where action like 'moderation.%' or action like 'appeal.%'
order by created_at;
-- Expected three rows, in order:
--   moderation.remove    | event  | ...e5 (Esther) | 'Looks posted…'
--   appeal.overturned    | appeal | ...f6 (Frank)  | 'Confirmed Diego lives…'
--   moderation.restore   | event  | ...f6 (Frank)  | 'Appeal overturned: …'
-- Note: actor_id is always a MODERATOR. Diego (the moderated member) appears in
-- none of these rows — accountability runs toward power, not the member.
```

---

## Walkthrough B — the first vote

Aida opens a proposal with a short window. The three tenure tiers each cast a
weighted ballot; Aida revises hers before close. While open, **no tally is
visible and no member can read another's ballot**. After the clock passes
`closes_at`, the weighted aggregate appears and a moderator records the official
close. Proves: server-set weight, secret ballot, results-by-clock, the close
audit.

### B0 · Pre-state — the four tiers (Business Plan v12, 1×–3×)

**▶ as owner**

```sql
select p.display_name, p.tenure_start, public.vote_weight_for(p.id) as weight
from profiles p
where p.id in ('00000000-0000-0000-0000-0000000000c3',   -- Carla  < 1 yr
               '00000000-0000-0000-0000-0000000000b2',   -- Ben    1–2 yr
               '00000000-0000-0000-0000-0000000000f6',   -- Frank  2–4 yr
               '00000000-0000-0000-0000-0000000000a1')   -- Aida   4 yr+
order by weight;
-- Expected: Carla 1.0 · Ben 1.5 · Frank 2.0 · Aida 3.0
```

### B1 · Aida opens a proposal (short window)

**▶ as Aida** (`...a1`) — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;

  insert into proposals (id, author_id, title, body, kind, opens_at, closes_at)
  values (
    '0b000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000a1',
    'Adopt the Saturday tool-share as a standing monthly event',
    'A three-month trial, first Saturday each month.',
    'minor',
    now() - interval '1 minute',     -- already open
    now() + interval '5 minutes'     -- closes in ~5 min — adjust if you need longer
  );
commit;
-- Expected: INSERT 1 (pr_insert: verified + author = own). status defaults 'open';
-- trg_log_proposal_created writes 'proposal.created'.

select action, metadata->>'kind' as kind from audit_log
where entity = 'proposal' and entity_id = '0b000000-0000-0000-0000-000000000001';
-- Expected: proposal.created | minor
```

> The window is real wall-clock time — that is the security property, not an
> inconvenience (results reveal on the clock, not a flag). Cast the ballots in
> B2/B3 and run the open-state checks now, then **wait until the window passes**
> for B4. Need more time? Reset (`supabase db reset` → `schema.sql` → seed) and
> open the proposal with a longer `closes_at`.

### B2 · Members across the tiers vote (and clear the turnout floor)

Each member sends **only a choice** — the trigger sets `user_id` and `weight`
from tenure. The upsert mirrors the app's `castVote`. **Five** members vote here,
on purpose: the privacy floor (migration 0008) withholds the weighted breakdown
until at least 5 distinct members have voted, so five clears it and B4 can show
the tiers. (Voters span all four tiers: Carla 1.0, Ben 1.5, Diego 1.0, Frank 2.0,
Aida 3.0.)

**▶ as Carla** (1.0×) — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
  set local role authenticated;

  insert into votes (proposal_id, choice)
  values ('0b000000-0000-0000-0000-000000000001', 'yes')
  on conflict (proposal_id, user_id) do update set choice = excluded.choice;
commit;
-- Expected: 1 row; trg_set_vote_weight stamps user_id=Carla, weight=1.0.
```

**▶ as Ben** (1.5×) — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
  set local role authenticated;

  insert into votes (proposal_id, choice)
  values ('0b000000-0000-0000-0000-000000000001', 'yes')
  on conflict (proposal_id, user_id) do update set choice = excluded.choice;
commit;
```

**▶ as Diego** (1.0×, verified in Walkthrough A) — votes **no** — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
  set local role authenticated;

  insert into votes (proposal_id, choice)
  values ('0b000000-0000-0000-0000-000000000001', 'no')
  on conflict (proposal_id, user_id) do update set choice = excluded.choice;
commit;
```

**▶ as Frank** (2.0×, a moderator is also a verified member) — votes **yes** — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true);
  set local role authenticated;

  insert into votes (proposal_id, choice)
  values ('0b000000-0000-0000-0000-000000000001', 'yes')
  on conflict (proposal_id, user_id) do update set choice = excluded.choice;
commit;
```

**▶ as Aida** (3.0×) — votes **no** first — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;

  insert into votes (proposal_id, choice)
  values ('0b000000-0000-0000-0000-000000000001', 'no')
  on conflict (proposal_id, user_id) do update set choice = excluded.choice;
commit;
```

### B3 · Aida revises her ballot before close (coercion-resistance)

**▶ as Aida** — changes `no` → `abstain` — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;

  insert into votes (proposal_id, choice)
  values ('0b000000-0000-0000-0000-000000000001', 'abstain')
  on conflict (proposal_id, user_id) do update set choice = excluded.choice;
commit;
-- Expected: vt_update permits the change while open; weight re-derived (3.0).
-- One row per member throughout (no recast trail).
```

**Secret ballot — a member reads only their own vote (invariant 4).**

**▶ as Aida** — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;

  select proposal_id, choice, weight from votes;
  -- Expected: exactly ONE row — Aida's own — choice=abstain, weight=3.0
rollback;
```

**▶ as Ben** — tries to read Aida's ballot — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
  set local role authenticated;

  select count(*) as visible_rows from votes;                    -- Expected: 1 (only Ben's own)
  select * from votes where user_id = '00000000-0000-0000-0000-0000000000a1';
  -- Expected: 0 rows — no member, not even another, can read someone else's ballot
rollback;
```

**No tally while open (results gated on the clock).**

**▶ as owner**

```sql
select * from proposal_results
where proposal_id = '0b000000-0000-0000-0000-000000000001';
-- Expected: 0 rows. proposal_results is gated `now() > closes_at`; the window is
-- still open, so nothing surfaces — for anyone, including anon.
```

**G5 in-flight — a moderator cannot move the window, threshold, or author.**

**▶ as Esther** — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}', true);
  set local role authenticated;

  update proposals
     set closes_at = now() + interval '10 days',   -- try to extend the deadline
         kind      = 'immutable',                  -- try to change the threshold
         author_id = '00000000-0000-0000-0000-0000000000e5'  -- try to reassign authorship
   where id = '0b000000-0000-0000-0000-000000000001';

  select closes_at, kind, author_id from proposals
  where id = '0b000000-0000-0000-0000-000000000001';
  -- Expected: the UPDATE reports 1 row (pr_update lets a moderator update), BUT
  -- trg_guard_proposal_columns reverted all three — closes_at, kind, and
  -- author_id are UNCHANGED. Only status/title/body would ever take.
rollback;
```

**Pre-close: the official close is refused, and a forced status flip reveals nothing.**

The server action `recordProposalClose` refuses while `now() <= closes_at`
([governance/actions.ts:147](../steppe/app/protected/governance/actions.ts#L147)).
At the DB level, even a rogue early status flip exposes no tally — results are
purely temporal:

**▶ as Esther** — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}', true);
  set local role authenticated;

  update proposals set status = 'closed'
  where id = '0b000000-0000-0000-0000-000000000001';   -- forced early close

  select * from proposal_results
  where proposal_id = '0b000000-0000-0000-0000-000000000001';
  -- Expected: STILL 0 rows — the temporal gate (now() <= closes_at) hides results
  -- regardless of status. A status flip can never reveal a tally early.
rollback;   -- discards the forced flip AND its premature close-audit
```

### B4 · The window closes → result appears → the close is recorded

> **pg_cron note (migration 0010).** On a DB with the scheduled close enabled,
> `close_due_proposals()` records the close automatically ~5 min after the window
> passes (actor null = closed on schedule). To exercise the *manual* moderator
> close below deterministically, unschedule it first —
> `select cron.unschedule('close-due-proposals');` — or run B4 within 5 minutes of
> the window passing. Either way the close is audited exactly once.

Wait until the window has passed, then confirm:

**▶ as owner**

```sql
select now() > closes_at as window_passed from proposals
where id = '0b000000-0000-0000-0000-000000000001';
-- Proceed once this is true.

select ballots, revealed, yes_weight, no_weight, abstain_weight
from proposal_results
where proposal_id = '0b000000-0000-0000-0000-000000000001';
-- Expected: 5 | true | 4.5 | 1.0 | 3.0
--   yes  = Carla 1.0 + Ben 1.5 + Frank 2.0 = 4.5
--   no   = Diego 1.0
--   abst = Aida 3.0    (she changed her 'no' to 'abstain' before close)
-- revealed = true because 5 ballots >= the MIN_TURNOUT floor (5). The weighting
-- (1.0 / 1.5 / 2.0 / 3.0) is visible in the totals; the per-member choices are not.
```

**The turnout floor (migration 0008), for contrast.** Here `revealed=true` because
five cleared the floor. Had fewer than five voted, the same row would come back
`revealed=false` with `yes_weight / no_weight / abstain_weight = NULL` (only
`ballots` populated), and the UI shows "turnout too low to reveal" — turnout, never
the breakdown. To see it directly, re-run this walkthrough but let only Carla, Ben,
and Aida vote (3 < 5): B4's query returns `3 | false | NULL | NULL | NULL`.

**▶ as Esther** records the official close — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}', true);
  set local role authenticated;

  update proposals set status = 'closed'
  where id = '0b000000-0000-0000-0000-000000000001';
commit;
-- Expected: status open→closed fires trg_log_proposal_closed, which writes
-- 'proposal.closed' with the AGGREGATE result computed in-DB (no per-ballot data).
-- (If pg_cron already closed it, this is a no-op — status is already 'closed', so
--  the trigger doesn't re-fire; the audit was written once, by the job.)
```

Confirm the close audit — aggregate only, no ballots leaked:

```sql
select action, metadata from audit_log
where entity = 'proposal' and entity_id = '0b000000-0000-0000-0000-000000000001'
order by created_at;
-- Expected, in order:
--   proposal.created | {"kind":"minor"}
--   proposal.closed  | {"ballots":5,"revealed":true,"yes_weight":4.5,"no_weight":1.0,"abstain_weight":3.0}
-- At/above the floor the breakdown is recorded; below it the entry is just
-- {"ballots":n,"revealed":false}. No user_id and no per-member choice ever appears.
```

> **Idempotent close.** The manual action no-ops if the proposal is already
> closed, the scheduled job only closes still-open proposals, and the trigger
> fires only on the `→ closed` transition — so the close is audited exactly once,
> whichever path records it. Reversing a decision is a NEW proposal; history is
> never edited.

---

## C · Hardening checks (G1–G5, end to end)

The separation-of-duties (G3 in A1-neg / A6), the secret ballot (B3), the window
freeze (G5 in B3), and the temporal results gate are all proven above. These are
the remaining ones, each self-contained.

### C-G1 · A vote is refused on a removed proposal

Setup — Aida opens a probe proposal; Esther removes it:

**▶ as Aida** — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;
  insert into proposals (id, author_id, title, kind, opens_at, closes_at) values (
    '0c000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000a1',
    'G1 probe — removed proposal', 'minor',
    now() - interval '1 minute', now() + interval '1 hour');
commit;
```

**▶ as Esther** — `commit`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}', true);
  set local role authenticated;
  insert into moderation_actions (target_type, target_id, actor_id, action, reason)
  values ('proposal', '0c000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-0000000000e5', 'remove', 'G1 probe removal.');
commit;
```

Check — Carla tries to vote on the removed (but still time-open) proposal:

**▶ as Carla** — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
  set local role authenticated;

  insert into votes (proposal_id, choice)
  values ('0c000000-0000-0000-0000-000000000001', 'yes');
  -- Expected: ERROR  new row violates row-level security policy for table "votes"
  -- vt_insert now requires NOT is_content_hidden('proposal', …) — moderation
  -- state is DB-authoritative on the write path, not UI-only (G1).
rollback;
```

And a removed proposal surfaces no result, ever:

```sql
select * from proposal_results
where proposal_id = '0c000000-0000-0000-0000-000000000001';
-- Expected: 0 rows (the view also excludes removed proposals).
```

### C-G2 · A client cannot call `log_audit` or `vote_weight_for`

**▶ as Carla** — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
  set local role authenticated;

  select public.log_audit('moderation.remove', 'event', gen_random_uuid(), '{}'::jsonb);
  -- Expected: ERROR  permission denied for function log_audit
  --           (EXECUTE revoked from authenticated — no forged audit entries.)
rollback;

begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
  set local role authenticated;

  select public.vote_weight_for('00000000-0000-0000-0000-0000000000a1');
  -- Expected: ERROR  permission denied for function vote_weight_for
rollback;
```

### C-G4 · A moderator cannot hard-delete another member's event

**▶ as Esther** — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}', true);
  set local role authenticated;

  delete from events where id = '0e000000-0000-0000-0000-000000000001';  -- Diego's event
  -- Expected: DELETE 0 — ev_delete is creator-only. Nothing vanishes silently;
  -- a moderator's only takedown path is the legible, appealable 'remove' (A4).
rollback;
```

### C-review · A plain member is refused the reviewer queue

`/review` lists pending verifications for moderators. A member sees only their
own verification row; the queue (and the decision RPC) are closed to them.

**▶ as Carla** (member) — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) as rows_visible from verifications;
  -- Expected: only Carla's own rows (0 here) — she cannot see Diego's or anyone's.
rollback;
```

**▶ as Esther** (moderator) — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) as rows_visible from verifications;
  -- Expected: >= 1 — the moderator sees the whole queue (incl. Diego's approved row).
rollback;
```

(The `decide_verification` half of the refusal is shown in **A1-neg(b)**.)

### C-privacy · A member can't read another member's tenure (N1, migration 0008)

`tenure_start` reveals a member's vote-weight tier, so it is not public: other
members see only the public columns, through the `public_profiles` view.

**▶ as Carla** — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
  set local role authenticated;

  -- The public view: Aida's public columns, and NO tenure_start column exists on it.
  select id, display_name, verified, role from public_profiles
  where id = '00000000-0000-0000-0000-0000000000a1';
  -- Expected: 1 row (Aida's public fields).

  -- The base table: another member's row is not readable at all (pf_read = own + mod),
  -- so tenure_start can't be reached this way either.
  select count(*) as base_rows_visible from profiles
  where id = '00000000-0000-0000-0000-0000000000a1';
  -- Expected: 0 — Carla can read only her own base profiles row (and moderators all).
rollback;
```

---

## D · Groups hardening checks (G8–G10, G12) — phase 1a

Requires [seed/dry-run-groups.sql](../seed/dry-run-groups.sql). Test groups (paste
as the group id):

| Short | Group | UUID | Preset (visibility / join) | Wiring |
|---|---|---|---|---|
| g1 | Public board | `90000000-0000-0000-0000-000000000001` | public / open | maintainer Aida · member Ben |
| g2 | Curated | `90000000-0000-0000-0000-000000000002` | public / request | maintainer Carla · member Aida · **pending** Ben |
| g3 | Private | `90000000-0000-0000-0000-000000000003` | members_only / locked | maintainer Esther · member Frank |

Phase 1a stays inside the verified-only read model — **no anon/public reads yet**
(G6/G7 are phase 2). Writes are RPC-only; `group_members` has no insert/update/
delete policy, so status/role can't be client-forged.

### D-G8 · Membership-scoped reads — a non-member can't see a private roster/description

**▶ as Aida** (`…a1`, NOT a member of Private g3) — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;

  select count(*) as roster_rows from group_members
   where group_id = '90000000-0000-0000-0000-000000000003';
  -- Expected: 0 — gm_read shows only your own row + rosters of groups you're active in.

  select count(*) as base_rows from groups
   where id = '90000000-0000-0000-0000-000000000003';
  -- Expected: 0 — grp_read hides a members_only group's full row from non-members (G8).

  select name, description, member_count from groups_directory
   where id = '90000000-0000-0000-0000-000000000003';
  -- Expected: 1 row — name + member_count VISIBLE, description NULL (listed, contents gated).
rollback;
```

**▶ as Frank** (`…f6`, an active member of g3) — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) as roster_rows from group_members
   where group_id = '90000000-0000-0000-0000-000000000003';            -- Expected: 2
  select description is not null as sees_desc from groups
   where id = '90000000-0000-0000-0000-000000000003';                  -- Expected: true
rollback;
```

### D-G8b · Own-row read doesn't widen rosters (a pending member, for the UI)

`gm_read` is `user_id = auth.uid() OR is_group_member(group_id)`. The own-row half
lets a member see their *own* membership at any status (so the UI can show a
pending/invited state) — it must NOT expose any other member's row. Ben is
**pending** in Curated g2.

**▶ as Ben** (`…b2`) — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) as own_g2 from group_members
   where group_id = '90000000-0000-0000-0000-000000000002' and user_id = '00000000-0000-0000-0000-0000000000b2';
  -- Expected: 1 — Ben sees his own pending row.
  select count(*) as others_g2 from group_members
   where group_id = '90000000-0000-0000-0000-000000000002' and user_id <> '00000000-0000-0000-0000-0000000000b2';
  -- Expected: 0 — and NOT one other row of g2's roster (no widening; g2 has 3 total).
rollback;
```

Active-member rosters are unchanged: Frank still reads all of g3 (2), Aida all of
g2 (3) — the own-row clause only ever *adds* your own row, never another's (G8).

### D-G10 · Join-policy enforcement

```sql
-- open → instant active.  ▶ as Carla (not in g1) — rollback
begin; select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true); set local role authenticated;
  select public.join_group('90000000-0000-0000-0000-000000000001');    -- Expected: active
rollback;
-- request → pending.     ▶ as Frank (not in g2) — rollback
begin; select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true); set local role authenticated;
  select public.join_group('90000000-0000-0000-0000-000000000002');    -- Expected: pending
rollback;
-- locked → rejected.     ▶ as Aida (not in g3) — rollback
begin; select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true); set local role authenticated;
  select public.join_group('90000000-0000-0000-0000-000000000003');
  -- Expected: ERROR  this group is invite-only; a maintainer must add you
rollback;
```

### D-G9 / G12 · Maintainer scoping — a maintainer of A can't act in B

**▶ as Aida** (maintainer of g1, NOT g3) — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;

  select public.approve_member('90000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000f6');
  -- Expected: ERROR  only a maintainer of this group may approve members
  select public.remove_member ('90000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000f6');
  -- Expected: ERROR  only a maintainer of this group may remove members
  select public.update_group_settings('90000000-0000-0000-0000-000000000003','Hacked',null,null,null,null);
  -- Expected: ERROR  only a maintainer of this group may edit its settings
rollback;
```

**▶ as Carla** (maintainer of g2) approves Ben's pending request — the positive path — `rollback`

```sql
begin;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
  set local role authenticated;
  select public.approve_member('90000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b2');
  select status from group_members
   where group_id = '90000000-0000-0000-0000-000000000002'
     and user_id  = '00000000-0000-0000-0000-0000000000b2';            -- Expected: active
rollback;
```

### D-forge · status/role can't be set by a direct client write

```sql
-- ▶ as Carla — try to insert herself as a maintainer of g1 — rollback
begin; select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true); set local role authenticated;
  insert into group_members (group_id,user_id,role,status)
  values ('90000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c3','maintainer','active');
  -- Expected: ERROR permission denied for table group_members (reads-only grant; writes via RPC)
rollback;
-- ▶ as Ben — try to self-approve his pending g2 request — rollback
begin; select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true); set local role authenticated;
  update group_members set status='active'
   where group_id='90000000-0000-0000-0000-000000000002' and user_id='00000000-0000-0000-0000-0000000000b2';
  -- Expected: ERROR permission denied for table group_members
rollback;
```

---

## Invariant coverage matrix

What each invariant / gap is proven by, so the dry-run is auditable. **Re-verified
against the pre-launch overhaul (brand, privacy, account data, coherence): every
row below still passes.** The only walkthrough that changed is **B** — the vote now
has five ballots (the new turnout floor withholds the breakdown below five), so B4
shows `revealed=true` with `ballots=5, yes=4.5, no=1.0, abstain=3.0` (weighted by
the Business Plan v12 1×–3× tenure scheme — migration 0011). No invariant or gap
regressed.

| # | Invariant (CLAUDE.md) / Gap (rls-audit.md) | Proven by |
|---|---|---|
| 1 | Verify, then forget | **A2** — `evidence_path` → null on decision |
| 2 | Server sets trust, never the client | **A1-neg** (self-approve denied) · seed §3 (admin path) · **B3/G5** (window freeze) |
| 3 | Vote weight computed server-side from tenure | **B0/B2/B4** — totals reflect the 1×–3× scheme 1.0/1.5/2.0/3.0 (5 voters clear the floor); client sends only a choice |
| 4 | Ballots secret; one per member | **B3** — own-row-only reads; one row per member |
| 5 | Human in the loop on consequence | **A2** decide · **A7** resolve · **B4** close (the *vote* is the human decision; recording the close — moderator or pg_cron — only stamps it) |
| 6 | Append-only record | **A8/B4** audit accumulates; ballot frozen after close; no deletes |
| 7 | No silent removal (chronological, legible) | **A4** legible remove vs **C-G4** no silent delete |
| — | **G1** vote on removed content | **C-G1** |
| — | **G2** forgeable audit / weight leak | **C-G2** |
| — | **G3** verification half-state | **A1-neg(a/b)** |
| — | **G4** silent hard-delete | **C-G4** |
| — | **G5** moved window / threshold / author | **B3 (G5 in-flight)** |

Pre-launch overhaul — newly covered (additive; nothing above regressed):

| Area | Property | Proven by |
|---|---|---|
| Privacy (N1) | tenure_start hidden from other members | **C-privacy** — base profiles own+mod; `public_profiles` has no tenure column |
| Privacy (N3) | results members-only + min-turnout floor | **B4** — `revealed=true` at 5; below 5 the breakdown is withheld (turnout only), in the view AND the close audit |
| Account (inv. 8) | export own data; delete = anonymise, never rewrite the record | migration `0009` (`delete_my_account` keeps votes/moderation/audit on a tombstone) — exercised separately so the dry-run isn't self-destructive |
| Coherence (inv. 5) | scheduled close records, never decides | migration `0010` — `close_due_proposals` only flips past-window proposals; the audit/turnout floor is unchanged |

---

## Reset between runs

A fresh dry-run starts from an empty database, not an in-place wipe: the
append-only tables (`audit_log`, `consents`, `moderation_actions`, `votes`) are
immutable in place since migration 0012, so they can't be cleared by row deletes.
Reset with:

```
supabase db reset            # drop & recreate; re-applies schema via the reset
psql "$DB" -f schema.sql     # the complete current snapshot
psql "$DB" -f seed/dry-run-accounts.sql
```

[seed/dry-run-accounts.sql](../seed/dry-run-accounts.sql) is fresh-DB-only and
strictly additive — re-running it against a populated DB errors (the six accounts
already exist). Reset first.
