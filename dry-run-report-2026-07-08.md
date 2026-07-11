# Dry-run report — Steppe (Step 10) · 2026-07-08

Execution of [`docs/dry-run-runbook.md`](docs/dry-run-runbook.md) end-to-end against
**local Supabase only**. Report-only: no schema, policy, trigger, or RPC was changed.

## Target & environment (confirmed local before any destructive step)

| | |
|---|---|
| DB target | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (local Docker Postgres) |
| Linked remote | **none** (no `supabase/.temp/project-ref`) — `db reset` confined to local |
| Docker / CLI | Docker 29.4.3 · Supabase CLI 2.109.0 · Postgres 17 |
| pg_cron | **not installed** on this fresh DB → no scheduled close; B4 uses the manual close |

## Overall verdict

**PASS — every check matches expected** (48 walkthrough checks across A–D, 4 extended checks,
plus 6 setup checks). No invariant or gap regressed. Two cosmetic/structural deviations from the runbook's
literal text are noted below; neither affects an invariant or a decision.

- **A8 audit ordering.** The two same-moderator rows return `moderation.restore` **before**
  `appeal.overturned` (runbook lists them reversed). Same three rows, same actors, written
  sub-second apart inside one `resolve_appeal` call; ordering is by `created_at`. No invariant
  impact (accountability still names only moderators).
- **D-G9/G12 transaction split.** The runbook bundles the three cross-group maintainer refusals
  in one transaction; the first `RAISE` aborts the rest, masking them. Each was run in its own
  transaction so all three distinct errors surface. No DB change.

---

## Part 2 — setup

| Step | Expected | Actual | Result |
|---|---|---|---|
| `supabase db reset` | bare DB (no app migrations, no seed.sql) | reset OK; `WARN: no files matched supabase/seed.sql` (harmless) | ✅ |
| Apply `schema.sql` | clean apply | exit 0, 0 errors | ✅ |
| `seed/dry-run-accounts.sql` | 6 accounts | exit 0, 0 errors | ✅ |
| `seed/dry-run-groups.sql` | 3 groups | exit 0, 0 errors | ✅ |
| Roster weights | Aida 3.0 · Ben 1.5 · Carla 1.0 · Diego 1.0(unverified) · Esther 3.0(mod) · Frank 2.0(mod) | exact match | ✅ |
| Group presets | Public/open · Curated public/request(2+1 pending) · Private members_only/locked | exact match | ✅ |

## Walkthrough A — the first conflict

| Check | Expected | Actual | Result |
|---|---|---|---|
| A0 pre-state | `f \| null` | `f \| null` | ✅ |
| A1 submit verification | INSERT 1; `pending \| d4/utility-bill.jpg \| null` | match | ✅ |
| A1-neg(a) self-UPDATE | `UPDATE 0` (no update policy) | `UPDATE 0` | ✅ |
| A1-neg(b) self-`decide_verification` | ERROR only moderators | `ERROR: only moderators may decide verifications` | ✅ |
| A2 approve | status approved; **evidence_path → null**; reviewed t | `approved \| (null) \| t` | ✅ |
| A2 profile | verified t; tenure = today | `t \| t` | ✅ |
| A2 audit | `verification.approved \| e5` | match | ✅ |
| A3 post event | INSERT 1; hidden f | match | ✅ |
| A4 remove w/ reason | INSERT 1; hidden t; `content_moderation` remove/reason/e5; audit `moderation.remove \| e5` | match | ✅ |
| A5 bystander appeal | ERROR only affected member | `ERROR: only the affected member may appeal this action` | ✅ |
| A5 creator appeal | appeal uuid; status open | `64941856-…-81ba \| open` | ✅ |
| A6 acting-mod resolve | ERROR separation of duties | `ERROR: separation of duties: you cannot resolve an appeal of your own action` | ✅ |
| A7 different-mod overturn | appeal overturned; event restored (hidden f); chain remove(e5)/restore(f6) | match | ✅ |
| A8 transparency | 3 rows, actor always a moderator, moderated member absent | 3 rows; actors e5/f6/f6 (see ordering note) | ✅* |

