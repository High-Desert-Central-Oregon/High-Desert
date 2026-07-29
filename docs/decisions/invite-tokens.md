# Invite tokens

**Status:** Accepted
**Date:** 2026-07-29
**Version:** 1.0
**Author:** Greg Chism, Founding Executive Director

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-29 | Initial record. Bearer-with-cap tokens, redemption as an allowlist writer, invite-graph placement and retention, admin-minted now. |

---

## Context

Account creation is invite-only. Migration 0024 built that as two layers: the sign-in
action reads `invited_emails` before it will send a one-time code, and
`enforce_invited_signup()` refuses any insert into `auth.users` whose email is not on
that list. The second layer is the guarantee, because it holds even if someone calls
GoTrue directly with the public key. The first is the clean path.

What 0024 did not build is a way to put an email on the list. A read-only audit of the
tree and the production database on 2026-07-29 found exactly one reference to
`invited_emails` in application code, and it is the read in
`steppe/app/auth/login/actions.ts`. There is no write path. A moderator technically
could write through the `invited_manage` RLS policy, but nothing in the interface ever
does.

So every invitation today is a hand-written SQL statement, typed into the Supabase
editor by one person. That is the bottleneck this record addresses. It is not slow
because the database is slow; it is slow because inviting fifty neighbors means fifty
statements, and because the only person who can issue them is the only person who has
the SQL editor open.

---

## Decision

### 1. Bearer tokens with a use cap, not single-use tokens

A token is a high-entropy string with a `max_uses` count, an expiry, and an optional
label. Anyone holding it can redeem it against their own email address until the cap is
reached or the expiry passes.

Single-use tokens would fix the interface and leave the bottleneck. Inviting fifty
people would still be fifty mint actions, fifty distinct strings, and fifty deliveries —
the same per-person work, moved from SQL to a form. The cap is what changes the shape of
the work: one mint action covers a cohort, and the founder's effort becomes one action
per group rather than one per person.

The cap is also the bound on what a leaked token costs. A bearer token with no cap is a
hole in the gate. A bearer token capped at twenty-five admits at most twenty-five
people, and the number is chosen at mint time by the person who knows the room. Single-
use has a blast radius of one and a workload of *n*; uncapped bearer has a workload of
one and an unbounded radius. The cap is the dial between them, and it is set per token.

Bearer-with-cap also matches how Steppe actually reaches people. Invitations travel on
printed cards, a code read aloud at a table, a link a neighbor forwards. A single-use
token cannot be printed on a card that twenty-five people pick up.

### 2. Redemption writes to the allowlist; the gate is untouched

`redeem_invite()` validates a token and inserts the email into `invited_emails`. It does
not create an account, and it does not sign anyone in. After it returns, the email is on
the list, and the existing sign-in path works unchanged.

The alternative would be to teach `enforce_invited_signup()` about tokens — to have it
admit an email that is either allowlisted *or* holds a valid token. That is rejected,
and it is the central decision in this record.

The trigger's predicate today is one sentence: is this email on the list. It reads one
table. Teaching it about tokens would make it read three, and would move token validity —
cap arithmetic, expiry, revocation — inside the thing that guards account creation.
Every later change to how tokens work would then be a change to the gate. The gate would
acquire a second way to say yes, and the two would have to agree forever.

Making redemption a *writer to the list the gate already checks* keeps the predicate at
one sentence. The token subsystem can be wrong, revoked, redesigned, or deleted outright,
and the guarantee is unchanged: no account exists for an email that is not on the list.
That is dual-layer preservation, and it is why redemption is a writer rather than a
second gate.

**Regression criterion.** `enforce_invited_signup()` must come out of this build
byte-identical to how it went in. The baseline, captured from production on 2026-07-29:

```
sha256(pg_get_functiondef('public.enforce_invited_signup'::regproc))
  = 8f2f632e92d2eab9900fd11b9a0bd9156c2f867bedff33d211f322086366532e
```

