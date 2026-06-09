# Decisions log — High Desert

A running record of design and scope decisions made while building, with enough
"why" that the next person (or the cohort) can revisit them. Newest first.
Companion to `CLAUDE.md` (the invariants), `SPEC.md` (the build spec), and
`schema.sql` (the data layer). For the locked launch decisions, see SPEC.md §01.

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
