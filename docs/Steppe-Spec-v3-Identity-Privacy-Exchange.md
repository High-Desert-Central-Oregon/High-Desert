# Steppe — Spec v3: Identity, Privacy & Local Exchange

**Status:** Draft · micro-decisions resolved · ready to fold into *Groups, Calendar & Exchange Spec v2*
**Scope:** This layer adds two foundational models (member tiers, default-private profiles) and the surfaces that depend on them (a jobs board as a Listing type, posting rules, a chat permission matrix, the per-group messaging toggle, and the verification flows). It supersedes the relevant sections of v2 where noted and is meant to be merged into the main spec.

---

## 0. What v3 changes over v2

1. Introduces a **tiered identity model** — **Member** and **Neighbor** for v1; Visitor dropped; Referral-sponsored guests and Merchants named as *governance-gated future tiers*.
2. Makes **profiles default-private** — username only, every other field opt-in, enforced in RLS. Pairs with **verified-but-pseudonymous** identity.
3. Adds **jobs as a Listing type** inside Local Exchange, with an embedded structured connect/chat button.
4. Sets **posting rules**: member-only by default, with a bounded **inclusive-category override** (jobs, common goods, mutual aid).
5. Defines the **chat permission matrix** (who can message whom, in what context) and the **per-group free-tier messaging toggle**.
6. Extends the **verification subsystem** to two v1 flows (full residency, light local-presence).
7. Spins off a **charter addendum** for the legal track.
8. Adds a **layered notification & channel strategy** — in-app tiers (Critical default-on; Standard / Digest opt-in), email as the canonical time-critical channel, opt-in SMS for the Critical tier, and web push as an ambient-only layer.

These are cross-cutting. The tier and privacy models are load-bearing for Listings, Chat, and Profiles, so they land *before* those surfaces (see §9).

---

## 1. Identity & Membership Tiers  *(new — foundational)*

Design axiom: **everyone on Steppe has a tie to the place.** They live here (Member or Neighbor) — and that's the whole of v1. No anonymous global public; "a place, not an open platform" holds.

### 1.1 v1 tiers

| Capability | **Member** | **Neighbor** (free local) |
|---|---|---|
| Verification | Full residency verification | Light local-presence check |
| Dues | $4/mo flat **or** hardship waiver | None |
| View semi-public surfaces (jobs, inclusive boards) | ✓ | ✓ |
| Connect / DM from a semi-public post | ✓ | ✓ |
| Post (listings, group posts) | ✓ | ✗ by default — only where a group enables it for an inclusive category (§4) |
| In-group messaging | ✓ | Only if the group enables it (§5) |
| Govern / vote | ✓ | ✗ |
| Read another member's data | Only fields that member has shared (§2) | Only fields shared to "everyone" (§2) |
| Default public identity | Username + opt-in fields | Username + opt-in fields |

**Members** are the only tier the charter's *mandatory residency verification* gates — so the entrenchment stays intact. **Neighbors are explicitly non-members:** lighter check, no dues, no governance, no member-data access. They exist so the job board and inclusive boards can reach past dues-payers without opening the community core.

Hardship-waiver members are **full members** in every respect (per charter §4) — "member-only" never means "only those who paid money."

### 1.2 Dropped / deferred tiers

