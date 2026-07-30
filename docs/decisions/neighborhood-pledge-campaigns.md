# Neighborhood pledge campaigns

**Status:** Accepted
**Date:** 2026-07-25
**Version:** 1.1
**Author:** Greg Chism, Founding Executive Director

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-25 | Initial record. Mechanic, thresholds, data handling, schema. |
| 1.1 | 2026-07-30 | § Abuse expanded after an audit of the live endpoint. Records why the pledge endpoint cannot be made trustworthy and why the control is human judgment at the opening; what the founder reads; the two deliberately different rate-limit keys and their shared bound; the rejected options; and founder-notification-at-threshold as deferred. Adds no gate — 0026 already built it this way. |

---

## Context

Steppe is a network good. The first member in a neighborhood receives nothing of value from membership, because there is no one there yet. Recruiting members one at a time therefore produces churn rather than density, and each departure costs more than the signup was worth.

A second problem compounds the first. Awareness captured through physical channels — mail, signage, print — decays quickly. Between the moment someone becomes interested and the moment the neighborhood is populated enough to be worth joining, there was previously nothing for that interest to attach to.

Steppe also asks for more than a free platform does at the point of conversion: address verification and $4/month. Asking for both before the neighborhood has any content is asking someone to pay to enter an empty room.

## Decision

Steppe opens in a neighborhood only when a threshold number of households have pledged. Until that threshold is reached:

- No address verification is performed.
- No payment is collected and no payment method is stored.
- No account exists.

A pledge is an email address and nothing else. When the threshold is reached, everyone who pledged is notified at once and the neighborhood begins with a populated membership rather than a single member.

The current count and the threshold are public on the neighborhood's page at `/n/[slug]`, and are reproduced on printed materials for that neighborhood.

## Thresholds

| Neighborhood size | Threshold |
|---|---|
| 150 or more doors | 35 |
| Under 150 doors | 20 |

These numbers are deliberately low. A neighborhood that opens at 20 and grows is worth more than one that never reaches 35. Thresholds may be lowered mid-campaign at the Executive Director's discretion; doing so is expected behavior and is not treated as a failure. Thresholds are not raised mid-campaign, because that would move the goal for people who have already pledged in reliance on it.

Because the smaller threshold is 20, a single cluster mailbox unit (typically 12 to 16 doors) is not a viable campaign unit. The subdivision is the unit. This aligns with USPS carrier route geography, which is already approximately subdivision-scale.

## Why the count is public

The count is the mechanism, not a marketing device.

It gives a pledger a reason to return, which is what prevents captured interest from going stale. It makes each pledger's outcome depend on their neighbors, which converts a passive signup into an active recruiter. And it allows printed materials to carry a number that changes, so signage remains worth a second look rather than becoming wallpaper.

It also functions as an honest signal. A neighborhood that sits at 6 of 20 for two months is telling Steppe something true about demand there, in public, where it cannot be quietly ignored.

## Data handling

A pledge record contains a neighborhood reference, a normalized email address, a removal token, and a timestamp. It contains no name, no street address, no payment information, and no identity evidence.

Constraints:

- The `pledges` table is never readable by any client under any policy. Counts are exposed only through a `SECURITY DEFINER` function returning an aggregate, which cannot surface a row, an identifier, or a timestamp.
- Removal is a hard delete via token, not a flag. Consistent with Steppe's verify-then-forget posture, when someone leaves, nothing is retained.
- Pledge addresses are never sold, shared, or used for any purpose other than notifying that person about the neighborhood they pledged to.

**Known departure from existing posture, stated plainly.** Steppe's verification policy deletes identity evidence immediately after checking it, retaining only a flag. Pledge records are different: an email address is held until the neighborhood reaches threshold, which may be months, or never. This is a real retention obligation that the rest of the system deliberately avoids.

It is bounded as follows: **if a neighborhood has not reached its threshold within 180 days of its first pledge, all pledge records for that neighborhood are deleted and pledgers are notified that the campaign closed.** A campaign may be restarted, but it starts from zero. Interest that has sat unconverted for six months is not interest, and holding it indefinitely to inflate a number would be dishonest.

