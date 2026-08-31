# Governance outcome resolution

| | |
|---|---|
| **Resolved** | 29 August 2026 |
| **Authority for beta** | Founding Executive Director product/operating decision |
| **Status** | Implemented by migration 0033; to be presented to the founding cohort and conformed to counsel-reviewed governing documents before binding corporate-member votes |
| **Supersedes** | The prior implementation gap in which ballots were tallied but quorum and passage were not calculated |

## Decision

Steppe will calculate one authoritative outcome for every closed proposal from a rule set fixed when the proposal is created.

| Proposal tier | Participation rule | Approval rule | Notice |
|---|---:|---:|---:|
| Ordinary (`minor`) | No percentage quorum; five-ballot privacy/binding floor | More than 50% of weighted decisive votes | Ordinary practice |
| Major (`major`) | 15% of eligible members, never fewer than five ballots | At least 60% of weighted decisive votes | Fixed published window |
| Foundational (`immutable`) | 15% of eligible members, never fewer than five ballots | At least 75% of weighted decisive votes | At least 30 days between publication and voting opening |

“Eligible members” means profiles that are verified and not deleted at the instant the proposal is created. That count, the applicable fractions, the privacy floor, and a rule-set version are stored with the proposal. Later membership or rule changes do not move an open proposal’s goalposts.

Abstentions count as participation for the participation rule. Approval is `yes / (yes + no)` using the tenure weights fixed on each ballot. An abstention is intentionally neither approval nor rejection, so it is excluded from that denominator.

The five-ballot rule serves two purposes during beta: it prevents a binding decision that the secret-ballot view cannot safely reveal, and it keeps the permanent audit record from exposing a small weighted breakdown. A proposal below its required participation is recorded as `insufficient_turnout`; otherwise it is `passed` or `failed`.

Closed outcomes and the complete governance/transparency record are readable only by verified, non-deleted members. An authenticated person who is still awaiting verification may read only audit rows they personally created, so their account export remains complete without opening the community record.

## Why this resolution

The Governance Charter draft already supplied the three decision tiers, 15% quorum, 60%/75% approval rules, tenure weighting, and 30-day foundational notice. The missing choices were the eligible-member snapshot, abstention treatment, low-turnout binding status, and which layer produces the official outcome. Without those choices, two people could read the same tally differently.

The database is the enforcement layer because it already owns ballot secrecy, tenure weight, voting windows, and the append-only close record. The interface reads the result; it does not recalculate or reinterpret it.

## Implementation and review

- Migration `0033_governance_outcomes.sql` snapshots rules and electorate, enforces foundational notice, evaluates outcomes, writes the same evaluation to the close audit entry, and enforces the verified-member read boundary on both result surfaces.
- Weighted choices remain hidden below five ballots and individual ballots remain unreadable to other members, moderators, administrators, and the public.
- The founding cohort may ratify or amend these defaults. A change applies prospectively through a new rule-set version; it does not rewrite closed results.
- Counsel should conform the final Charter/bylaws to Oregon written-ballot and quorum requirements before Steppe treats an app vote as a corporate-member action.
