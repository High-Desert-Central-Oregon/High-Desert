# Decision Record — AI-Assisted Development Practice

**Date:** 2026-07-25
**Status:** Adopted (founder-era canon). A member-governable matter — ratifiable,
amendable, or replaceable by member vote once governance is live (see Governance status).
**Scope:** How AI tooling is used to build Steppe, where its use is bounded, the
human-review gate it passes through, and the copyright/licensing posture for
AI-assisted output. It does **not** settle the underlying legal question of
output-rights transfer — that is flagged for counsel, not decided here.
**Note on this document:** a governance record that defines the auditable-core /
visual-layer boundary is, by its own logic, **auditable-core** — so this ADR was
itself authored in DCO-reviewed Claude Code under the very process it describes,
not prototyped in chat.

---

## Context

Steppe is built with AI assistance, primarily Anthropic's Claude. This record
documents that practice, because Steppe's whole proposition is verifiable trust
rather than asserted trust. A community that is asked to govern its own
infrastructure is owed a plain account of how that infrastructure is made.

The immediate prompt is **Codeberg's Terms of Use (§7, July 2026)**, which surface
two concerns about AI-generated contributions: **copyright clarity** — whether the
project has the rights it purports to license out — and **safeguards against
harmful or malicious code**. This ADR answers both. But it is written for Steppe's
**own transparency obligations to its members**, not as a compliance filing to a
host; if the canonical repository ever leaves Codeberg, the reasons to keep this
record intact do not.

The intended copyright posture, qualified below: AI-assisted
output is treated as **Steppe's work product**, licensed outbound under
**AGPL-3.0-or-later** on the project's inbound=outbound terms, with the **DCO
sign-off** on each commit asserting the contributor's right to submit it. The legal
basis on which Steppe relies to treat model output as its own — Anthropic's
commercial terms — is Steppe's present understanding and is listed under Open /
counsel items as pending confirmation, because an unverified premise at the root of
the license chain does not belong in this record as settled fact.

---

## Decisions

### 1. Tools, and the boundary between them

- **Claude Code** — the terminal agent, operating on the repository with the DCO
  sign-off hook active — is the tool for **implementation**: application code,
  server actions, database schema, migrations, and tests.
- **Claude chat / Claude Design** is permitted for **visual and component
  prototyping only** — landing-page aesthetics, layout studies, standalone
  design artifacts. Its outputs are reference material that a human then ports
  into reviewed code; nothing it produces is trusted or imported directly. The
  design-source provenance record already documents exactly this path (the
  exchange preview embed is a self-contained Claude Design export with no build- or
  run-time import; the `_design-source/*.html` studies are reference artifacts only).

- **The hard rule:** the **auditable core is never prototyped outside
  DCO-reviewed Claude Code.** Concretely, the auditable core is:
  - `schema.sql` — RLS policies, triggers, the `proposal_results` view, seeds;
  - `migrations/*.sql` — the ordered, in-DB enforcement changes (vote revisability,
    tenure-weight range, the append-only backstop, RLS hardening);
  - `steppe/lib/governance.ts`, `steppe/lib/verification.ts`,
    `steppe/lib/moderation.ts`, `steppe/lib/auth.ts`, `steppe/lib/onboarding.ts`;
  - `steppe/lib/supabase/**` — the server/admin clients and the service-role boundary;
  - `steppe/app/**/actions.ts` — every server action (governance, verify, review,
    moderation, account, events, groups, exchange, messages, neighborhoods, welcome);
  - `steppe/app/protected/**` — the trust-gated routes;
  - `steppe/tests/**` — the RLS-refusal, RLS-smoke, invariant, and walkthrough suites.

  The **visual layer**, where chat prototyping may inform the work, is:
  `steppe/components/**`, `steppe/app/(site)/**` (the marketing site and its
  generative-landscape components), `_design-source/*.html`, `docs/design/**`,
  `docs/library/*.html`, and `steppe/public/preview-app/**`.

  Payments are deliberately **not** on either list: on-platform payments are a
  documented non-goal of the prototype, so there is no payments code to bound.