If that hash changes, the build has failed regardless of what else works. The regression
that matters most is not that a valid token admits someone — it is that an email which
never passed through a token still cannot create an account.

### 3. Where the invite graph lives, and where it does not

Who invited whom is answerable inside the invite subsystem and nowhere else. It comes
from three columns that already exist or arrive with this build:

- `invited_emails.invited_by` — present since 0024, for rows added by hand.
- `invite_tokens.created_by` — who minted the token.
- `invite_redemptions` — which email redeemed which token, and when.

Joining redemptions to tokens gives the edge: this email got in through a token minted by
that person. The graph is derived, not stored.

**There is no `profiles.invited_by`.** A column on the member record would make the edge
permanent and co-extensive with membership, and it would survive every purge of the
invite subsystem because it would not be part of it. The member record is the thing that
has to outlive the invite machinery. Putting a social graph on it means the graph
outlives its purpose.

Keeping the edge inside the subsystem makes it prunable as a unit. Deleting the invite
records is one operation with one boundary, and afterwards the question "who invited this
member" has no answer anywhere in the system. That is the correct end state once an
invitation has done its work.

Visibility is moderators only, through the same `is_moderator()` predicate that already
gates the allowlist. Members do not see it, and an invitee is not shown who invited them.
Whether a minter can see redemptions of their own token is deferred to the member-minting
decision (§5), because it only becomes a real question when the minter is not also a
moderator.

**Members can change this.** Retention of the invite graph is a member-governable
setting, not a founder-permanent one. The route is the ordinary one: a proposal at
`/protected/governance`, a tenure-weighted vote, a result read from `proposal_results`,
and the resulting value recorded in the Schedule of Defaults
(`docs/governance/Steppe-Schedule-of-Defaults-v0.1.md`) — the amendable layer the Trust &
Safety record already names for settings of this kind. Nothing in the schema depends on
the current horizon being the permanent one.

**This is not verify-then-forget, and should not be described as though it were.**
That doctrine covers verification *evidence*: the document proving residency, deleted
the moment a human decides, leaving only the `verified` flag, the date, and the method.
It is a rule about identity evidence, and its promise is immediacy. The invite graph is
a record of a social act, and it is held on a clock. Calling both by the same name would
either over-claim here — implying the graph vanishes on a decision, which it does not —
or weaken the verification promise by letting "forget" come to mean "eventually". Two
rules, named separately, kept separate.

### 4. Who may write what

Minting and revoking happen under RLS, as the moderator, through the ordinary
authenticated client. The `invited_manage` policy already grants moderators full DML on
`invited_emails`, and `invite_tokens` gets the same treatment. No service-role client is
involved in minting, so the mint path is subject to the same row-level rules as every
other moderator action and is legible in the same way.

`created_by` is taken from `auth.uid()` inside the database, never from the request. A
client cannot mint a token attributed to someone else, because it never supplies the
attribution.

Service-role is confined to `redeem_invite()`. It has to be: the person redeeming is
anonymous and has no session, so the write cannot be authorised as them. That function is
therefore the whole of the privileged surface — one function, one job, granted to
`service_role` alone, with `EXECUTE` revoked from `PUBLIC` first. It is reachable only
through the route handler that holds the secret key, which is what makes the rate limit
on that route real rather than advisory.

### 5. Admin-minted now; member-minted later, as a policy flip

Only moderators mint tokens in this build. Member-minted invitations are the obvious next
step and are deliberately not built yet. Two things must exist first.

**A revocation cascade.** Revoking a token today stops future redemptions and does
nothing about allowlist rows already written by past ones. For a handful of tokens minted
by one trusted person that is acceptable, because cleanup is a person noticing and acting.
For member-minted tokens it is not: revocation has to be able to reach what a token
produced — the allowlist rows, and a decision about accounts already created from them.
That is a design, not a flag.

**An abuse-response path.** A member who mints into a hostile channel needs a response
that is not "remove the member". That means limits on how often and how large a member
may mint, a moderator view of who minted what, and a way to suspend one member's minting
without touching their membership.

