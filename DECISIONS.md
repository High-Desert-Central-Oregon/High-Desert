# Decisions log — Steppe

A running record of design and scope decisions made while building, with enough
"why" that the next person (or the cohort) can revisit them. Newest first.
Companion to `CLAUDE.md` (the invariants), `SPEC.md` (the build spec), and
`schema.sql` (the data layer). For the locked launch decisions, see SPEC.md §01.

---

## 2026-07-04 — Scope supersession logged: Groups/Calendar/Exchange v2 pulls three deferred items into beta scope

**Decision (recording an already-made one).** `docs/Steppe-Groups-Calendar-Exchange-Spec-v2.md`
("Draft for build … in scope for the first closed beta") and
`docs/Steppe-Spec-v3-Identity-Privacy-Exchange.md` supersede parts of `SPEC.md` §02's
"Out" list: **groups** (shipped as migration `0013_groups_core.sql`), **event recurrence**
(v2 brought recurrence into v1 of the calendar), and the **Local Exchange listing
primitive** (needs / offers / goods / jobs / mutual aid — "pulled forward from
post-beta"), plus member-to-member messages (Spec v3 §5). This entry exists because the
2026-07-04 audit found the supersession real in the specs and the schema but recorded
nowhere — `CLAUDE.md`'s do-not-build and `SPEC.md` §02 still said the opposite.

**What is still out (unchanged).** No payments anywhere (the Exchange is listings-only;
transactions happen off-platform), no skills/trades trust graph, no resilience alerts/SMS,
no regional discussion board, no visitor posting/voting, no multi-community expansion, no
youth accounts, no historical archive. "Local marketplace" in the old out-list meant a
payments marketplace — that remains out; the listings Exchange is not it.

**Why.** The cohort's first real use is coordination (groups, gatherings, simple
listings); shipping the Exchange primitive early makes the beta a genuine test of the
one-feed model. The two-tier moderation model and prohibited-items list (Terms §2, §4)
shipped alongside it.

**Also.** Business Plan **v12** (June 2026) supersedes v11; the governance numbers are
unchanged (quorum 15%, major 60%, immutable 75% + 30 days, tenure 1×/1.5×/2×/3×), so
older "v11" citations in historical records are historical rather than wrong; `CLAUDE.md`
and `SPEC.md` now cite v12.

**Revisit.** If the Exchange proves too heavy for the beta cohort, the fallback is the
v2 spec's own phase gates — not a return of the old out-list.

---

## 2026-06-11 — Two stubs resolved (scheduled close; evidence deletion)

Pre-launch coherence sweep. The two long-standing stubs noted in `schema.sql` are
now resolved.

### Scheduled proposal close — implemented via pg_cron (records, never decides)

**Decision.** A proposal's official close is now recorded automatically by a
pg_cron job (`close_due_proposals()`, `migrations/0010_scheduled_close.sql`),
~5 min after its window passes. The moderator's manual `recordProposalClose`
stays as an idempotent override.

**Why this doesn't violate invariant 5 (human in the loop on consequence).** The
governance *outcome* is the voters' tally — decided by people, at the ballot.
Closing the proposal does not decide anything: it flips `status` and stamps the
already-determined aggregate into the audit log (the pass/fail threshold isn't
even evaluated). That is "automation may surface or record, never decide." Leaving
it to a manual click meant the permanent `proposal.closed` record could be missing
indefinitely if no moderator acted; a schedule makes the record reliable.
Visibility is unchanged — `proposal_results` is gated on `now() > closes_at`, so
results were already visible the instant the window passed; the job adds only the
record. The cron entry's `actor_id` is null (closed on schedule, not by a person).

