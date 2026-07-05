# Steppe against two doctrines: Governable Spaces & Emergent Strategy

**v1 · July 2026 · living document.** An honest scorecard of how Steppe's shipped
system and canon hold up against Nathan Schneider's *Governable Spaces* (2024) and
adrienne maree brown's *Emergent Strategy* (2017), with the policy changes that
follow. Adopted changes are marked **ADOPTED**; anything touching member
governance is a **PROPOSAL** for the cohort/board — consistent with the standing
rule that governance policy is ratified by members, not decided in a commit.

Evidence cites the actual system (schema, app, canon docs), not intentions.

---

## Part I — Governable Spaces (Schneider)

Schneider's core diagnosis: online spaces default to **implicit feudalism** — the
admin-owns-the-castle pattern baked into tooling (arbitrary founder/mod power, no
appeal, no exit with your belongings, rules changeable by fiat). His remedy:
**democratic mediums** — spaces whose governance is explicit, modular, learnable,
and changeable by the governed.

### Where Steppe already embodies it

| Doctrine element | Steppe's implementation | Evidence |
|---|---|---|
| Community ownership (no landlord) | Member-governed Oregon nonprofit; can't be sold; mission entrenched in articles | README; BP v12; NOTICE |
| Rules-about-rules (metagovernance) | Two-layer constitution: non-votable legal floor vs member-amendable Schedule of Defaults; immutable changes need 75% + 30-day deliberation | Terms §2; CLAUDE.md governance numbers |
| No fiat rule-change | Governance numbers are provisional **config awaiting cohort ratification** — the founder deliberately cannot hardcode them as law | CLAUDE.md "Open items" |
| Due process, not admin whim | Human-in-the-loop on every consequential act; appeals resolved by a **different** moderator (separation of duties enforced in-DB); every action on a public transparency log; append-only record binding every role incl. service_role | schema.sql:664-678; migration 0012; `/protected/transparency` |
| Secret ballot / political privacy | `votes` readable only by the voter — no moderator clause, no admin path; results only post-close, withheld below a 5-ballot floor | schema.sql:1112-13, 954-974 |
| Exit with your belongings | Full data export (`/protected/account/export`) + self-service deletion with trust-field scrub | account/export route; `delete_my_account()` |
| Anti-capture plumbing | Three-moderator minimum on staggered one-year terms "to preserve plural judgment and prevent capture"; moderators janitorial-not-gatekeeping on taxonomy | Charter 8.9; Groups spec v2 §99 |
| Democratic apprenticeship | Governance is a core app tab, not a settings page; the launch plan's center of gravity is a **real vote in week one**; plain language everywhere | GTM Phase 1; invariant P22 |
| Governable stack (infrastructure) | Codeberg-canonical forge, portability audit, year-two self-host milestone — the space is being made governable down to the metal | docs/decisions/codeberg-migration.md; portability-audit.md |

This is an unusually strong scorecard; most of Schneider's book is a critique of
defaults Steppe was explicitly designed against.

### Where feudal residue remains (the honest part)

1. **Moderator selection & recall are unspecified.** Charter 8.9 gives term
   structure but never says **who appoints, who renews, and how members remove**
   a moderator. Silence here defaults to appointment-from-above — the exact
   feudal residue Schneider names. → **PROPOSAL P1** below. *(Highest-priority
   change in this assessment.)*
2. **The founder-protection period is a disclosed, sunsetted autocracy.** As a
   transitional device with a constitutional expiry (5–7 yr) it is defensible —
   Schneider allows for stewardship phases — but its *visibility to members
   inside the product* is zero today. → **PROPOSAL P6**.
3. **Tenure weighting risks a seniority aristocracy.** 1×–3× voting weight by
   tenure is live in code (flat **in effect** at launch — a fresh cohort is
   uniformly 1.0×) and diverges automatically as tenure accrues. The app's own
   copy promises "members can later vote to weight by tenure" — so the
   ratification vote is load-bearing, and silence would activate weighting by
   default. → **PROPOSAL P2**.
4. **Moderation is remedial, not restorative.** The pipeline is
   report → remove → appeal — procedurally fair but shaped like a courtroom.
   Schneider (with Ruha Benjamin and the restorative-justice literature) argues
   democratic spaces need a **repair path**, not only a verdict path.
   → **PROPOSAL P3**. Deliberately *not* added to the Terms now: promise ≤
   practice; build it first.
5. **Rules aren't yet visible as governable objects.** The Schedule of Defaults
   lives in documents, not in the interface; a member can't see "this rule,
   amendable, last changed by vote X." Modular politics wants the rules surface
   itself legible. → **PROPOSAL P5** (post-launch build).

---

## Part II — Emergent Strategy (brown)

brown's core principles: **small is good, small is all** (the large is a fractal
of the small); **move at the speed of trust** (critical connections over critical
mass); **change is constant — adapt intentionally**; **trust the people**; **what
you pay attention to grows**.