### 2. The human review gate

Every unit of AI-assisted work passes the same gate, whatever tool drafted it:

- **A read-only audit pass before any write.** The agent reads the relevant files
  and reports findings for human confirmation before it is permitted to modify
  anything. Automation may surface, sort, and flag; a human decides — the same
  human-in-the-loop principle the platform enforces for verification, moderation,
  and governance outcomes.
- **One DCO-signed commit per logical unit**, with **explicit pathspecs** — never
  `git add -A`. The author reviews exactly what is staged.
- **Merge conditions, named as the real commands** (`steppe/package.json`,
  `.woodpecker/ci.yml`): `npm run lint` (ESLint), `npm run test` (Vitest), and
  `npm run build` (`next build`) must all be green. There is no separate typecheck
  script; the TypeScript typecheck runs **inside** `npm run build`, which
  `next.config.ts` does not configure to ignore build errors. Codeberg CI runs
  install → lint → test → build on every push and pull request.

On sign-off coverage: the DCO trailer is
the enforced convention — a per-clone `git commit -s` hook plus a CI gate on `main`
that fails any pushed non-merge commit lacking a real `Signed-off-by` **trailer**.
Historical coverage is **not** 100%: about **96.1%** of all commits and **98.1%** of
authored (non-merge) commits carry a sign-off trailer. The gaps are early
pre-convention history (including the initial commit) and the one documented
`b474598` case, where a sign-off was typed into the **subject line** instead of
applied as a trailer — the exact defect class the CI gate now prevents.
Forge-generated merge commits carry no sign-off by design and are excluded from the
gate; DCO certifies **authored** work.

### 3. Copyright and output-rights position

Steppe treats AI-assisted output as its own work product and licenses it, like all
other contributions, under **AGPL-3.0-or-later** — the same license inbound as
outbound, via the DCO rather than a contributor license agreement, so no separate
rights are assigned to anyone. The **DCO sign-off asserts the right to submit** the
contribution; the **signer takes responsibility for the content regardless of the
tool used to draft it.** The tool does not certify the code — the human who signs
off does.

The legal basis for treating model output as Steppe's to license this way rests on
Anthropic's commercial terms. Steppe's present understanding is that those terms
place ownership of output with the customer, but this record does **not** assert
that as verified fact; it is listed under Open / counsel items for confirmation.

### 4. Reciprocity — outbound copyleft, never weaker

Steppe ships outbound under AGPL-3.0-or-later. If any AI-assisted output is derived
from copyleft-licensed training data, it lands here under **equal or stronger**
reciprocity — a strong network-copyleft license — never weaker. That is the inverse
of license laundering: rather than using a model to strip copyleft obligations from
code and re-emit it as permissive or proprietary, the practice keeps whatever
reciprocity may attach and adds the AGPL's own.

### 5. Commit trailer convention — no AI attribution

Commits carry the DCO sign-off and nothing else; they do **not** carry
`Co-Authored-By` or any AI-attribution trailer (enforced by
`.claude/settings.json`). This is a choice, not an omission.

The DCO trailer records two things — the **right to submit** and **human
accountability** for the content. It does not record **tooling provenance**, and it
is not meant to. A per-commit AI-attribution trailer would imply a provenance
precision Steppe cannot honestly claim: work moves fluidly between human editing and
agent drafting within a single logical change, and a binary "AI touched this" tag on
each commit would assert a clean line that does not exist. Rather than stamp every
commit with a claim we cannot stand behind, Steppe makes the disclosure **once, at
the level where it is true** — this ADR.

### 6. Harmful-code safeguards

What actually guards against harmful or malicious code — and, as importantly, what
does not:

**Caught:**
- **Trust-logic violations** are caught in the database, not by convention. The core
  invariants — server-set trust, computed vote weight, secret ballots, verify-then-forget,
  the append-only record — are enforced by **RLS policies and triggers in
  `schema.sql`**. The append-only backstop (migration `0012`) binds **every** role,
  `service_role` and table owner included, so a delete of `audit_log`, `votes`,
  `moderation_actions`, or `consents` is refused at the database regardless of what
  application code asks. RLS is an **enforced invariant**, not a reviewer's habit.
