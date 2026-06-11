# Dry-run runbook — High Desert (Step 10)

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

1. Apply `schema.sql` + migrations `0001`–`0007` to a fresh staging DB.
2. Run [seed/dry-run-accounts.sql](../seed/dry-run-accounts.sql). Confirm the
   roster check at the end prints the six accounts with weights 1.0 / 1.2 / 1.5.
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
| a1 | Aida Ramirez | `00000000-0000-0000-0000-0000000000a1` | member | Braydon Park | 1.5× |
| b2 | Ben Okafor | `00000000-0000-0000-0000-0000000000b2` | member | Braydon Park | 1.2× |
| c3 | Carla Nguyen | `00000000-0000-0000-0000-0000000000c3` | member | Canyon Crossing | 1.0× |
| d4 | Diego Flores | `00000000-0000-0000-0000-0000000000d4` | member (unverified) | Canyon Crossing | — → 1.0× |
| e5 | Esther Cohen | `00000000-0000-0000-0000-0000000000e5` | **moderator** | Deer Crossing | 1.5× |
| f6 | Frank Mbeki | `00000000-0000-0000-0000-0000000000f6` | **moderator** | Deer Crossing | 1.5× |

Fixed content UUIDs created during the run (so every check can reference them):

| What | UUID |
|---|---|
| Diego's verification | `0d000000-0000-0000-0000-000000000001` |
| Diego's event | `0e000000-0000-0000-0000-000000000001` |
| Esther's removal action | `0a000000-0000-0000-0000-000000000001` |
| Aida's proposal (the vote) | `0b000000-0000-0000-0000-000000000001` |
| G1 probe proposal | `0c000000-0000-0000-0000-000000000001` |

If a run gets messy, re-run the seed — Section 0 of it is an idempotent teardown.

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

### B0 · Pre-state — the three tiers

**▶ as owner**

```sql
select p.display_name, p.tenure_start, public.vote_weight_for(p.id) as weight
from profiles p
where p.id in ('00000000-0000-0000-0000-0000000000a1',
               '00000000-0000-0000-0000-0000000000b2',
               '00000000-0000-0000-0000-0000000000c3')
order by weight;
-- Expected: Carla 1.0 · Ben 1.2 · Aida 1.5
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
> for B4. Need more time? Re-run the seed and use a longer `closes_at`.

### B2 · The three tiers vote

Each member sends **only a choice** — the trigger sets `user_id` and `weight`
from tenure. The upsert mirrors the app's `castVote`.

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

**▶ as Ben** (1.2×) — `commit`

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

**▶ as Aida** (1.5×) — votes **no** first — `commit`

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
-- Expected: vt_update permits the change while open; weight re-derived (1.5).
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
  -- Expected: exactly ONE row — Aida's own — choice=abstain, weight=1.5
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
([governance/actions.ts:147](../high-desert/app/protected/governance/actions.ts#L147)).
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

### B4 · The window closes → result appears → moderator records the close

Wait until the window has passed, then confirm:

**▶ as owner**

```sql
select now() > closes_at as window_passed from proposals
where id = '0b000000-0000-0000-0000-000000000001';
-- Proceed once this is true.

select ballots, yes_weight, no_weight, abstain_weight
from proposal_results
where proposal_id = '0b000000-0000-0000-0000-000000000001';
-- Expected: 3 | 2.2 | 0 | 1.5
--   yes  = Carla 1.0 + Ben 1.2 = 2.2
--   no   = 0            (Aida changed her 'no' to 'abstain' before close)
--   abst = Aida 1.5
-- The weighting (1.0 / 1.2 / 1.5) is visible in the totals; the per-member
-- choices are not — aggregate only.
```

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
```

Confirm the close audit — aggregate only, no ballots leaked:

```sql
select action, metadata from audit_log
where entity = 'proposal' and entity_id = '0b000000-0000-0000-0000-000000000001'
order by created_at;
-- Expected, in order:
--   proposal.created | {"kind":"minor"}
--   proposal.closed  | {"ballots":3,"yes_weight":2.2,"no_weight":0,"abstain_weight":1.5}
-- No user_id and no per-member choice appears anywhere in the audit log.
```

> **Idempotent close.** The server action no-ops if the proposal is already
> closed, and the trigger only fires on the `→ closed` transition — so the close
> is audited exactly once. Reversing a decision is a NEW proposal; history is
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

---

## Invariant coverage matrix

What each invariant / gap is proven by, so the dry-run is auditable:

| # | Invariant (CLAUDE.md) / Gap (rls-audit.md) | Proven by |
|---|---|---|
| 1 | Verify, then forget | **A2** — `evidence_path` → null on decision |
| 2 | Server sets trust, never the client | **A1-neg** (self-approve denied) · seed §3 (admin path) · **B3/G5** (window freeze) |
| 3 | Vote weight computed server-side from tenure | **B0/B2/B4** — totals reflect 1.0/1.2/1.5; client sends only a choice |
| 4 | Ballots secret; one per member | **B3** — own-row-only reads; one row per member |
| 5 | Human in the loop on consequence | **A2** decide · **A7** resolve · **B4** official close |
| 6 | Append-only record | **A8/B4** audit accumulates; ballot frozen after close; no deletes |
| 7 | No silent removal (chronological, legible) | **A4** legible remove vs **C-G4** no silent delete |
| — | **G1** vote on removed content | **C-G1** |
| — | **G2** forgeable audit / weight leak | **C-G2** |
| — | **G3** verification half-state | **A1-neg(a/b)** |
| — | **G4** silent hard-delete | **C-G4** |
| — | **G5** moved window / threshold / author | **B3 (G5 in-flight)** |

---

## Reset between runs

Re-running [seed/dry-run-accounts.sql](../seed/dry-run-accounts.sql) clears all
six test accounts and everything they created (Section 0 of the seed, in FK
dependency order) and re-seeds them clean. Run it whenever you want a fresh
dry-run — or on its own to tear the test accounts down entirely.
