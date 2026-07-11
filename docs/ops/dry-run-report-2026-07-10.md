# Dry-run / pre-flip verification report — 2026-07-10 (Gate 1, step 6)

Fresh re-verification for the go-live gate, run on the local prod-mirror stack
(schema.sql + migration 0016; the same schema prod runs). Companion to
[`go-live-runbook.md`](./go-live-runbook.md) step 6. The 2026-07-08 report covered the
full A–D manual walkthrough; this run re-confirms the machine-checkable invariants
against the current deploy commit.

**Deploy commit:** `e286aca` · **DB:** `postgresql://…54322` (local `high-desert`).

## 1. Build + test gate

| Gate | Result |
|---|---|
| `npm run build` | ✅ exit 0 — all routes compiled (App Router, PPR) |
| `npm run test` (Vitest) | ✅ 18 passed / 0 failed (7 scaffold `todo`) |
| — interest funnel (hermetic) | ✅ 8 |
| — RLS smoke, anon deny-by-default | ✅ 3 (interest list + votes unreadable) |
| — core invariant refusals (impersonated, owner conn) | ✅ 7 |

The 7 impersonated refusals re-ran against this DB: non-moderator can't
`decide_verification` (INV5), a member can't self-approve a verification (INV2), a
moderator can't hard-delete another member's event (creator-only), a member can't read
another member's ballot (INV4), and `authenticated` can't execute `log_audit` /
`vote_weight_for` (no forged audit, no weight leak).

## 2. Positive-path aggregation (scripted, rolled back)

`scratchpad/step6-vote-invariants.sql` — one transaction, `ROLLBACK` at the end, so it
mutates nothing. Five verified fixture voters (Aida 3.0, Esther 3.0, Frank 2.0, Ben 1.5,
Carla 1.0; Diego unverified, excluded). Each ballot sent only `{proposal_id, choice}`
plus a **deliberately forged** `weight`.

| Invariant | Check | Result |
|---|---|---|
| 3 | Forged weights (9.9 / 8.8 / 7.7) overridden to tenure weight by `set_vote_weight` | ✅ |
| 6 | Aida revises no → yes while open; **one row**, weight 3.0 (not duplicated) | ✅ |
| 4 / close-gate | `proposal_results` returns nothing while `now() ≤ closes_at` | ✅ |
| 3 / 4 / 7 | After close: **yes 5.0 · no 3.0 · abstain 2.5**, ballots 5, `revealed = true` at the turnout floor | ✅ |
| 4 | `proposal_results` is aggregate-only — no `user_id` / `choice` column exists | ✅ |

**Design confirmed along the way:** `guard_proposal_columns` freezes `closes_at` on every
update (proposal windows are immutable after creation — can't be shortened or extended).
The test simulates the window elapsing by disabling that guard *inside the rolled-back
transaction only*.

## 3. Prior coverage still valid

- Full A–D manual walkthrough (verification purge, legible takedown, appeal +
  separation-of-duties, transparency view) — green 2026-07-08; invariant schema unchanged
  since (0016 touches only Storage).
- Storage **verify-then-forget** + `close_due_proposals()` + `pg_cron` installability —
  rehearsed 2026-07-10 (see the go-live runbook rehearsal log).

## Verdict

**Step 6 green.** Build + test + the invariant refusals and the vote-aggregation positive
path all pass against the prod-mirror schema on the deploy commit. Remaining before live:
step 7 (flip `LAUNCH_PHASE=live`) and step 8 (post-flip prod smoke).