## Walkthrough B — the first vote

| Check | Expected | Actual | Result |
|---|---|---|---|
| B0 tiers | Carla 1.0 · Ben 1.5 · Frank 2.0 · Aida 3.0 | exact | ✅ |
| B1 open proposal | INSERT 1; audit `proposal.created \| minor` | match | ✅ |
| B2 five ballots | 5 × INSERT 1 (weight server-set) | 5 × INSERT 1 | ✅ |
| B3 revise no→abstain | INSERT 1 (one row per member) | match | ✅ |
| B3 secret ballot (Aida) | 1 row: `abstain \| 3.0` | match | ✅ |
| B3 secret ballot (Ben) | visible 1; Aida's rows 0 | `1` / `0` | ✅ |
| B3 no tally while open | 0 result rows | `0` | ✅ |
| B3 G5 freeze | kind/author/window unchanged by mod | `minor \| a1 \| window_pushed f` | ✅ |
| B3 forced early close | still 0 result rows (temporal gate) | `0` | ✅ |
| B4 window passed | t | `t` | ✅ |
| B4 results | `5 \| t \| 4.5 \| 1.0 \| 3.0` | exact | ✅ |
| B4 manual close | open→closed | `UPDATE 1` | ✅ |
| B4 close audit | created{minor}; closed{ballots 5, revealed true, yes 4.5, no 1.0, abstain 3.0}; no per-ballot data | exact | ✅ |

## Walkthrough C — hardening (G1–G5)

| Check | Expected | Actual | Result |
|---|---|---|---|
| C-G1 vote on removed proposal | ERROR RLS violation | `ERROR: new row violates row-level security policy for table "votes"` | ✅ |
| C-G1 removed → no result | 0 rows | `0` | ✅ |
| C-G2 `log_audit` | ERROR permission denied | `ERROR: permission denied for function log_audit` | ✅ |
| C-G2 `vote_weight_for` | ERROR permission denied | `ERROR: permission denied for function vote_weight_for` | ✅ |
| C-G4 mod hard-delete event | DELETE 0 (creator-only) | `DELETE 0` | ✅ |
| C-review member queue | only own (0) | `0` | ✅ |
| C-review moderator queue | ≥ 1 | `1` | ✅ |
| C-privacy `public_profiles` | 1 row (no tenure column) | 1 row (Aida) | ✅ |
| C-privacy base `profiles` | 0 rows | `0` | ✅ |

## Walkthrough D — groups (G8–G12)

| Check | Expected | Actual | Result |
|---|---|---|---|
| D-G8 non-member (Aida/g3) | roster 0; base 0; directory 1, description NULL | `0 / 0 / 1 (desc null, count 2)` | ✅ |
| D-G8 member (Frank/g3) | roster 2; sees_desc true | `2 / t` | ✅ |
| D-G8b own-row (Ben pending/g2) | own 1; others 0 | `1 / 0` | ✅ |
| D-G10 open (Carla/g1) | active | `active` | ✅ |
| D-G10 request (Frank/g2) | pending | `pending` | ✅ |
| D-G10 locked (Aida/g3) | ERROR invite-only | `ERROR: this group is invite-only; a maintainer must add you` | ✅ |
| D-G9/G12 approve_member (cross-group) | ERROR only a maintainer | match | ✅ |
| D-G9/G12 remove_member (cross-group) | ERROR only a maintainer | match | ✅ |
| D-G9/G12 update_group_settings (cross-group) | ERROR only a maintainer | match | ✅ |
| D-G9/G12 positive (Carla approves Ben) | active | `active` | ✅ |
| D-forge direct insert | ERROR permission denied for table | match | ✅ |
| D-forge direct update | ERROR permission denied for table | match | ✅ |

`✅* = pass with the A8 ordering nuance noted above.`

---

## Extended checks (previously deferred — now run)

Two items the main walkthrough deferred, run against the same local DB:

