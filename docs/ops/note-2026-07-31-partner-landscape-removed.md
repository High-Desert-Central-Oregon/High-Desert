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

## Still open, deliberately

The conflict-of-interest register and the assembled counsel packet are **not** touched here. The
register contains third-party personal data — a named director, and relationship, spouse, family
and financial-interest fields — which makes it a decision involving someone other than the
author, not a repository-hygiene call. Handling it is pending, separately, and should include
whether the person named is told.