**Revisit if:** the cohort wants a human to always finalize (drop the schedule), or
wants the threshold evaluated at close (a future feature, still not "deciding" —
the rule would be the cohort's, applied mechanically).

### Evidence deletion — confirmed in-app; the "edge function" was never real

**Confirmation, not a change.** Verify-then-forget is fully covered in-app: the
`decideVerification` server action deletes the Storage object via the service-role
client *before* it commits the decision (delete-before-commit, so a storage failure
can't orphan a file), and the `trg_purge_evidence` trigger nulls the pointer. The
"edge function" referenced in old comments/docs was never built — that was stale
documentation describing a path the app already covers more safely. The references
in `schema.sql`, `SPEC.md`, `docs/SETUP.md`, and the dry-run runbook are corrected
to describe the real in-app flow. (The service-role admin client now has exactly
two uses: this, and the account-deletion auth scrub.)

---

## 2026-06-11 — Two privacy decisions settled (profile fields; results)

Pre-launch, the two deferred privacy notes from `docs/rls-audit.md` (N1, N3) are
now decided and implemented (migration `0008`). Both were the recommended calls.

### (a) Profile fields — tenure_start is not public

**Decision.** A member's profile exposes only genuinely public fields to other
members — `display_name`, `neighborhood`, `verified`, and `role` (moderator
visibility is intended). **`tenure_start` is hidden from other members**, readable
only by the member themselves and by moderators.

**Why.** `tenure_start` lets anyone infer a member's vote-weight tier (the 1×–3×
scheme — `vote_weight_for`, migration 0011). In a ~50-person cohort that's a
meaningful re-identification / influence signal, and it's not needed for any
member-facing feature. The old `pf_read`
`using (true)` exposed every column (audit note N1).

**How (never by loosening a trust guard).** RLS is row-level, not column-level, so
the read is split: the base `profiles` table is now readable only by the member
themselves and moderators (full row, incl. `tenure_start`); everyone else reads a
new **`public_profiles`** view that selects only the four public columns. The
profile trust-field guard (`trg_guard_profile_columns`) is untouched. App reads of
*other* members' names (transparency, event creator/RSVPs, proposal author) now go
through `public_profiles`; own-profile and moderator reads stay on the base table.

**Revisit if:** the cohort wants tenure visible (e.g. to show "founding member"),
which would be a deliberate community choice, not a default.

### (b) Governance results — members-only + a minimum-turnout floor

**Decision.** `proposal_results` is gated to **authenticated members** (anon read
dropped). And a **minimum-turnout floor**: if fewer than **5** distinct members
voted, the weighted breakdown is withheld ("turnout too low to reveal") and only
the turnout count is shown. **5 is provisional config for the cohort to ratify**,
alongside the governance thresholds (quorum 15%, major 60%, immutable 75%).

**Why.** Closed results were readable by the open internet (audit note N3), and
with one or two ballots a weighted breakdown can reveal how an individual voted.
The floor closes that small-N de-anonymisation gap. It sits *below* quorum (15% of
~50 ≈ 7.5), so it never hides a legitimately-decided result — only very-low-turnout
ones where the privacy risk is real and the outcome wouldn't have carried anyway.

**How.** The floor is enforced in the database, in *both* places the breakdown
could surface: the `proposal_results` view (a `revealed` flag nulls the weights
below the floor) **and** the permanent `proposal.closed` audit entry
(`log_proposal_closed` records turnout + `revealed:false`, withholding the
breakdown). The UI shows the turnout and a plain-language "too low to reveal" note.

**Revisit:** the cohort ratifies (or changes) the floor of 5 with the other
governance numbers. If membership grows, revisit whether 5 is still the right
absolute (vs. a percentage).

---

## 2026-06-09 — Local Exchange refined: two-layer scope, Compass review

**Decision.** Local Exchange will live on **Steppe** (name pending,
confirming this week). Redmond Compass reviewed the concept and was positive —
the separation of civic-participation exchange from commercial discovery aligns
with both platforms' lanes. Scope is now two deliberate layers:

- **Committed (post-beta):** a **non-monetary needs exchange** ("I have firewood
  / I need firewood," mutual-aid flavored) and **tradespeople trade-for-trade**
  (barter of services, no money). These share one listing primitive (offer/ask
  with a category), reused the way the event primitive was — not two parallel
  systems.
- **Later, community-voted:** a **commercial (monetary) marketplace** as an
  added layer on top, gated behind a governance vote — not built until the cohort
  approves it.

**Disciplines unchanged from the original entry:** verified members only,
neighborhood-scoped, chronological + proximity — no ranking, featured listings,
or ads (invariant 7); no platform fee or cut; trust is the mutual
completed-exchange "would do this again" acknowledgment tied to one real listing,
never ratings/scores/leaderboards; disputes via existing appealable,
separation-of-duties moderation.

**Prior rejections unchanged:** star ratings / reputation scores
(perception-extraction; flatten relational trust into gameable proxies),
invite-tree collective banning (collective punishment; contradicts Step 8 due
process), in-app currency (deferred — requires legal review + member vote),
personality screening (unimplementable + stigmatizing), dating/friend-matching
(outside civic scope).

Documentation updated: Pattern 25 (confidence raised from tentative `·` to
moderate `∗` for the committed non-monetary core; commercial layer marked
vote-conditional in the solution text); SPEC.md post-beta roadmap split into
the committed and vote-gated entries.

---

## 2026-06-09 — Roadmap (post-beta): verified-resident Local Exchange

Verified-resident **Local Exchange** — a neighborhood-scoped board for goods,
services, and non-monetary skill/mutual-aid, browsed by time + proximity like
events. Disciplines: no platform fee/cut, no ads, no ranking or featured listings
(invariant 7); trust is a mutual completed-exchange acknowledgment, never
ratings/scores/leaderboards; disputes use existing appealable moderation.
Explicitly rejected from the sibling concept that prompted this: star ratings /
reputation scores (perception-extraction; flatten relational trust into gameable
proxies), invite-tree collective banning (collective punishment; contradicts
Step 8 due process), in-app currency (deferred — requires legal review + member
vote), personality screening (unimplementable + stigmatizing; instead remove the
incentives that reward extraction), dating/friend-matching (outside civic scope).
Rationale: keep value circulating locally without the platform becoming a
rent-seeker or a perception game; bound trust (neighborhood, tenure, 12-city cap)
rather than try to "scale" it.

Documentation only — no code, no schema. See Pattern Language 25 (Local Exchange,
Value Stays Local) and SPEC.md post-beta roadmap.

---

## 2026-06-09 — Spanish strings are DRAFT, pending native-speaker review

**Decision.** The app ships English and Spanish together from the first screen
(invariant 9), but the Spanish in `lib/i18n/dictionaries/es.ts` is **agent-drafted
and not launch-ready**. It is marked DRAFT (header comment in that file) and must
be reviewed by a community Spanish speaker before the beta — the same posture as
the Terms & Privacy text awaiting Oregon legal review.

**Why.** Bilingual-by-default is a real commitment, not a checkbox; machine/agent
translation gets the meaning across but can miss register, regional word choice
(Central Oregon Spanish), and the plain-neighborly tone the rest of the product
holds to. Shipping it as reviewed would over-claim. Flagging it keeps the parity
(every key has an es value, enforced by the `Dictionary` type) while being honest
that a human pass is owed.

**How to apply.** A reviewer edits `es.ts` in place (the structure mirrors
`en.ts` key-for-key); remove the DRAFT header once a native speaker has signed
off. Pluralization uses CLDR rules (Intl.PluralRules) so plural forms are correct
per language without hand-coding.

---

## 2026-06-09 — Transparency log names the moderator, not the moderated member

**Decision.** The public moderation transparency view shows, for each action: what
happened (an event/proposal was removed or restored, an appeal was upheld or
overturned), the written reason, the acting **moderator's** name, and the time.
It does **not** name the affected member, and it links to the content's detail
page rather than restating its title.

**Why.** Accountability runs toward power: the people exercising moderation
authority are named so the community can see moderation is principled, not
arbitrary (P8). The people *subject* to it are not re-exposed — a removed item's
detail page already shows only the reason (not the original author or title), so
the log adds no new exposure of the moderated member. In a ~50-person cohort,
naming the affected member in a public feed would amplify a takedown into a
reputational event; that's the opposite of due process. The member's own
identity, their appeal statement, and their content stay private to them and
moderators (RLS), while the *fact and rationale* of moderation are fully public.

**Revisit if:** the community decides moderator anonymity is needed for safety
(flip to "a moderator"), or that affected-member identity should appear (e.g. for
repeat-pattern visibility) — either is a community decision, not a default.

---

## 2026-06-09 — Invariant 6 narrowly amended: ballots revisable until close

**Decision.** A member may overwrite their own ballot while a proposal is open;
at close the ballot freezes permanently. This narrows CLAUDE.md invariant 6,
which listed `votes` as append-only (no update/delete). The amendment is scoped
to the live ballot row only — the append-only audit log is unchanged.

**Why.** Revisability-until-close is a coercion-resistance property of the secret
ballot, not a convenience: a member pressured into an early vote can quietly
change it before the window closes. Overwriting in place (rather than appending a
new row) also minimizes ballot metadata — there is no recast trail to subpoena or
leak. The permanent, tamper-evident record the invariant protects is the *closed*
result and the audit log, both untouched.

**How it works (all enforced in RLS, not the UI).**
- `vt_select`: a member may read ONLY their own ballot (`user_id = auth.uid()`).
  No other member and no moderator can read anyone else's vote, ever.
- `vt_insert` / `vt_update`: a member may insert and update only their own row,
  and update ONLY while the proposal is open (`now() between opens_at and
  closes_at`). After close the predicate is false, so the ballot is immutable.
- No `delete` policy: a ballot can't be withdrawn.
- `set_vote_weight` now fires on INSERT **and** UPDATE, so the stored weight is
  always re-derived from tenure server-side; the client never sends a weight.
- Invariant 4 is preserved: still one row per member (unique constraint); this
  updates in place rather than adding rows.
- No vote choice is ever written to the audit log (that would defeat the secret
  ballot). The `votes` table, gated by RLS, is the only record of a ballot.

See `migrations/0002_votes_revisable.sql`.

---

## 2026-06-09 — Neighborhood "none fits" modeled as a request queue

**Decision.** The "none of these fit" neighborhood option is modeled as its own
`neighborhood_requests` queue (a row with an optional note + `open`/`resolved`
status), replacing the earlier null-only signal.

**Why.** Leaving `neighborhood_id` null could not distinguish a member who
*actively* flagged that no listed neighborhood fits from one who simply hasn't
chosen yet — both looked identical to a moderator. A dedicated queue separates an
explicit flag from "not yet chosen," captures *where* uncovered residents
actually live (the optional note), and gives moderators a real worklist with a
"resolved" state — consistent with how verifications are handled. It also keeps
the door open to adding area-level neighborhood options later if the notes show a
pattern (SPEC.md §07).

**How it works.** A member picking "none fits" leaves `neighborhood_id` null and
opens a request. If they later pick a real neighborhood, a trigger auto-resolves
the open request. Moderators see open requests oldest-first and mark them
resolved after following up out-of-band (invariant 5 — a human decides; the
platform only surfaces). One open request per member (partial unique index);
resolved rows are kept as light history. RLS: member opens/reads own; moderators
read all and resolve. See `migrations/0001_neighborhood_requests.sql`.