## Abuse

The count is public and appears on printed materials, which makes it a target for inflation. A unique constraint on `(neighborhood, email)` and a per-IP rate limit handle casual noise. Neither stops a determined actor.

Steppe deliberately does not add CAPTCHA, email confirmation loops, or address verification at the pledge stage. At Steppe's current scale these suppress genuine conversions substantially more than they suppress abuse, and address verification at pledge time would defeat the purpose of the mechanic. An administrative view of pledge timestamps by neighborhood makes anomalies visible after the fact, which is the appropriate level of defense for a number whose only consequence is when an email is sent.

If a count is found to have been inflated, the correct remedy is to correct it publicly and say so.

### The endpoint is anonymous by design and cannot be made trustworthy

*Added in 1.1, after auditing the live endpoint. This records reasoning; it adds no gate.*

`/api/pledge` accepts a submission from anyone, with no account, no session, and no proof of anything. That is not a gap in the implementation — it is the mechanic. The promise on every yard sign is that nobody verifies or pays before a neighborhood opens, so a pledge is one email address and one click. **Any control that made a pledge trustworthy would destroy the thing it protected**: an address you must prove, confirm, or authenticate is no longer a pledge that a stranger makes on a sidewalk in fifteen seconds, and the count would stop measuring interest and start measuring persistence.

So the count cannot be trusted at the door, and Steppe does not pretend otherwise. **The control is human judgment at the opening, not authentication at the door.**

The system was already built this way, and the amendment is only writing down why. Migration 0026 assigns `neighborhoods.opened_at` from **no function and no trigger** — verified across the whole catalog, not assumed — and `neighborhood_status()` computes `is_open` as `opened_at is not null`, never as `pledge_count >= threshold`. 0026's own comment states the principle: *crossing the threshold is arithmetic; opening a neighborhood is work a person does.* An inflated count therefore buys an attacker a number on a page. It does not open a neighborhood, does not create an account, does not send anything to anyone, and does not commit Steppe to anything — because a person still has to read the evidence and type the statement.

This is what makes an unauthenticated endpoint an acceptable design rather than a deferred problem: **the consequence is gated on a human, so the input does not have to be gated on a credential.**

### What the founder reads at the opening

Two things the count itself cannot show, both from `docs/ops/campaign-review.md`:

- **Address plausibility** — the pledged addresses, read as a list. Eight throwaway addresses on one domain read differently from a spread of ordinary providers, and no rule needs to define that for a person looking at it.
- **Arrival pace** — the distribution over time from `pledges.created_at`. Per-day buckets show whether a neighborhood filled over days; the per-address gap since the previous arrival shows whether a day's worth landed in forty seconds. Both are needed: span alone is fooled by a burst with one late straggler, and daily buckets alone cannot see inside a day. That was demonstrated against seeded fixtures rather than reasoned about.

Neither is a test with a threshold, and neither should become one. A door-knock afternoon produces short gaps; a patient adversary produces long ones. The read makes the evidence legible and the judgment stays a person's.

### Rate limiting: two keys, deliberately different

Both public endpoints use the same in-memory limiter, keyed differently on purpose:

| Endpoint | Key | Why |
|---|---|---|
| `/api/invite/redeem` | **IP alone** | A token is an enumerable secret. Keying per token would hand an enumerator a fresh budget for every guess, so the allowance would scale with the number of wrong answers tried. |
| `/api/pledge` | **(IP, slug)** | A slug is printed on mail and yard signs — not a secret, and not worth enumerating. Keying per connection alone would let a household pledging to one neighborhood spend the allowance for another, and two or three people in one house pledging is the good case, not the abuse case. |

The difference is the point: the key should name whatever the abuse is scarce in.