- **Visitor (itinerary-verified): dropped.** Self-asserted trips are forgeable, real proof is privacy-invasive and high-friction, and the value to a *local* job board is low. Not built.
- **Referral-sponsored guests: future, governance-gated.** The right mechanism for the occasional non-local *individual* with a real local tie (a relocator, a member's family). A verified resident vouches and stakes their accountability; access is time-boxed and self-limiting. This is classic robust-commons boundary design (Ostrom: graduated, sponsored entry). Named here, not built in v1.
- **Merchants / outside businesses: future, governance-gated.** More verifiable than a tourist (registration, license), but the single most *values-contested* addition — it runs into "no ads, ever," the anti-extraction core, and the **commercial marketplace already deferred to a community vote.** Whether and how narrowly outside businesses get in is a boundary the membership owns, not a founder call. Routed to the same governance gate as commercial activity.

### 1.3 Charter implication

"Mandatory residency verification" gates **membership** only; Neighbors are non-members and don't dilute it. The two future tiers (Referral, Merchant) each require a **charter amendment + member ratification** before they exist. See §8.

---

## 2. Privacy & Profile Model  *(new — foundational)*

The strongest expression of *member-owned data* in the product: you are private by default and choose what to reveal.

### 2.1 Rules

- **Username is always visible.** It's the only field shown by default.
- **Every other field is opt-in, default OFF** — display name, neighborhood, bio, contact/links, skills, anything else.
- **Per-field visibility scope.** Each field is set to one of: `hidden` (default), `members` (visible to Members only), or `everyone` (visible to Neighbors/guests too). This lets a member show their neighborhood to fellow members but not to the wider semi-public surface.
- **Verified-but-pseudonymous.** Residency verification still happens (it's entrenched), but it is **private to the org and moderators.** Publicly you are a username plus whatever you've toggled on. Steppe knows you're a verified resident; your neighbors see `juniper_jay` until you decide otherwise.
- **Profile = a simple card** in v1. *Customizable appearance* is named as later polish, not v1.

### 2.2 Enforcement (load-bearing)

This is an RLS problem, not a UI one. A profile read must return **only** the fields whose visibility scope the viewer satisfies, derived from the owner's settings and the viewer's tier/relationship — never filtered in the client.

- Model: a per-field visibility setting per user (e.g., a `profile_field_visibility` structure, or per-column scope flags).
- Reads go through a security-definer view/RPC that emits only permitted fields for `(owner, viewer)`; raw profile rows are not directly selectable across users.
- Moderation/verification reads are a **separate privileged path** (exempt) — moderators see verification evidence under the existing review surface, governed by its own policy.

### 2.3 Ripple across existing surfaces

Group member lists (already built in Phase 1), job posts, and chat all render **username-only by default**. The Phase 1 member list adopts this model when it lands. Governance (tenure-weighted voting, secret ballot) already needs only a username, so it's unaffected.

---

## 3. Jobs as a Listing Type  *(updates v2 — Listings / Local Exchange)*

Jobs are **not** a separate forum. They are a **Listing category inside Local Exchange**, reusing the existing listing → respond → chat machinery.

- **Structured but light.** A job post carries a small, fixed field set — **title, description, type** (gig / part-time / full-time / internship / volunteer), **location, and an optional compensation note** — "small but structured," not a free-form wall.
- **Embedded connect button.** Each post surfaces a structured chat/connect button (§6) so a viewer can open a thread with the poster in one tap.
- **Semi-public visibility.** Jobs are viewable by Neighbors as well as Members (the first surface where non-full-members read content — see RLS note in §9).
- **Posting** follows §4 (member-only by default; inclusive-category override available).
- **No in-platform transactions, no Steppe cut.** Jobs are connection, not commerce; this keeps the feature a member benefit rather than a marketplace (and clear of the deferred commercial-marketplace gate).

---

## 4. Posting Rules & the Inclusive-Category Override  *(updates v2 — Listings / Groups)*

- **Default: posting is member-only** (Members incl. hardship-waiver). Posting is the accountable-contribution surface; gating it to fully-verified residents protects quality, limits spam, and gives dues real meaning.
- **Inclusive-category override.** A bounded set of **category *types*** — **jobs, free/common goods, mutual aid** — may have **Neighbor posting** enabled per group/board by a maintainer. The override is *only* available for those designated inclusive types; every other category stays member-only.
- **Rationale.** The categories that exist precisely to serve people in need (someone seeking work, someone giving things away) shouldn't paywall the very people they're for. Inclusivity is opt-in where it matters, member-gated everywhere else.
- **Eligibility is policy-bounded.** Which category types are "inclusive-eligible" is a community/policy list, not an arbitrary per-group free-for-all. Maintainers opt in *within* that list.

---

## 5. Per-Group Free-Tier Messaging Toggle  *(updates v2 — Groups)*

- A **group setting** (set at creation or added later): *allow Neighbor messaging within this group.*
- Members can always message within their groups. The toggle governs whether **Neighbors** may message inside the group.
- **Posting stays member-only** regardless of this toggle, except where the inclusive-category override (§4) applies.
- Implementation: a per-group boolean carried alongside the existing visibility/join settings.

---

## 6. Chat Permission Matrix  *(updates v2 — Chat / Phase 4)*

Chat is the connective tissue; permissions derive from **tier + context + group settings**, never ambient.

| Context | Who may initiate / participate |
|---|---|
| DM from a semi-public post (jobs, inclusive boards) | Any tier (Member or Neighbor) → the poster. This is the "connect." |
| In-group messaging | Members always; Neighbors only if the group's toggle (§5) is on |
| Member ↔ Member DM | Allowed |
| Governance / voting | Members only (not chat, noted for completeness) |

- **Pseudonymity preserved.** Chat shows usernames; opening a thread exposes no profile data beyond the fields the other party has shared (§2). Reach never becomes exposure.
- **Transport** unchanged from v2 (Supabase Realtime); what changes is the *who-may-talk-to-whom* gate, which must be designed up front rather than bolted on.

---

## 7. Verification Subsystem  *(updates v2 — Verification)*

- **v1 has two flows:**
  - **Full residency** → Member. The existing moderator-reviewed flow.
  - **Light local-presence** → Neighbor. Local-address attestation plus one lightweight automated signal, with human review only on a flag — more automatable than full residency, lower moderator load. The specific automated signal is an implementation detail.
- The review surface distinguishes the two and applies the correct resulting tier.
- **Future flows** (deferred with their tiers): referral-sponsorship verification; merchant business verification.

---

## 8. Charter Addendum  *(for the legal track — sketch, not final)*

To hand to counsel alongside the main charter draft:

- **Non-member access tiers.** Define **Neighbor** as a non-member, locally-verified participant with view + connect rights only — no governance, no member-data access, no posting except where a group enables it for an inclusive category.
- **Verified-but-pseudonymous principle.** Verification is mandatory for membership and is held privately by the organization; a participant's public identity is their username plus voluntarily shared fields. Member-owned data is reinforced, not weakened.
- **Boundary reservation.** "Mandatory residency verification" continues to gate *membership*. The existence and scope of any further access tier (Referral-sponsored guests; Merchants/outside businesses) requires a charter amendment and member ratification, and is treated as a boundary the membership governs.

---

## 9. Build-Phase Impact

The tier and privacy models are foundational, so the sequence shifts:

- **Phase 2 — Calendar & Events** (already next): largely tier-independent (member-facing); can proceed.
- **Phase 2.5 — Identity tiers + Privacy/Profile model + RLS** *(new, inserted before the surfaces that need it):* the Member/Neighbor distinction, the light-verification flow, the per-field profile visibility model and its security-definer read path, and the retro-fit of the Phase 1 group member list to username-by-default. **Neighbor becomes a new RLS actor** — the G-invariant matrix (G1–G13) extends to a Member/Neighbor capability matrix: Neighbor may read semi-public surfaces and connect, and may **not** read member-only/governance data or member profile fields scoped above `everyone`.
- **Phase 3 — Listings + Jobs:** carries the posting rules + inclusive-category override and the semi-public (Neighbor-readable) visibility. **First surface where a non-full-member reads content → primary RLS checkpoint for the tier model.**
- **Phase 4 — Chat:** the permission matrix (§6), the per-group messaging toggle (§5), and cross-tier DMs from posts.
- **Notifications & channels** *(cross-cutting)*: the in-app tier model + email (canonical) land with the first governance-critical flow (votes, recall), where reliable delivery matters most; opt-in SMS (A2P 10DLC + consent capture) and web push follow as enhancements. See §10.

A full G-invariant re-audit (now including Member vs Neighbor) gates real-member onboarding, as before.

---

## 10. Notification & Channel Strategy

A layered strategy that beats a single notification app on reliability while staying off any platform chokepoint. The design rule is a governance property, not UX polish:

> **No quorum-critical notification depends on a channel Steppe doesn't control or that isn't near-100% deliverable.** Critical alerts ride owned, deliverable channels (email, opt-in SMS); ambient push is never something a vote's reach depends on.

### 10.1 In-app notification tiers

| Tier | Triggers | Default | Channels |
|---|---|---|---|
| **Critical** | Vote closing, board recall, foundational amendment | **On** (baseline) | In-app + email (canonical); opt-in SMS; ambient web push if installed |
| **Standard** | New proposal, moderation action | Opt-in | In-app + email |
| **Digest** | Weekly roundup | Opt-in | Email |

Default is **Critical-only; everything else opt-in** — the fatigue-plus-consent fix, mirroring default-private profiles (§2): the system defaults to the minimal, member-consented state rather than maximizing interruption. Critical stays the baseline so the few governance-critical moments reliably reach people; a member tunes channels *within* it (add SMS, mute email) but the tier itself is the floor.

### 10.2 Channels

- **In-app** — the durable record; always present regardless of tier or external channel.
- **Email — canonical for anything time-critical.** Addresses are already held, deliverability is solved, zero install friction. Needs proper sender setup (SPF / DKIM / DMARC) to stay out of spam.
- **SMS — opt-in, Critical tier only.** The "you must see this now" breakthrough: more reliable than web push, pierces Do Not Disturb, needs no app store. At ~2,300 members and a handful of critical votes a year, volume cost is trivial — tens of dollars annually. Because every member is a verified local, SMS is **all domestic** — no international cost or regulatory tangle. Two real chores: a one-time **A2P 10DLC** sender registration (US carriers), and **consent handling** — opt-in and STOP / HELP opt-out are consent events, recorded in an append-only log analogous to document consents, so the org can prove consent and honor opt-out (TCPA).
- **Web / PWA push — ambient nudge only.** Nice-to-have for members who've added Steppe to their home screen; progressive enhancement. Never load-bearing — iOS supports web push only for installed PWAs and unreliably even then, which is exactly why a quorum can't depend on it.

### 10.3 Why this shape

- **Off the chokepoint (Doctorow).** Owning email and SMS keeps governance-critical communication off any platform's push rails or a third-party notification app — no intermediary that can decay, gate, or de-prioritize the co-op's link to its members.
- **Reliable delivery is voice infrastructure (Hirschman).** If members don't reliably see a closing vote or a recall, voice is silently disenfranchised; delivery reliability on the Critical tier is a democratic-integrity property.
- **A notification system that refuses to be an attention machine.** Most platforms maximize notifications to drive engagement; Steppe minimizes them to the few that matter and makes the rest opt-in. The medium embodies the mission.

---

## 11. Resolved Decisions (v3)

These four were the flagged micro-decisions; all are now settled.

1. **Light-verification bar** — local-address attestation + one lightweight automated signal, with human review only on a flag (§7). Unblocks Phase 2.5; the specific automated signal is an implementation detail.
2. **Profile visibility scopes** — ship the three-scope model: `hidden` / `members` / `everyone` (§2.1).
3. **Job post fields** — title, description, type (gig / part-time / full-time / internship / volunteer), location, optional compensation note (§3).
4. **Referral / Merchant** — fully deferred; no schema or charter stub until the membership authorizes the tier (§1.2, §8).
