# High Desert — Prototype Build Spec (v2)

The technical bridge from the design framework to the first commit: what the prototype is,
the data model and the policies that make the constitution true in code, how each feature is
built, and the order to build it. Companion to `CLAUDE.md` (the invariants) and `schema.sql`
(the database). Scope is the **First Build Slice** — a functional closed-beta MVP, not a mockup.

- **Builds:** the First Build Slice · **For:** closed beta (Oct–Nov 2026)
- **Stack:** Supabase · Next.js · Tailwind · **Decisions:** locked · cohort free · 35 neighborhoods seeded

---

## 00 · Orientation

A *functional* MVP a ~50-person Redmond founding cohort can actually use — real verification,
real neighborhood events, a real governance vote, a real public transparency view. It is the
smallest thing that is unmistakably High Desert (Pattern 17, Minimum Trustworthy Platform).
It is **not** the full platform and not a design mockup. Everything here implements a pattern;
the ties are marked so the reasoning stays attached to the code.

---

## 01 · Decisions (locked) + stack

All six signed off (June 2026); Step 1 can begin. Values are config-driven and ratifiable by
the community later, but the build no longer waits on any of them.

| Layer | Choice | Why |
|---|---|---|
| Data + auth + storage | Supabase (Postgres, Auth, Storage, RLS) | RLS makes the constitution structurally true (P18). |
| Frontend | Next.js (App Router) + React + Tailwind | Server components keep trust logic off the client; mobile-first; one deploy. |
| Hosting | Vercel or Netlify | Zero-config deploys. |
| Email | Supabase Auth (magic link) + Resend | No passwords to leak. |
| Payments | **None in the prototype** — Stripe later | Cohort is free; build the field, defer the integration + sliding-scale UI. |
| SMS / alerts | Deferred | Resilience alerts are Phase 2. |

**Locked specifics**

- **Verification pathways:** ID / utility bill / voter reg / property record / **mailed postcard
  code**, all human-reviewed. The postcard path is the PO-Box / Warm Springs / unbanked accommodation.
- **Governance numbers (provisional config):** quorum 15%, major 60%, immutable 75% + 30 days;
  tenure weight (Business Plan v11, 1×–3×): `< 1 yr` 1.0× · `1–2 yr` 1.5× · `2–4 yr` 2.0× · `4 yr+` 3.0×.
- **Vote visibility:** secret until close, aggregate-only after (anti-coercion).
- **Billing:** cohort free; defer Stripe.
- **Terms & Privacy:** plain-language design-specific draft exists (`highdesert-terms-privacy-v1`),
  seeding `documents` (kind = terms / privacy). **Pending Oregon legal review** before launch.

---

## 02 · Prototype scope

### In — the prototype builds

- **Auth & member profile** — magic-link sign-in, profile row.
- **Residency verification** — multi-path, human-reviewed, verify-then-forget *(A1)*.
- **Neighborhoods** — resident-set from a seeded list *(B2)*.
- **Neighborhood event primitive** — create / list / detail / RSVP / who's-bringing *(B1, B3)*.
- **Governance** — proposal + tenure-weighted vote + result + audit log *(A2)*.
- **Moderation** — report → graduated action → appeal, human decides *(A3)*.
- **Transparency view** — public aggregate health + mod log + vote results *(A4)*.
- **Plain-language T&C** — versioned, read-confirm, consent record *(A5)*.
- **Accessibility + Spanish + low-bandwidth** — cross-cutting, not a later pass.

### Out — deliberately deferred or refused

Mutual aid (C1), skills/trades trust graph (C2), skill exchange/learning webs (C3), recurring
events (B4), resilience alerts + SMS (C5), real payments + sliding-scale UI, the **regional
discussion board** (deferred & logged), local marketplace, visitor posting/voting, youth
version, historical archive, multi-community expansion.

### Why each is deferred or out

**Deferred — coming later, not first**