**Shared known bound.** The limiter is a `Map` in module scope. On Fluid Compute that is **per-lambda-instance**, not global: it resets on every cold start and concurrent instances each hold their own count, so the effective production ceiling is some multiple of the configured limit and **is not a number the platform can state**. It handles casual noise, a double-tapped submit, and a naive script from one address. It does not stop a determined actor with many IPs and does not pretend to. **No IP address is persisted** — the first hop of `X-Forwarded-For` is a key in memory, never written, never logged, never associated with an address. A limiter that stored addresses to enforce itself would build the behavioural record this platform exists not to keep (CLAUDE.md invariant 8).

### Rejected, and why

- **CAPTCHA.** A third-party beacon on the most public page Steppe has, loaded before a stranger has agreed to anything. That is precisely the no-trackers commitment (invariant 8), and it would be broken on the surface printed on public signage. Rejected on the invariant, not on effectiveness.
- **Confirm-your-pledge email.** It puts friction on the one step that must stay frictionless, and it double-books the promise: the deal is that Steppe contacts you *when the neighborhood opens*, not that Steppe emails you now to ask whether you meant it. It would also convert a fifteen-second sidewalk action into a two-device errand, which is where real pledgers are lost.
- **Per-neighborhood caps.** A cap on pledges caps *real success*. The failure mode of the whole mechanic is a neighborhood that never fills; a control whose worst case is refusing genuine neighbors at the moment a campaign is working is the wrong instrument.
- **Disposable-domain rejection.** Redundant against a list a human already reads — throwaway addresses are conspicuous in the roster, which is the surface where the decision is actually made. And a blocklist is a rule that fails toward rejecting a real neighbor who happens to use an unusual provider, which is strictly worse than showing that address to a reviewer who can judge it. It is also trivially bypassed, so it would add a maintenance burden and a false sense of a control.

### Deferred, not rejected: founder notification at threshold

Nothing tells the founder that a campaign reached its threshold; it is noticed by running the review read. That is adequate **while one campaign is running at a time**, which is the current state.

**The condition that justifies building it: more than one campaign running concurrently.** At that point "notice it by looking" becomes "remember to look at several things", and a neighborhood sitting at threshold for two weeks because nobody checked is a real cost — the count is public and stale-at-threshold is visible to the people waiting.

When it is built it takes the shape of `close_stale_pledge_campaigns()`: a function invoked deliberately that returns what it found, not a cron job. The reason is the same one that keeps opening manual — a scheduled notification is one step from a scheduled opening, and the whole point is that a person stands between the arithmetic and the act. Tracked in `docs/ops/deferred-hardening.md`.

## Schema

The pledge campaign extends the existing `neighborhoods` table rather than introducing a parallel one. Two nullable columns are added: `threshold` and `opened_at`.

A null `threshold` means the neighborhood is not running a campaign and has no public `/n/` page. `neighborhood_status` returns null for these, and the route returns 404. Steppe does not publish a browsable directory of neighborhoods it has no presence in.

The alternative — a separate `pledge_neighborhoods` table — was rejected because it creates a second slug namespace. Slugs are printed on mail, yard signs, and door hangers, and a printed URL cannot be changed. A single namespace means the URL is stable across the threshold event, and a pledger converting to a member is a join against the same row rather than a reconciliation between two tables.

## Consequences

Accepted costs:

- A neighborhood that never reaches threshold leaves its pledgers with nothing. This is mitigated by an honest follow-up that says so directly rather than by repeated encouragement, by the willingness to lower thresholds, and by the 180-day close.
- Public counts create public failure. A stalled neighborhood is visible to everyone including funders. This is accepted as the cost of the count being credible when it moves.
- The 180-day purge means Steppe will sometimes delete contact information for people who would eventually have joined.

Gained:

- Members arrive in populated neighborhoods, which is the only condition under which the product is worth its price.
- Physical channels acquire a reason to be refreshed rather than replaced.
- Demand is measured before spend, per neighborhood, rather than inferred.

## Revisiting

This record is revisited when the first three campaigns close or reach threshold, whichever comes first. Threshold values in particular are expected to change and are recorded here as current practice rather than as a commitment to members.

The threshold mechanic itself — that no one verifies or pays before a neighborhood opens — is a commitment to members and is not changed without notice.