The schema is shaped so that the change, when it comes, is a policy change. `created_by`
references any `auth.users` row rather than encoding "the founder". The mint path is
RLS-gated, so widening it means changing a predicate from `is_moderator()` to whatever the
members decide. `max_uses` already bounds each token. None of that is a rebuild.

### 6. Expiry and purge

Every token carries `expires_at`, set at mint. No token is open-ended, and a token that
is never redeemed stops being redeemable without anyone acting.

Redemption records hold an email address, which puts them in the same class as pledge
records: pre-member contact data held in the hope of a conversion that may never come.
They inherit the same bound. **A redemption record is purged 180 days after redemption**,
matching the stalled-campaign rule in
`docs/decisions/neighborhood-pledge-campaigns.md`. The reasoning carries over unchanged:
contact that has sat unconverted for six months is not a live invitation, and holding it
longer serves the record rather than the person.

An allowlist row created by a redemption, where no account exists 180 days later, is
pruned alongside it. Rows added by hand — the founder's original cohort roster — are not
on that clock, because they were not created by this subsystem and their lifetime is a
separate question. The join to `invite_redemptions` is what tells the two apart.

Expired and revoked tokens are purged once no live redemption record refers to them.

As with `close_stale_pledge_campaigns()`, the purge is a function invoked deliberately
rather than scheduled. The reason is the same: the delete is half the obligation and
telling the person is the other half, SQL can only do the first, and a scheduled
delete-without-notice is worse than not running it. Whether an expiring unused invitation
warrants a notice is an open item below.

---

## Known deviation, recorded and not fixed here

`enforce_invited_signup()` carries `SET search_path TO 'public'` — the pattern used by
every SECURITY DEFINER function predating migration 0026. 0026 established
`public, pg_temp` as the standard, which prevents a temporary table shadowing a real one
inside a definer body.

This build does not change it. Byte-identity of that function is the regression criterion
in §2, and altering its `search_path` would break that check while folding an unrelated
hardening into a build whose entire claim is that the gate was not touched. The two
changes want separate commits and separate verification.

Follow-up: a sweep pinning `public, pg_temp` on every SECURITY DEFINER function created
before 0026 — around forty-four functions, of which this is one. It should be its own
migration, with the hash of each affected body recorded before and after.

---

## Consequences

Accepted costs:

- A bearer token is a secret that admits more than one person. Anyone holding it can
  redeem it, and Steppe cannot tell an intended recipient from someone who was forwarded
  the link. The cap and the expiry bound that; they do not eliminate it.
- Redemption records hold an email address for up to 180 days. That is a retention
  obligation the platform otherwise works to avoid, taken on knowingly, bounded, and
  described here rather than discovered later.
- Admin-only minting means the founder is still the bottleneck for *deciding* who is
  invited, even though the per-invite work is gone. Member-minting is what removes that,
  and it is deferred.

Gained:

- Inviting a cohort is one action instead of *n* SQL statements, and it stops requiring
  database access.
- The gate's guarantee is unchanged and is now covered by a hash rather than by
  inspection.
- The invite graph has a boundary, so it can be deleted without touching member records.

---

## Open / counsel items

- **Notice on expiry.** Whether a person whose unused invitation is pruned at 180 days
  should be told. The pledge-campaign purge has the same unresolved half.
- **Minter visibility after member-minting.** Whether a member who mints a token may see
  who redeemed it, which is a social-graph exposure question rather than a technical one.

---

## Revisiting

This record is revisited when member-minting is proposed, or when the first cohort has
been invited through tokens and the cap sizes have met reality — whichever comes first.
The cap defaults and the 180-day horizon are current practice and are expected to move.

The rule that redemption writes to the allowlist rather than the gate learning about
tokens is not a tuning parameter. Changing it would remove the property the invite system
exists to preserve, and should be treated as a change to the trust model, not to a
setting.