- **Mutual aid board** *(Phase 1)* — needs a critical mass of verified neighbors and a working
  trust culture, or it sits empty / gets misused.
- **Skills & trades trust graph** *(Phase 1)* — the hardest knowledge feature; must resist
  becoming a score (P10); needs mature verification + vouching norms first.
- **Skill exchange / learning webs** *(Phase 1)* — depends on the trust graph and an active event
  culture; matching needs enough verified members to matter.
- **Recurring gatherings** *(near-term)* — complexity on the event primitive; prove single events
  first.
- **Resilience alerts + SMS** *(Phase 2)* — high-stakes; needs redundant, tested delivery and a
  provider; never bolt onto an MVP.
- **Historical archive** *(Phase 2, gated)* — held until Warm Springs consultation; cultural
  memory is sovereignty-sensitive.
- **Youth version (13–17)** *(Phase 3, gated)* — real legal/safety surface (COPPA); requires a
  community vote.
- **Payments + sliding-scale UI** *(post-beta)* — cohort is free; deferring removes Stripe/PCI
  surface and lets fieldwork teach the need-distribution first (Meadows).
- **Multi-community expansion** *(Year 1+)* — Redmond-first *is* the strategy; gated on Redmond
  being healthy.
- **Regional discussion board** *(deferred & logged)* — highest-conflict, highest-moderation
  surface; the thing that turned Nextdoor toxic. Re-opened only by community vote.

**Out by design**

- **Advertising** *(permanent, immutable)* — a second customer whose interests oppose members' is
  the root of platform decay (Doctorow, Wu).
- **Scope-based pricing** *(decided against)* — feels fair but inverts fairness (breadth ↔ need →
  regressive) and installs an enshittification value-withhold; replaced by price-by-means.
