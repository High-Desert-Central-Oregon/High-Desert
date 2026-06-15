# RLS audit — Steppe

Step 10, Part 1. A table-by-table posture review of row-level security: for every
table, every operation (select / insert / update / delete), which roles the
policies **actually** permit versus what the invariants (CLAUDE.md) require. This
is the last line of defense before real people use it.

**Method.** Read against `schema.sql` (which folds in migrations 0001–0006) as
the source of truth. Findings only — fixes land in Part 2 (migration 0007), and
the gap list at the bottom is updated to **RESOLVED** there.

**Roles.** `anon` (logged out) · `authenticated` (any signed-in member) · refined
inside `authenticated` by policy predicates: `own` (`auth.uid()` matches the row),
`verified` (`is_verified()`), `moderator` (`is_moderator()`). `service_role`
bypasses RLS entirely — the app uses it for exactly one thing (deleting a storage
evidence object), never for table writes. A missing policy = **deny** under RLS.

Legend: ✅ matches intent · ⚠️ surprise / accepted note · 🚩 → gap (see end).

---

## neighborhoods
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `nb_read` | anon + authenticated (`true`) | ✅ public reference data (35 seeds) |
| insert/update/delete | — | nobody (no grant, no policy) | ✅ seed/service only |

Read-public, write-nobody. ✅

## profiles
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `pf_read` | authenticated (`true`) — all rows, all columns | ⚠️ N1 |
| insert | — | nobody directly; created by `handle_new_user` trigger on signup | ✅ |
| update | `pf_update` | own row only; `trg_guard_profile_columns` freezes `verified`/`role`/`tenure_start` on self-edit | ✅ trust-field guard intact |
| delete | — | nobody (cascade from `auth.users`) | ✅ |

Trust fields are server-only: a member cannot self-verify, self-promote, or
backdate tenure. `verified`/`tenure_start` are set only by `decide_verification()`
(SECURITY DEFINER, `is_moderator()` gated). `role` is set by no RPC — admin/service
only. ✅
**⚠️ N1:** `pf_read` exposes *every* column to every member, including
`tenure_start`, `role`, `verified` — broader than SPEC §04's "public fields."
Benign at the time (these drive UI; tenure is derivable as a member's 1×–3×
vote-weight tier — `< 1 yr` 1.0 · `1–2 yr` 1.5 · `2–4 yr` 2.0 · `4 yr+` 3.0) and
not a ballot leak, but it's column-over-exposure. RLS is row-level; trimming
columns needs column GRANTs or a public-profile view. **Since resolved (migration
0008):** `tenure_start` is no longer public — the wider 1×–3× spread makes the
tier a sharper signal, so the base table is now own+moderator only and other
members read `public_profiles` (no tenure column). See DECISIONS 2026-06-11.

## verifications
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `vf_read` | own + moderator | ✅ evidence path is own/mod only; the file itself is gated by storage RLS (mods only) |
| insert | `vf_insert` | own, `status='pending'` | ✅ can't self-approve |
| update | `vf_update` | moderator (any row) | 🚩 G3 |
| delete | — | nobody | ✅ |

**🚩 G3:** `vf_update` lets a moderator update a verification row **directly**,
bypassing `decide_verification()`. The sanctioned RPC also sets
`profiles.verified` + `tenure_start` and writes the audit entry; a direct
`UPDATE status='approved'` fires the evidence-purge trigger but leaves the member
**not actually verified and the decision unaudited** — a broken, silent half-state.
The RPC is SECURITY DEFINER (bypasses RLS), so it does not need this policy.

## neighborhood_requests
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `nr_read` | own + moderator | ✅ |
| insert | `nr_insert` | own, `status='open'` (partial unique index caps at 1 open) | ✅ |
| update | `nr_update` | moderator | ✅ resolve; auto-resolve trigger (definer) on pick. ⚠️ moderator can edit any column (low) |
| delete | — | nobody | ✅ light history kept |

✅ (low note: moderator column latitude on a help-queue row; trusted, immaterial).

## documents
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `doc_read` | anon + authenticated | ✅ Terms/Privacy are public |
| insert/update/delete | — | service only | ✅ |

## consents *(append-only)*
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `cs_read` | own only | ✅ private to the member |
| insert | `cs_insert` | own | ✅ |
| update/delete | — | nobody | ✅ append-only holds |

