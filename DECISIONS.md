# Decisions log — High Desert

A running record of design and scope decisions made while building, with enough
"why" that the next person (or the cohort) can revisit them. Newest first.
Companion to `CLAUDE.md` (the invariants), `SPEC.md` (the build spec), and
`schema.sql` (the data layer). For the locked launch decisions, see SPEC.md §01.

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