- **The human review gate** (Decision 2) — a person audits and signs off; the tool
  cannot merge itself.
- **Lint, type, and build breakage** — Codeberg CI (`npm run lint`, `npm run build`).
- **Provenance integrity** — the CI DCO-signoff gate and the mirror-provenance check
  on `main` (which fails the pipeline if the GitHub deploy mirror does not converge
  with canonical Codeberg `main`).
- **Invariant regressions** — the Vitest suites, including RLS-refusal and positive
  walkthrough tests, run against a local prod-shaped database.

**Not caught:**
- **CI does not run the database-backed RLS suites.** Supabase secrets are
  intentionally withheld from the CI `test` step, so the impersonated RLS-refusal
  and anon-key suites **self-skip** there; only the hermetic route suite runs in CI.
  The database-backed proof is a **local / manual** assurance, the same discipline
  as the migration dry-run matrices — real, but not continuous.
- **No automated dependency or supply-chain scanning** is currently wired into CI.
  `npm ci` against a committed lockfile gives reproducible, version-pinned installs,
  but there is no CVE-audit or provenance step on dependencies today.
- **Static checks catch shape, not meaning.** Lint and the typecheck catch syntax,
  types, and style — not a subtle logic error or a semantic security flaw. The human
  review gate is the only thing that catches those, and it is exactly as strong as
  the attention the reviewer brings.

---

## Limits

This ADR does not claim more than the practice delivers.

- It does not claim AI-assisted code is free of defects, only that it passes the same
  gate as any other contribution and that a named human is accountable for it.
- It does not claim the review gate catches semantic bugs or security flaws
  automatically; that work is human and fallible.
- It does not claim continuous enforcement of the database-backed invariants — those
  are proven locally, not in CI (above).
- It does not claim 100% DCO coverage; the figures and their gaps are in
  Decision 2.
- It does not settle the output-rights legal question on which the copyright posture
  depends (below).

The residual risk: an AI-drafted change that is syntactically
clean, type-correct, lint-clean, and does not trip an existing test can still carry a
logic or security defect, and would rest entirely on human review to catch. The
safeguards narrow that surface; they do not eliminate it.

---

## Governance status

This is a **founder-era decision**, made while Steppe is still pre-launch and
maintained by one person. **How Steppe uses AI is a member-governable matter** — it
touches the platform's trust proposition directly. This ADR should be **ratified,
amended, or replaced by member vote** once governance is live, through the same
proposal-and-vote process the platform runs for any other consequential decision.
Until then it is the working policy, documented so
that the members who inherit it can see exactly what they are ratifying.

---

## Open / counsel items

- **Output-rights basis (the load-bearing one).** Steppe's posture in Decision 3 —
  treating AI-assisted output as its own to license under AGPL-3.0-or-later — relies
  on Steppe's present understanding of **Anthropic's commercial terms** as placing
  ownership of output with the customer. This has **not** been independently verified
  in the making of this record and is **pending counsel confirmation**. It sits
  alongside the project's other counsel-pending items (the Terms & Privacy draft
  awaiting Oregon legal review; the placeholder copyright holder in `NOTICE` pending
  nonprofit incorporation). Counsel should confirm the terms actually in force before
  this ADR's copyright chain is treated as settled.
- **Reciprocity in practice.** Decision 4 states the posture; if a specific inbound
  provenance question ever arises, it should be brought to counsel with this record
  as the framing, not a substitute.

---

## Changelog

- **v1.0 (2026-07-25)** — Initial adoption. Documents the Claude Code / Claude chat
  boundary and the auditable-core rule; the human review gate and named merge
  conditions; the AGPL-3.0-or-later output posture with the Anthropic-terms reliance
  moved to counsel-pending; the reciprocity and no-AI-attribution-trailer
  conventions; and the harmful-code safeguards with an account of what CI does
  and does not catch. Founder-era; ratifiable by member vote once governance is live.