## events
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `ev_read` | verified (all rows) | ✅ verified-only; removed events stay readable so the removed-banner can render (hidden in UI, not by row) |
| insert | `ev_insert` | verified, `creator_id=own` | ✅ |
| update | `ev_update` | creator or moderator | ✅ (⚠️ a mod could reassign `creator_id`; trusted, low) |
| delete | `ev_delete` | creator **or moderator** | 🚩 G4 |

**🚩 G4:** `ev_delete` lets a **moderator hard-delete** any event — a silent
disappearance with no `moderation_actions` row, no audit entry, no appeal. That
contradicts P7 (nothing vanishes silently; removal is legible + appealable). The
sanctioned moderator path is `moderateContent('remove')`. Creator self-delete is
legitimate; the moderator clause is the gap.

## event_rsvps
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `rs_read` | verified | ✅ who's-coming is shared coordination |
| insert | `rs_insert` | verified, own | ✅ |
| update | `rs_update` | own | ✅ (⚠️ no re-check of `verified`; own-row only, immaterial) |
| delete | `rs_delete` | own | ✅ cancel own RSVP |

## proposals
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `pr_read` | verified | ✅ removed proposals stay readable for the banner |
| insert | `pr_insert` | verified, `author_id=own` | ✅ |
| update | `pr_update` | moderator (any column) | 🚩 G5 |
| delete | — | nobody | ✅ |

**🚩 G5:** `pr_update` lets any moderator change **any column**, including
`opens_at` / `closes_at`. Results reveal on `now() > closes_at` and voting is gated
on the window — so a moderator can move the deadline to reveal a tally early or
**reopen a closed vote**, with no audit. That undercuts the Step-7/8 "only the
clock ends a vote" hardening. `kind` (the threshold) and `author_id` are likewise
mutable. Status must stay mutable (to record a close); the window/kind/author
should be frozen after creation, like profile trust fields.

## votes *(SECRET ballot; append-only except own-ballot-while-open)*
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `vt_select` | **own ballot only** — no moderator clause | ✅ secret ballot: no path reads another member's vote |
| insert | `vt_insert` | verified, own, proposal `open` & in window | ✅ weight/`user_id` set by trigger; 🚩 G1 |
| update | `vt_update` | own, proposal `open` & in window → frozen at close | ✅ Step-7 amendment; 🚩 G1 |
| delete | — | nobody | ✅ a ballot can't be withdrawn |

**Secret ballot — verified end to end.** The only select policy is own-row;
moderators included see only their own. `proposal_results` aggregates with owner
rights but exposes **post-close only** (`now() > closes_at`), grouped, with no
`user_id` and no per-choice-per-member row. No vote choice is ever written to
`audit_log` (the cast path writes nothing). **No path lets anyone read another
member's ballot.** ✅
**🚩 G1 (known):** the vote write path checks `status='open'` + window but **not
moderation state**. A proposal a moderator has *removed* can still be `open`, so a
crafted insert/update is accepted — moderation is UI-only here, not DB-authoritative.

## moderation_actions *(append-only)*
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `mod_read` | authenticated (`true`) | ✅ transparency basis; ⚠️ N2 |
| insert | `mod_insert` | moderator, `actor_id=own`; reason CHECK enforces non-empty | ✅ |
| update/delete | — | nobody | ✅ append-only; a reversal is a new `restore` row |

**⚠️ N2:** because `mod_read` is public-to-members and `events`/`proposals` rows
stay readable after removal, a determined member can join a removal's `target_id`
back to the content row and recover the original title + `creator_id` — i.e. the
affected member's identity, which the removed-banner and transparency view
deliberately *don't* surface. This is a transparency-vs-privacy posture (members
*can* see what was moderated), not a ballot/append-only break. Accepted; flagged
so it's a conscious choice, not a surprise.

## appeals
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `ap_read` | own + moderator | ✅ statement private to member + mods |
| insert | — | **nobody directly** → `file_appeal()` only | ✅ |
| update | — | **nobody directly** → `resolve_appeal()` only | ✅ |
| delete | — | nobody | ✅ |

