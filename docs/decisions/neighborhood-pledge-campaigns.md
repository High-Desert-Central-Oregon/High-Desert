# Neighborhood pledge campaigns

**Status:** Accepted
**Date:** 2026-07-25
**Version:** 1.0
**Author:** Greg Chism, Founding Executive Director

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-25 | Initial record. Mechanic, thresholds, data handling, schema. |

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
