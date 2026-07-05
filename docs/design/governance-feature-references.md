# Governance feature references — Schneider's toolbox, mapped to Steppe stages

**v1 · July 2026 · living document.** Companion to
`docs/steppe-governable-spaces-emergent-strategy-v1.md` (the doctrine scorecard)
and the staged roadmap. This maps the *Governable Spaces* tool ecosystem onto
Steppe's stages with one verdict each: what we adopt, what we mine for ideas,
what we pattern-match natively, and what we reject — with the rationale tied to
invariants so future evaluations don't relitigate. The standing evaluative
filter for every tool below (and every future one) is at the bottom.

| Tool | Verdict | Stage |
|---|---|---|
| CommunityRule | **ADOPT** | 1–2 |
| Decidim (module taxonomy) | **MINE** | ongoing |
| PolicyKit / Gateway | **PATTERN** | 3+ |
| Loomio | **UX REFERENCE** | 1–3 |
| Open Collective | **ASSESS-ONLY** | 2+ |
| Aragon · Zodiac · OpenZeppelin Governor · Snapshot · Tally | **REJECT** | — |
| Modpol | **REJECT as runtime** (research lineage only) | — |

## ADOPT — CommunityRule (Stage 1–2)

A governance-**legibility** and **replication** artifact, not a runtime: express
the Business Plan v12 governance rules (tenure weights 1×/1.5×/2×/3×, 15%
quorum, the ranked-choice buckets, 60%/75% thresholds) as a forkable
CommunityRule template. Two jobs: members see their own rules in a standard,
comparable format (feeds doctrine proposal P5, rules-as-visible-objects), and
communities that later inherit the stack get the governance layer in a form
built to be forked — replication-as-narrative made concrete. Nothing executes
from it; the DB remains the enforcement layer.

## MINE — Decidim's module taxonomy (study, never run)

Decidim itself is a Rails monolith with its own account model — running it would
fork identity away from the verified-residency substrate. But its **module
taxonomy is the field's best-tested feature menu** for a native governance
layer: assemblies, participatory budgeting, structured debates, initiatives,
petitions, citizen juries, delegative voting, crowdsourcing. Map: participatory
budgeting → the **Community Fund** (the founding cohort's first real vote);
initiatives/petitions → the expansion-by-petition rule already in canon; juries
→ a future restorative-moderation panel (doctrine P3). When a governance feature
is proposed, check Decidim's implementation of it first — for the interaction
design and the failure modes, then build native.

## PATTERN — PolicyKit / Metagov Gateway (Stage 3+)

The pattern worth taking: **declarative vote-threshold → automatic execution**
("if a proposal of kind X passes threshold Y, action Z fires"). Target:
Community Fund allocation — a passed allocation vote produces the disbursement
record without a human re-keying the result (the human decision *is* the vote;
invariant 5 is satisfied because automation executes a member decision, never
makes one). Build **natively in the auditable core, under DCO review**, reading
`proposal_results` and writing through `log_audit()` — never via a third-party
platform holding execution authority over member money.

## UX REFERENCE — Loomio (borrow the pattern, not the platform)

Loomio's facilitation affordances are the reference for the triage bridge and
governance screens: **preference ranking** (maps to the ranked-choice ballot
UI), proposal temperature-checks, and **implementation volunteering** ("who will
do this?" attached to a passed decision). Borrow interaction patterns only.
Cautionary tale from Schneider's own community: Social.coop runs its governance
across five platforms as a self-described "necessary hack" — the fragmentation
tax of adopting platforms instead of patterns. Steppe's governance stays in one
place, inside the membrane, by building the patterns natively.

## ASSESS-ONLY — Open Collective

For member-facing financial transparency (the open ledger the GTM promises),
**if and only if** Ignite Empowerment Foundation's sponsorship reporting plus
native transparency views don't already cover it. Assess at Stage 2+ when real
money flows; the bar it must clear is "meaningfully more legible than a
published ledger page we render ourselves." Note Open Collective Foundation
(the US fiscal-sponsor entity) dissolved in 2024 — the platform is the
assessment target, never the sponsorship.

## REJECT — the crypto-governance stack (Aragon, Zodiac, OpenZeppelin Governor, Snapshot, Tally)

Rejected on invariant grounds, recorded so it isn't relitigated tool-by-tool:
their governance primitive is **token-stake weighting** — influence follows
holdings, pseudonymous wallets, one-token-one-vote. Steppe's franchise is the
opposite by construction: **mandatory residency verification** (one verified
neighbor, one membership) and **tenure weighting ratified by members** — the
same locality-over-open-network grounds as the standing "a place, not an open
platform" posture (Spec v3). Retrofitting residency onto wallet identity buys
nothing the DB doesn't already enforce and imports a speculative-finance
idiom the charter exists to refuse. Also **Modpol**: honored as research lineage
(modular politics in practice, in Schneider's orbit), rejected as a runtime —
it's a Lua framework embedded in game worlds, not civic infrastructure.

## FRAMES — the lenses that govern all of the above

- **Exit to Community (E2C):** Steppe doesn't need the E2C playbook because it
  **is the endpoint E2C aims at, by construction** — community-owned from
  incorporation, nothing to exit from. The frame's use here is narrative: it
  names precisely what was skipped.
- **Illich's conviviality** is the standing evaluative filter for every tool on
  this page and every future candidate: does it enlarge members' capacity to
  act and understand, or does it make them dependent on operators of an opaque
  system? A governance tool that members can't read fails the filter even if
  its features are perfect.

**Changelog**
- v1 (2026-07-05) — initial mapping, decided as recorded above.