**Separation of duties — can't be bypassed.** There are deliberately no direct
insert/update policies, so PostgREST cannot write `appeals` at all; the only paths
are the two SECURITY DEFINER RPCs. `file_appeal` enforces *affected member only*
(checks the content's `creator_id`/`author_id`) + one appeal per action;
`resolve_appeal` enforces *moderator* + *not your own action* + open-only, and an
overturn issues a new `restore`. A direct write cannot dodge either rule. ✅

## audit_log *(append-only)*
| Op | Policy | Permits | Assessment |
|---|---|---|---|
| select | `al_read` | authenticated (`true`); anon = deny (no grant) | ✅ transparency |
| insert | — (no policy) | nobody **via RLS** … but see G2 | 🚩 G2 |
| update/delete | — | nobody | ✅ append-only |

**🚩 G2:** `log_audit()` is SECURITY DEFINER with **no internal authority
check**, and like every `public` function it's EXECUTE-able by `authenticated` —
so it's exposed as a PostgREST RPC (`/rpc/log_audit`). Any member can call it and
**forge arbitrary audit entries** (their `actor_id`, but any `action`/`entity`/
`metadata`), e.g. inject fake `moderation.remove` / `appeal.overturned` rows that
surface in the public transparency view. The append-only *table* is safe (no
insert policy), but the *function door* is open. It's meant to be called only from
other definer functions/triggers (owner context), never directly by clients.

---

## Views
- **proposal_results** — owner-rights view; `where now() > p.closes_at`; aggregate,
  grouped, no `user_id`. ✅ no pre-close, no per-ballot leak. ⚠️ **N3:** granted to
  `anon` (closed aggregates are public — intended transparency). ⚠️ does **not**
  exclude *removed* proposals, so a removed proposal's post-close aggregate is
  still queryable (minor; folded into the G1 fix for consistency).
- **content_moderation** — owner-rights view over `moderation_actions` (latest
  remove/restore per target); granted to `authenticated`. Exposes nothing not
  already readable via `mod_read`. ✅

## Functions / RPC exposure
Default `EXECUTE … TO PUBLIC` makes every `public` function a callable RPC.
- Self-guarding (safe to expose): `decide_verification`, `file_appeal`,
  `resolve_appeal` (each `RAISE`s if the caller isn't authorized).
- Caller-info only (safe): `is_verified`, `is_moderator` (no args; about the caller;
  also required EXECUTE-able because RLS policies invoke them as the querying role).
- **Unguarded primitives, internal-only:** `log_audit` (**G2** — writes!),
  `vote_weight_for` (leaks any member's vote weight via `vote_weight_for(uuid)`;
  low — derivable from `tenure_start` per N1). These are only ever called from
  owner-context definer code, so EXECUTE should be revoked from clients.
- Trigger functions (`handle_new_user`, `guard_profile_columns`, `set_vote_weight`,
  `purge_verification_evidence`, `log_moderation`, the two neighborhood-request
  funcs) raise "can only be called as a trigger" if invoked directly — not
  exploitable. ✅

## Storage (verification-evidence bucket)
Policies live on `storage.objects` (see `seed/storage-verification-evidence.sql`
and schema NOTES): insert = own `<uid>/…` folder; select = moderators only; **no
delete policy** — deletion is the service-role admin client (verify-then-forget).
✅ A member can never read another member's (or even their own) evidence file.

## Append-only — in-DB backstop *(N4 → resolved, 0012)*
**N4 (was a defense-in-depth note, now closed).** Append-only used to rest on a
single layer: RLS (absent UPDATE/DELETE policies) for `authenticated`, plus missing
DML grants for `anon`/`service_role`. That left two holes for a **BYPASSRLS** role
(`service_role`, and the table owner / `postgres`): RLS doesn't apply to them, so the
revoked grants were the *only* thing stopping an alter/erase — and `TRUNCATE` was
still granted to `anon`/`service_role` outright, a full-table wipe with no row policy
to catch it.

**Fix (migration 0012) — triggers, which fire regardless of `rolbypassrls` and so
bind every role, owner included:**
- `audit_log`, `consents`, `moderation_actions` — `forbid_write()` on
  `BEFORE UPDATE OR DELETE` (INSERT stays open; the record must keep recording).
- `votes` — `guard_votes_immutable()`: refuses INSERT/UPDATE once the proposal is
  closed (the **exact** `vt_insert`/`vt_update` while-open predicate, negated — so
  trigger and policy can't drift), and refuses DELETE always. Revisable-while-open
  is preserved; a closed ballot can't be added, altered, or erased.
- All four — `BEFORE TRUNCATE` statement trigger, plus `REVOKE TRUNCATE … FROM
  anon, authenticated, service_role` as belt-and-suspenders.

Append-only is now enforced in-DB, not just by RLS+grants; `service_role` bypassing
RLS no longer implies it can rewrite the record. (A clean dev slate now comes from
`supabase db reset`, not row deletes — Section 0 of the seed can't DELETE these.)

---

## Findings — gap list

| # | Severity | Gap | Fix | Status |
|---|---|---|---|---|
| **G1** | High | Vote accepted on a **removed** proposal — write path ignores moderation state (known) | `is_content_hidden()` check in `vt_insert`/`vt_update`; also exclude removed proposals from `proposal_results` | ✅ RESOLVED (0007) |
| **G2** | High | `log_audit()` is a client-callable RPC with no guard → **forgeable audit entries** | `REVOKE EXECUTE` on `log_audit` (and `vote_weight_for`) from `anon`/`authenticated`/`public` | ✅ RESOLVED (0007) |
| **G3** | Medium | `vf_update` lets a moderator bypass `decide_verification()` → unaudited, broken half-state | `DROP POLICY vf_update` (RPC is definer, doesn't need it) | ✅ RESOLVED (0007) |
| **G4** | Medium | `ev_delete` lets a moderator **silently hard-delete** an event (P7 bypass) | Restrict `ev_delete` to creator-only; mods use the legible `remove` flow | ✅ RESOLVED (0007) |
| **G5** | Medium | `pr_update` lets a moderator move `opens_at`/`closes_at` (reveal early / reopen) and change `kind`/`author_id`, unaudited | Freeze window + `kind` + `author_id` on update via a `guard_proposal_columns` trigger; `status`/content stay editable | ✅ RESOLVED (0007) |

Accepted notes (documented, no change): **N1** profile column over-exposure ·
**N2** removed-content identity recoverable via direct query (transparency posture)
· **N3** `proposal_results` public to anon (intended). **N4** broad append-only
grants — **✅ RESOLVED (0012):** in-DB triggers now enforce append-only against
every role (incl. `service_role`/owner), and `TRUNCATE` is blocked + revoked. With
0012 a `service_role` bypassing RLS can no longer rewrite the append-only record (it
remains app-limited to storage deletion).

---

## Resolution — migration 0007 (Part 2)

All five gaps closed in `migrations/0007_rls_hardening.sql` (folded into
`schema.sql`). Re-checked posture:

- **G1 closed.** New `is_content_hidden(type, id)` (latest remove/restore =
  remove?). `vt_insert` and `vt_update` now both require
  `not is_content_hidden('proposal', proposal_id)`, so a removed proposal accepts
  no new vote **and** freezes existing ballots from change — moderation state is
  now DB-authoritative on the write path, not UI-only. `proposal_results` also
  excludes removed proposals, so a takedown surfaces no result anywhere (incl. the
  anon-readable view). A later `restore` re-opens both, as expected.
- **G2 closed.** The app's only direct `log_audit()` RPC calls — `proposal.created`
  and `proposal.closed` — were moved to DB triggers (`trg_log_proposal_created`,
  `trg_log_proposal_closed`), so those entries are written on the actual state
  change: un-forgeable and un-skippable, with the close aggregate computed in the
  database (no per-ballot data). With no client needing it, `EXECUTE` on
  `log_audit()` and `vote_weight_for()` is revoked from `public`/`anon`/
  `authenticated`. The audit log can now be written **only** by owner-context
  SECURITY DEFINER code (the audit triggers, `decide_verification`,
  `resolve_appeal`), which keeps EXECUTE as the owner. Self-guarding RPCs
  (`decide_verification`, `file_appeal`, `resolve_appeal`) and the RLS helpers
  (`is_verified`, `is_moderator`, `is_content_hidden`) keep their public EXECUTE —
  the policies invoke them as the querying role.
- **G3 closed.** `vf_update` dropped. Verifications now change **only** through
  `decide_verification()` — the audited, profile-updating, SECURITY DEFINER path.
  No direct-UPDATE half-state remains.
- **G4 closed.** `ev_delete` is creator-only. A moderator can no longer hard-delete
  an event; takedowns go through the legible, appealable `remove` flow (P7).
- **G5 closed.** `trg_guard_proposal_columns` freezes `opens_at`, `closes_at`,
  `kind`, `author_id` on any proposal UPDATE. A moderator can record a close
  (`status`) and fix typos (title/body) but cannot move the voting window, change
  the threshold, or reassign authorship — "only the clock ends a vote" holds.

Re-verified unchanged after 0007: secret ballot (own-row select only; post-close
aggregate only; nothing per-ballot in audit), append-only on
consents/moderation_actions/audit_log, the profile trust-field guard, and the
appeal separation-of-duties (RPC-only writes).