- **Ranking / recommendation / engagement optimization** *(out)* — severs feedback from the
  people affected; default chronological + proximity (O'Neil, Christian, P8).
- **Local marketplace / buy-sell** *(out — Compass's lane)* — commercial discovery belongs to
  Redmond Compass; a market imports the ratings pressure HD refuses.
- **Visitor posting / voting** *(out)* — participation requires verified residency (Ostrom).

**Post-beta roadmap (not in the current build).** Named future directions whose disciplines are
already decided, kept here so the build doesn't drift into them by accident.

- **Local Exchange — non-monetary core** *(committed, post-beta)* — neighborhood-scoped
  needs exchange ("I have / I need") and tradespeople trade-for-trade (barter of services,
  no money), sharing one listing primitive (offer/ask with category). Verified members only;
  chronological + proximity; no platform fee/cut, no ranking, no ratings. See Pattern 25
  and DECISIONS.
- **Local Exchange — commercial layer** *(later, community-voted)* — monetary marketplace
  as an added layer on top, gated behind a governance vote; not built until the cohort
  approves it. Same disciplines; commercial scope requires the community to decide when and
  whether to widen. See Pattern 25 and DECISIONS.

---

## 03 · Data model

Postgres tables (defined in `schema.sql`). Two invariants show up in the schema itself:
**store as little PII as possible** (verify-then-forget, P2) and **votes / moderation / audit
are append-only** (P18).

| Table | Key columns | Notes / pattern |
|---|---|---|
| `profiles` | id → auth.users, display_name, neighborhood_id, **verified**, **role**, **tenure_start**, locale | verified / role / tenure_start are **server-set only** — frozen on self-edit. Ladder: visitor → verified → tenured (P3). |
| `verifications` | id, user_id, method, status, evidence_path, reviewed_by, reviewed_at | evidence_path → private bucket; **nulled on decision** (P2). Only reviewers read evidence. |
| `neighborhoods` | id, slug, name, description | Seeded with 35 Redmond neighborhoods (below). Resident-set, not radius (P4). |
| `events` | id, creator_id, neighborhood_id, title, body, starts_at, location, capacity, status | Neighborhood-scoped gathering (P11). **No free-text comment feed** (P12). |
| `event_rsvps` | id, event_id, user_id, status, bringing | Light coordination only (P12). One row per user per event. |
| `proposals` | id, author_id, title, body, kind, status, opens_at, closes_at | Rules-before-tool (P5). Thresholds from kind + config. |
| `votes` | id, proposal_id, user_id, choice, **weight** | weight **server-set from tenure**; one vote/proposal; **secret until close** (P6). |
| `moderation_actions` | id, target_type, target_id, actor_id, action, reason, expires_at | **Append-only.** Graduated; no permanent ban without review (P7, P9). |
| `appeals` | id, moderation_action_id, user_id, body, status | Opens immediately after action — voice follows action (P7). |
| `audit_log` | id, actor_id, action, entity, entity_id, metadata (jsonb) | **Append-only.** Public, no PII. Feeds transparency (P8). |
| `documents` / `consents` | documents(kind, version, body) · consents(user_id, document_id, accepted_at) | Versioned T&C; consent bound to the exact version (P22, A5). |

---

## 04 · RLS — the constitution in code

Access is enforced at the row level (P18); the UI is never the only thing between a rule and
its breach. **Verified status and tenure weight are computed by the server and trusted from
nowhere else.**

| Table | Read | Write |
|---|---|---|
| `profiles` | public fields, authenticated | own row only; verified/role/tenure **frozen** (service role only) |
| `verifications` | own status; **evidence → reviewers only** | insert own (pending); status set by reviewers |
| `events` / `event_rsvps` | verified members | insert if verified; edit by creator or moderator |
| `proposals` / `votes` | proposals: verified · **individual votes: never** (aggregate only) | one vote/proposal while open; weight server-set |
| `moderation_actions` / `audit_log` | public (no PII) | insert by moderators/service; **no update, no delete** |

The two policies that matter most:

```sql
-- A member may cast at most one vote per open proposal.
-- The weight column is set by a trigger from tenure, never by the client.
create policy "one vote per open proposal" on votes
for insert to authenticated
with check (
  exists (select 1 from profiles p
          where p.id = auth.uid() and p.verified)
  and exists (select 1 from proposals pr
          where pr.id = proposal_id and pr.status = 'open'
            and now() between pr.opens_at and pr.closes_at)
  and not exists (select 1 from votes v
          where v.proposal_id = proposal_id and v.user_id = auth.uid())
);

-- Verify, then forget: on any decision, null the evidence pointer (the app's
-- decideVerification action deletes the Storage object before it commits).
create trigger trg_purge_evidence
after update of status on verifications
for each row when (new.status in ('approved','rejected'))
execute function purge_verification_evidence();
```

---

## 05 · Implementation by feature

- **Auth & profile** *(P3)* — `profiles` row via signup trigger; magic-link sign-in; visitor
  until T&C + verification unlock participation. The ladder is enforced in RLS, not just hidden.
- **Terms & read-confirm** *(P22, A5)* — render the current `documents` version, require a real
  scroll-and-confirm, write a `consents` row bound to that version; re-confirm on change. The
  plain-language draft (`highdesert-terms-privacy-v1`) seeds these rows, pending legal review.
- **Verification** *(P1, P2, P24, A1)* — member picks a path (ID / utility bill / voter reg /
  property record / mailed postcard code) → reviewer queue → a person approves/rejects via
  `decide_verification()` → evidence purged, only status kept. The **postcard-code path** is the
  PO-Box / Warm Springs / unbanked accommodation and must work day one.
- **Neighborhoods** *(P4, B2)* — self-assign from the 35 seeded on join; "none fits" → human;
  editable by community process later, never a hard radius.
- **Event primitive** *(P11, P12, B1/B3)* — verified member creates a neighborhood-scoped
  gathering; others RSVP + add what they're bringing; optional carpool. **No open comment thread.**
- **Governance** *(P5, P6, A2)* — proposal (kind) → window → one ballot each → server tally via
  tenure weights + kind threshold → result + metadata to `audit_log`. Ballots secret until close;
  weight server-set. Seed the beta with one small real vote.
- **Moderation & appeal** *(P7, P9, P19, A3)* — report → graduated action (append-only) →
  appeal opens immediately. No permanent ban without review; a person always decides; sustained
  complaints can trigger a community override (reuse the governance engine).
- **Transparency** *(P8, A4)* — public read of aggregates over `audit_log`, `moderation_actions`,
  and the `proposal_results` view. Vital signs, not targets — never optimized, never per-member
  scores. Quietly track exit-vs-appeal as the early-warning signal.
- **Accessibility, Spanish, low-bandwidth** *(P24, design practice)* — semantic HTML, keyboard
  paths, contrast, captions, en+es i18n layer from the first screen; test on a slow phone.

---

## 06 · Build sequence

Dependency-ordered. The trust substrate is built before anything to participate in; the
discussion-style surfaces are never built. Maps to the June technical-build milestone and the
closed-beta gate.

1. **Scaffold & seed** — Next.js + Tailwind + Supabase; env + CI + deploy; run `schema.sql`; seed
   neighborhoods + first T&C doc. *Done when a deployed empty app talks to the DB under RLS.*
2. **Auth & profile** — magic-link; profile-on-signup; profile RLS. *Gate: status/role/tenure not
   self-editable.*
3. **Terms & consent** — versioned render + scroll-confirm + consent record; participation locked
   until consent + verification.
4. **Verification + reviewer queue** — multi-path submit, private evidence bucket, reviewer UI,
   approve/reject, evidence purge. *The substrate — precedes all participation. Gate: postcard
   path works; evidence gone after decision.*
5. **Neighborhoods** — self-assign from the seeded list; "none fits" → human.
6. **Event primitive** — create / list / detail / RSVP / bringing; no comment feed. The headline.
7. **Governance engine** — proposal → window → one weighted ballot → server tally → audit; secret
   until close; run one real seed vote. *Gate: weight server-set; one-vote enforced in RLS.*
8. **Moderation, appeal & transparency** — report → graduated action (append-only) → appeal;
   public transparency page over the audit log; reuse governance for overrides.
9. **Accessibility, Spanish & mobile pass** — keyboard, screen-reader, contrast, i18n, slow-phone.
10. **Closed-beta hardening** — full RLS review, seed the ~50-person cohort, dry-run the first
    conflict + first vote. *Then* the public-launch gate applies: two trained mods · RLS reviewed ·
    the slice works end-to-end.

---

## 07 · Seed: Redmond neighborhoods (35)

From the Enjoy Bend Life Redmond neighborhood map (the source and the founder's list match
exactly). Members self-assign; "none fits" → human (P4). Defined in `schema.sql`.

`braydon-park, canyon-crossing, canyon-rim-village, cascade-view-estates, cascade-west,
cinder-butte-village, deer-crossing, diamond-bar-ranch, echo-rim-estates, emerald-view-estates,
evansville, fieldstone, greens-at-redmond, maple-meadows, maplewood, mckenzie-rim-estates,
meadowbrook-estates, megan-park, mountain-glenn, north-rim, obsidian-trails, pine-tree-meadows,
pleasant-view, red-bar-estates, red-hawk, rimrock-west-estate, sterling-pointe, summit-crest,
triple-ridge, village-at-ridgeview, vista-meadows, west-canyon-estates, wildflower, windsong,
eagle-crest`

> **Note.** `eagle-crest` is a destination resort **outside Redmond city limits** — keep it only
> if Eagle Crest residents count as part of the community (delete the last seed row to exclude).
> This is a *subdivision*-level list; residents who identify with a broader area (Downtown,
> North/NW/NE Redmond, rural pockets like Chaparral) are caught by the "none fits → human"
> fallback; add area-level options later if fieldwork shows people want them.
