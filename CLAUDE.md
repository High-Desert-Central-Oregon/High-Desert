# CLAUDE.md — Steppe

This file is the codebase's constitution. Read it before doing anything. Every feature
here implements a documented design pattern; the reasoning is in `SPEC.md` and the data
layer is defined in `schema.sql`. **If a change would violate an invariant below, stop and
flag it — do not "helpfully" work around it.**

## What this is

Steppe is community-owned, verified, ad-free digital civic infrastructure for
**Redmond, Oregon** — a member-governed Oregon nonprofit public benefit corporation
(ORS 65, on a 501(c)(3) pathway). It is *not*
ad-supported social media. We are building the **prototype**: a functional closed-beta MVP
a ~50-person founding cohort will actually use (real verification, real neighborhood
events, a real governance vote, a public transparency view). Ship the smallest thing that
is unmistakably Steppe, then earn the right to add more.

## Stack

- **Next.js (App Router) + React + Tailwind.** Prefer **server components / server actions**
  for anything trust-sensitive (verification, vote casting, role checks). Never put trust
  logic only on the client.
- **Supabase** — Postgres, Auth (magic link), Storage, Row-Level Security. The DB is the
  source of truth and the enforcement layer.
- Deploy on Vercel or Netlify. **No payments in the prototype** (the cohort is free).
- No localStorage/sessionStorage for trust state; the server and DB hold truth.

## Non-negotiable invariants (the constitution in code)

These are enforced in `schema.sql` (RLS + triggers). The app must respect them, never
undermine them:

1. **Verify, then forget.** Verification documents live briefly in the private
   `verification-evidence` bucket and are deleted the instant a decision is made. Keep only
   `profiles.verified` + the method. Never persist evidence anywhere else.
2. **Server sets trust, never the client.** `profiles.verified`, `role`, and `tenure_start`
   are server-only (frozen on self-edit by a trigger). A user cannot make themselves verified,
   a moderator, or more tenured.
3. **Vote weight is computed server-side from tenure.** Clients send only
   `{ proposal_id, choice }`; a trigger sets `user_id` and `weight`. Never accept a
   client-supplied weight.
4. **Ballots are secret; one per member.** `votes` has no read policy — never expose
   individual ballots in the UI or an API route. Read results only from the
   `proposal_results` view (which shows *closed* proposals only). One vote per member per
   proposal is enforced by a unique constraint.
5. **Human in the loop on consequence.** Moderation outcomes, verification decisions, and
   governance results are decided by people. Automation may surface, sort, or flag —
   **never decide.** Use `decide_verification()` for the moderator action.
6. **Append-only record.** `moderation_actions`, `consents`, and `audit_log` are strictly
   append-only — no update or delete, ever. `votes` is **immutable-after-close,
   revisable-while-open**: a member may revise their ballot while the proposal is open
   (coercion-resistance), but once it closes the ballot can't be added, altered, or erased.
   This is enforced in-DB by triggers (migration 0012) that bind **every** role —
   `service_role` and the table owner included — not just RLS. Treat all four as the
   permanent record; write to `audit_log` via `log_audit()` only. A clean dev slate comes
   from `supabase db reset`, not row deletes (the deletes are refused).
7. **No ranking, no engagement optimization.** Default to **chronological + proximity**
   ordering everywhere. No opaque scoring, recommendation, or feed-optimization. If ranking
   is ever needed, it must be member-visible and never an optimization target.
8. **No ads, no behavioral tracking, no dark patterns.** No third-party ad/analytics
   trackers. Member data is exportable and member-owned; nothing a member made is held hostage.
9. **Accessible by default + Spanish + low-bandwidth + mobile-first.** Semantic HTML, full
   keyboard paths, real contrast, captions, an i18n string layer (en + es together), and a
   layout that works on a slow phone — from the first screen, not a later pass.
10. **Effort where it belongs.** Routine actions effortless (one-tap RSVP, obvious
    affordances, no manual). Consequential actions deliberate (read-and-confirm on terms, a
    real pause before an irreversible vote).

## How to write the code

- **Contain complexity (Ousterhout).** Deep modules behind narrow interfaces; pull
  complexity into the platform so the member and the next developer don't carry it. Design it
  twice before committing. Define errors out of existence where you can.
- **Built to be maintained.** Readable, documented, conventionally structured — an intern
  should be able to read it. No one-person-in-their-head magic. Small, legible contribution
  surface.
- **RLS-first.** Assume the client is hostile. Enforce access in the database; the UI is
  convenience, never the gate. Don't add an API route that bypasses RLS with the service key
  unless it's a deliberate server action that itself enforces the rule.
- **Plain language in the UI** (Pattern 22) — the member should never need an explanation.

## Build order (see SPEC.md §06)

1. Scaffold (Next.js + Tailwind + Supabase client) — run `schema.sql` against the project.
2. Auth + profile (magic link; profile bootstrap; profile RLS).
3. Terms & Privacy read-confirm gate (seed from `documents`; record `consents`).
4. **Verification + reviewer queue** (multi-path, human-reviewed, evidence purged on
   decision). *This is the substrate — build it before any participation screen.*
5. Neighborhoods (self-assign from the 35 seeded; "none fits" → human).
6. Event primitive (create / list / detail / RSVP / bringing). No comment feed.
7. Governance (proposal → tenure-weighted vote → result from `proposal_results` → audit).
8. Moderation + appeal + transparency view (append-only; reuse governance for overrides).
9. Accessibility / Spanish / mobile pass.
10. Closed-beta hardening (RLS review; seed cohort; first real vote).

## Do NOT build (out of prototype scope — see SPEC.md §02)

> **Superseded in part (2026-07-04, see DECISIONS.md):** groups, event recurrence, the
> Local Exchange listing primitive (needs/offers/goods/jobs/mutual-aid listings), and
> member messages moved INTO closed-beta scope under
> `docs/Steppe-Groups-Calendar-Exchange-Spec-v2.md` (+ Spec v3). Groups are shipped
> (migration 0013). Everything below remains out.

Don't scaffold these even if they seem helpful; they're deliberately deferred or refused:
skills/trades trust graph, resilience alerts/SMS, payments / sliding-scale UI (the
Exchange is listings-only — no on-platform transactions, ever, in the prototype),
**the regional discussion board** (highest-conflict surface, deferred & logged), a
payments marketplace, visitor posting/voting, multi-community expansion, youth (under-18)
accounts. If a task seems to require one of these, stop and ask.

## Key files

- `schema.sql` — the database: tables, RLS, triggers, the `proposal_results` view, seeds
  (35 Redmond neighborhoods; placeholder Terms/Privacy rows). Run it first.
- `SPEC.md` — the base build spec (scope, data model, RLS, per-feature implementation,
  sequence, locked decisions). For groups / calendar / the Exchange, the active companion
  is `docs/Steppe-Groups-Calendar-Exchange-Spec-v2.md` (see DECISIONS.md 2026-07-04).
- Terms & Privacy draft (`highdesert-terms-privacy-v1`) — plain-language, pending Oregon
  legal review; replace the placeholder `documents` bodies before launch.

## Open items (don't silently decide these)

- **Eagle Crest** is in the neighborhood seed but sits outside Redmond city limits — leave it
  unless told to remove it.
- Terms & Privacy are a **draft pending legal review** — do not present them as final.
- Governance numbers (quorum 15%, major 60%, immutable 75% + 30 days; tenure 1×/1.5×/2×/3×
  by <1yr / 1–2yr / 2–4yr / 4yr+, Business Plan v12) are provisional config for the cohort to
  ratify — keep them in config, not hardcoded.