### Where Steppe already embodies it

| Principle | Steppe's implementation | Evidence |
|---|---|---|
| Small is all / fractal | The 35-neighborhood captain structure mirrors whole-org governance; the 12-community hard cap refuses scale beyond governability; "ship the smallest thing that is unmistakably Steppe" | GTM Phase 2; BP v12; CLAUDE.md |
| Speed of trust / critical connections | Growth only by vouching; cohort "chosen, not solicited"; no paid acquisition ever; partners bring ten people they'd vouch for | GTM non-negotiables + Phase 0 |
| What you pay attention to grows | Health signals are participation and trust metrics, never engagement; chronological + proximity ordering is a constitutional invariant (no attention optimization to grow) | GTM health signals; invariant 7 |
| Intentional adaptation | Living documents with changelogs and revisit clauses; provisional numbers awaiting ratification; DECISIONS.md logs *why* with a revisit path | DECISIONS.md; BP v12 header |
| Trust the people (post-gate) | Verify once at the gate, then delete the proof and govern by pseudonymous standing — surveillance-free trust | T&S decision record; verify-then-forget |
| Interdependence over dependence | Founder-protection sunsets; "an institution that survives its founder"; groups run by their own maintainers | GTM Phase 4; groups RPCs |
| Guarding emergence against structurelessness | The captains model explicitly imports Jo Freeman's caution — light, explicit structure so informal power can't concentrate | GTM Phase 2 |

The GTM plan is, in practice, an emergent-strategy document that never cites her.

### Where it falls short

6. **Adaptation has documents but no ritual.** Living docs adapt when someone
   edits them; brown's discipline is a *rhythm* of collective reflection. The
   dry-run runbook tests function, not felt experience; nothing schedules the
   question "what is this like to live in, and what should change?"
   → **ADOPTED A1** below (an operating practice, not a governance rule — safe
   to adopt).
7. **The hardship waiver's mechanics are unspecified.** "Trust the people" (and
   they become trustworthy) argues for **self-attestation** — no means-testing
   theater for a $4 waiver. Unspecified today; specifying it trust-first is a
   dues-policy call. → **PROPOSAL P4**.

---

## Part III — Changes

### Adopted now (doc-level, within remit) — **ADOPTED**

- **A1 · A reflection cadence for the beta.** During the closed beta: a monthly
  three-question member pulse (what's working / what's hard / what should
  change), summarized publicly on the transparency surface; one quarterly
  retrospective whose outputs are framed **as draft proposals** into the Govern
  tab — so reflection feeds the governance loop instead of a suggestion box.
  Cheap, reversible, no code required to start (a pinned listing + a form
  suffices). Recorded in DECISIONS.md.
- **A2 · Canon acknowledgment.** Schneider and brown join the named intellectual
  canon (README), so the next reader knows these lenses are load-bearing, not
  decorative.
- **A3 · This assessment** as a living scorecard, revisited at each stage gate.

### Proposals for cohort/board ratification — **PROPOSAL** (not decided here)

- **P1 · Moderator selection & recall (fills the Charter 8.9 gap; top priority).**
  Suggested shape for the Schedule of Defaults: moderators are **confirmed by
  member vote** (simple majority) on appointment and at each annual renewal;
  any 10% of members may trigger a **recall vote**; the board may suspend
  immediately for cause pending a member vote. Keeps the legal floor's
  compliance duties intact while making stewards accountable downward, not
  upward.
- **P2 · Tenure-weight ratification with a sunset.** Put weighting to the
  promised cohort vote explicitly, and — whatever passes — attach a
  **re-ratification clause** (e.g., every 2 years) so a seniority aristocracy
  can never become furniture. Default-if-silent should be **flat**, matching
  the app's launch copy.
- **P3 · A restorative path in moderation.** A voluntary
  facilitated-conversation option for member–member conflict, alongside (never
  replacing) report/remove/appeal and never for legal-floor violations. Build
  post-launch; only then reflect it in the Terms (promise ≤ practice).
- **P4 · Hardship waiver by self-attestation.** One checkbox, no documentation,
  reviewed only in aggregate (count published in the transparency report).
- **P5 · Rules as visible objects (post-launch build).** A `/protected/rules`
  surface rendering the current Schedule of Defaults with each rule's amendment
  history and a "propose a change" affordance — modular politics made tangible.
- **P6 · Founder-protection visibility (post-launch build).** The transparency
  page states the protection period's terms and its countdown, in plain
  language, until it sunsets.

### Explicitly not changed

Schema, RLS, auth, moderation code, governance numbers, and the Terms — the
first four by standing constraint, the numbers because they are the cohort's to
ratify, and the Terms because none of the above exists in the product yet.

---

**Changelog**
- v1 (2026-07-04) — initial assessment; A1–A3 adopted; P1–P6 tabled for the
  cohort/board.
