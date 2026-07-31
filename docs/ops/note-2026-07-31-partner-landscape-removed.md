# Note — the partner landscape was removed from HEAD, and remains published

**Date:** 2026-07-31
**Scope:** `docs/funding/sponsors-programmatic-partners-landscape.md`
**This is a note, not an incident record.** No system misbehaved; a judgment about what belongs
in a public repository was made late rather than early.

## What was removed

`docs/funding/sponsors-programmatic-partners-landscape.md` — 26 KB, introduced in `9a05cdb`
(2026-07-10). It is a named landscape of candidate fiscal sponsors and programmatic partners in
Central Oregon, containing a *"Strengths & Weaknesses"* assessment of each named organization, a
researched first-choice sponsor and backup, and a prioritized order in which to approach them.

It falls squarely in the fourth category of `CLAUDE.md` → *Do NOT publish*: **non-public funder or
partner posture, including any assessment of an organization Steppe intends to approach.** A
candid internal read of a named local nonprofit is fair to write and corrosive to publish. The
organizations named did not consent to being evaluated in the open, and several of them are
parties Steppe still intends to approach.

## What the removal does not do

**It does not unpublish anything.** The file is in the history of the Codeberg canonical
repository and the GitHub mirror, both public, from 2026-07-10 until today. It is in every clone
and fork taken in that window, and in any mirror or archive that crawled either forge. Anyone who
wants it can still retrieve it with `git log --all -- <path>`.

Removing it from HEAD is worth doing anyway — it stops the file being *found* by anyone browsing
the repository, which is how it would realistically be encountered — but the honest description
is that it reduces discoverability, not exposure.

## A history rewrite was considered and declined

Rewriting history (`filter-repo`, or a squash of the affected range) would have removed the blob
from the canonical repository. It was rejected for two reasons, in this order:

1. **It would not achieve unpublication.** The mirror, the clones, and any fork or archive taken
   since 2026-07-10 are outside the canonical repository's reach. A rewrite makes the canonical
   copy tidy while the content stays retrievable — which is worse than the current state, because
   it *looks* remediated.
2. **It would invalidate every SHA this repository cites about itself.** `docs/migrations-applied.md`
   records introducing commits for migrations 0012–0029; migration headers cite applied-file
   SHA-256 values and the commits that introduced them; ADRs cite commits by hash; and the
   incident record of 2026-07-30 reconstructs a timeline from specific SHAs on two forges. A
   rewrite would turn all of that into dangling references, destroying the audit trail that is
   the point of keeping those records — in exchange for a tidiness that does not deliver the
   thing it appears to deliver.

The trade was: keep an accurate, verifiable history that includes a file we would not publish
today, or get a cosmetically clean history that breaks every provenance claim the project makes
about itself and still leaves the content readable. The first is better.

## What actually reduces recurrence

`CLAUDE.md` → *Do NOT publish*, and the correction to `docs/governance/README.md` that previously
instructed the opposite. Neither is retroactive. Both are the control that would have prevented
this, applied at the only point where it works — before the commit.

## `counsel-packet/` was removed too — why drafts specifically

*Added 2026-07-31, same branch.*

The whole of `counsel-packet/` (19 tracked files: charter and bylaws, consent/membership
agreement, Schedule of Defaults, operating budget, COI register, the rendered Terms and Privacy
surfaces, and the assembled 415 KB PDF) has been removed from HEAD on the same reasoning, plus
one specific to it.

**These are pre-counsel DRAFTS of governing instruments.** Publishing a draft does not serve
transparency — it degrades it. A reader encountering `05-governance-charter-and-bylaws.md` in a
public repository has no way to tell, from the document, that it has not been through Oregon
counsel, has not been ratified by the founding cohort, and is not what governs Steppe. They will
reasonably take it for *the* governance. Every later divergence between the draft and the adopted
instrument then reads as a change of position rather than as the ordinary difference between a
draft and a decision.

That is worse than publishing nothing, because it manufactures a false record that is hard to
correct — the draft is already indexed, quoted, and forked by the time the real instrument exists.

**Publication becomes an affirmative act, not a default.** The rule going forward, recorded in
`CLAUDE.md` → *Do NOT publish*: ratified governance documents **may** be published deliberately,
once counsel has reviewed them and the cohort has adopted them, and publishing them then is a
positive good — a member-governed organization should show its members what governs them. Drafts
are never published by default, and reaching that state is what earns publication.

**And, again: removal from HEAD does not unpublish.** All 19 files were public on Codeberg
canonical and the GitHub mirror from 2026-07-08 onward, and remain in the history of both, in
every clone and fork taken since, and inside the assembled PDF. The same rewrite reasoning above
applies unchanged.

Every file was verified byte-identical in `~/dev/steppe-private/` before removal — all 19 were
**absent** there beforehand (the private `counsel-packet/` held five different files, the
complement rather than a backup), so they were copied out and hash-checked first.

## The COI register — reviewed and RETAINED

*Updated 2026-07-31, superseding the paragraph previously in this section.*

`docs/governance/steppe-coi-register-v2.md` and its dated PDF are **tracked, present, and staying
that way.** An earlier pass of this cleanup removed them from HEAD and prepared a history
rewrite. Both are **cancelled**; the removal has been reverted and the files restored
byte-identical.

**Why the reversal.** The register records **public facts about people who have agreed to public
association with Steppe** in the ways it describes. It is not third-party personal data published
without consent. And a conflict-of-interest register that nobody can read discloses nothing —
publication is what makes a disclosure log a disclosure. **The categorical phrasing of the
original rule was the defect, not the file.**

The rule in `CLAUDE.md` now turns on **consent** and on **proportionality** — nothing beyond the
granularity the disclosure actually requires — rather than on the presence of governance data.
Note also the distinction the earlier pass blurred: a *draft governing instrument* stays out
because a reader cannot tell it from the ratified thing; a *disclosure log* is not a draft.

**A history rewrite was considered and declined**, on top of the reasons already recorded above
for the partner landscape:

- It would **invalidate every commit SHA this repository cites about itself** — the ledger's
  *Introduced by* column, ADR citations, migration headers, and the 2026-07-30 incident timeline.
  An audit of the tracked docs found **53 SHA references across 8 files**, of which **27 distinct
  commits** would have been renamed, because the earliest affected commit is `d0718f2`
  (2026-06-27) and a rewrite renames it and every descendant.
- It requires **forge-admin garbage collection on both sides** — Codeberg and the GitHub mirror —
  to drop the unreferenced objects. Without that the old commits stay fetchable by SHA on both
  hosts, so the rewrite would look complete while changing nothing about reachability.
- And it **still would not unpublish.** The content has been public since 2026-07-09.

**What was never at risk, and is worth stating so nobody re-derives it under pressure:** the
recorded **file SHA-256 values** (migration applied-file hashes) and the **`enforce_invited_signup`
gate hash** are *content* hashes — of file bytes and of `pg_get_functiondef()` output. They are
independent of commit identity and survive any rewrite untouched. Only *commit* SHAs were ever
in question.