| Check | Expected | Actual | Result |
|---|---|---|---|
| N3 turnout floor, below 5 | 3-ballot closed proposal: `3 \| false \| NULL \| NULL \| NULL` | `3 \| f \| (null) \| (null) \| (null)` | ✅ |
| N3 close audit, below floor | `proposal.closed {ballots:3, revealed:false}` — no weights | exact | ✅ |
| inv. 8 delete = anonymise | profile → `Former member` + `deleted_at` set; ballots retained | `Former member \| t`; votes_retained 2 | ✅ |
| inv. 8 non-destructive probe | rolled back → member restored | `Carla Nguyen \| f` | ✅ |

`delete_my_account` (schema.sql:709) deletes rsvps/events/verifications/consents and anonymises
the profile, but does **not** touch votes / moderation_actions / audit_log — the record stands,
the identity is scrubbed. Run in a rolled-back transaction; nothing persisted. (Data *export*,
inv. 8's other half, is a server route — out of scope for a SQL dry-run.)

---

## Invariant coverage matrix (actual vs expected)

| # | Invariant (CLAUDE.md) / Gap (rls-audit.md) | Proven by | Actual | Result |
|---|---|---|---|---|
| 1 | Verify, then forget | A2 | `evidence_path → null` on decision | ✅ |
| 2 | Server sets trust, never the client | A1-neg · B3/G5 | self-approve denied; window/kind/author frozen | ✅ |
| 3 | Vote weight computed server-side from tenure | B0/B2/B4 | totals 4.5 / 1.0 / 3.0 from 1×–3× scheme | ✅ |
| 4 | Ballots secret; one per member | B3 | own-row-only reads; single row per member | ✅ |
| 5 | Human in the loop on consequence | A2 · A7 · B4 | decide / resolve / close all human-initiated | ✅ |
| 6 | Append-only record | A8 / B4 | audit accumulates; ballot frozen after close | ✅ |
| 7 | No silent removal (legible) | A4 vs C-G4 | legible remove with reason; no silent delete | ✅ |
| — | G1 vote on removed content | C-G1 | RLS violation | ✅ |
| — | G2 forgeable audit / weight leak | C-G2 | both functions permission-denied | ✅ |
| — | G3 verification half-state | A1-neg(a/b) | UPDATE 0 + moderator-only RPC | ✅ |
| — | G4 silent hard-delete | C-G4 | DELETE 0 | ✅ |
| — | G5 moved window / threshold / author | B3 | all three reverted by trigger | ✅ |
| N1 | tenure_start hidden from other members | C-privacy | base own+mod only; view has no tenure column | ✅ |
| N3 | results members-only + min-turnout floor | B4 · Extended | `revealed=true` at 5; `revealed=false` + NULL breakdown at 3 | ✅ |
| 8 | delete = anonymise (votes/moderation/audit retained) | Extended | profile scrubbed + `deleted_at`; ballots retained | ✅ |
| G8/G8b | membership-scoped reads / no own-row widening | D-G8, D-G8b | non-member blind; own-row only | ✅ |
| G9/G12 | maintainer scoping | D-G9/G12 | cross-group actions denied; positive path works | ✅ |
| G10 | join-policy enforcement | D-G10 | open/request/locked behave per policy | ✅ |
| — | group status/role not client-forgeable | D-forge | table writes permission-denied | ✅ |

## Reproducibility

```
supabase db reset --workdir <repo>            # local only; no --linked/--db-url
psql "$DB" -v ON_ERROR_STOP=1 -f schema.sql
psql "$DB" -v ON_ERROR_STOP=1 -f seed/dry-run-accounts.sql
psql "$DB" -v ON_ERROR_STOP=1 -f seed/dry-run-groups.sql
# then A.sql, B_open.sql, (wait ~75s), B_close.sql, C.sql, D.sql
```

Scripts used are in the session scratchpad (`A.sql`, `B_open.sql`, `B_close.sql`, `C.sql`,
`D.sql`) and mirror the runbook blocks verbatim except the two deviations noted above.

*Report only — no changes were made to schema, policies, triggers, or RPCs.*
