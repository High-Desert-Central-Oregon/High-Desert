# Message deletion and retention resolution

| | |
|---|---|
| **Resolved** | 29 August 2026 |
| **Authority for beta** | Founding Executive Director privacy/product decision |
| **Status** | Implemented by migration 0034 and the public/legal copy in this change |
| **Supersedes** | `DECISIONS.md` M-G2 (13 July 2026), solely as to retaining a departing member’s message bodies |

## Decision

Steppe has no business need to retain a member’s sent messages after that member deletes their account. Account deletion therefore deletes every message authored by the departing member. A conversation thread is deleted when no messages remain in it; messages authored by the other participant remain that participant’s content.

Steppe makes no fixed time-window promise for active accounts. Messages remain available to their participants until the sender deletes their account or Steppe must preserve a specific record under a valid legal hold. The product has no operator or moderator message reader, no client-side message-delete grant, and no message metadata in the transparency log.

A participant may voluntarily disclose a quoted excerpt in a safety report. That report is separate member-initiated safety intake and may outlive deletion of the source conversation until the report is resolved or the reporter deletes their own account. Public and legal copy must state this exception rather than promising that no copy can ever remain.

## Records that remain on account deletion

Steppe preserves only records whose integrity would be damaged by deleting one participant:

- accepted terms/privacy versions;
- secret ballots needed to keep a closed aggregate tally accurate;
- moderation actions, resolved appeals, and the append-only audit record; and
- content another participant authored.

Those records remain attached to a scrubbed `Former member` profile tombstone after the authentication identity and ordinary account data are removed. They are not a license to retain direct messages.

## Why this resolution

The previous M-G2 rule treated a conversation like email and preserved the counterpart’s copy. That was technically coherent but conflicted with the public promise that account deletion meaningfully erases the departing member’s content. Steppe does not need the bodies for ranking, advertising, analytics, or moderation scanning. Deleting the sender’s words is therefore the smaller and more defensible data footprint.

This decision does not create a new recurring retention schedule. Avoiding an unnecessary copy is the control; Steppe will add timed expiry only if the product can reliably execute and verify it before making such a promise.
