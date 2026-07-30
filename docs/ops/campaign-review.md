# Campaign review — the read before opening a neighborhood

Opening a neighborhood is a **human act**. Nothing in the database performs it: no function
assigns `neighborhoods.opened_at`, no trigger transitions a campaign, and `submit_pledge()`
writes one row to `pledges` and nothing else. Crossing the threshold is arithmetic; opening
a neighborhood is work a person does (migration 0026).

This file is the read that person does first. Run it in the Supabase SQL editor, as owner,
before setting `opened_at`. It answers two questions the count alone cannot:

- **Are these plausible neighbors?** — the addresses.
- **Did they arrive like a neighborhood or like a script?** — the arrival distribution.

> ## This is a documented query, deliberately not a function
>
> An earlier framing called for a `pledge_activity`-shaped function granted to
> `service_role`. It should not be one, for two reasons.
>
> **A function would add a permanent grantable surface that returns email addresses**, to
> serve a read the owner can already perform. `pledges` is deny-by-default at both layers
> (0026, G-PLG-b): RLS enabled with **zero policies**, and every table privilege revoked
> from `anon`, `authenticated`, **and `service_role`**. No client role can reach it under
> any query shape. The founder reads it as the table owner in the SQL editor, where RLS and
> grants do not apply — so the function would buy nothing and would have to be secured
> against the exact leak the table's current posture already forecloses.
>
> **And a function is DDL**, which means a migration, a dry-run matrix, and a by-hand apply
> at a stop-gate — a permanent change to the production schema in exchange for text that
> can live in a file.
>
> **Do not turn these into a view either.** A view is grantable, is subject to the grants of
> whoever queries it, and would become the parallel read path that `pledges`' posture exists
> to prevent. If a reviewer surface is ever wanted in the app, that is a design question
> about exposing pre-member contact data, not a convenience refactor of this file.
>
> **These are read-only.** No `insert`, `update`, or `delete` appears below. Opening a
> campaign is a separate, deliberate statement you type yourself (bottom of this file).

**These queries return the email addresses of people who are not members.** Run them when
you are about to act on them, not to browse. Close the tab afterwards.

---

## 1 · Campaign summary — one row per running campaign

```sql
-- Every neighborhood running a campaign (threshold is not null), with the
-- coarse shape of its arrivals. LEFT JOIN so a campaign with zero pledges still
-- appears — a neighborhood sitting at 0 is a finding, not an absent row.
select n.slug,
       n.threshold,
       count(p.id)                                     as pledges,
       n.opened_at,
       min(p.created_at)                               as first_pledge,
       max(p.created_at)                               as last_pledge,
       max(p.created_at) - min(p.created_at)           as span,
       count(distinct date_trunc('day', p.created_at)) as days_with_arrivals
  from public.neighborhoods n
  left join public.pledges p on p.neighborhood_id = n.id
 where n.threshold is not null
 group by n.id, n.slug, n.threshold, n.opened_at
 order by n.slug;
```

`opened_at` is here so the summary answers "is this one already open?" without a second
query. A non-null value means a person has already done this; do not do it twice.

## 2 · Per-day buckets — the shape of the fill

```sql
select n.slug,
       date_trunc('day', p.created_at)::date as day,
       count(*)                              as pledges
  from public.neighborhoods n
  join public.pledges p on p.neighborhood_id = n.id
 where n.threshold is not null
 group by n.slug, day
 order by n.slug, day;
```

## 3 · The roster — address and pace on the same row

```sql
-- gap_since_previous is the burst tell. It is a window function over each
-- campaign separately, so one busy neighborhood cannot make another look bursty.
select n.slug,
       p.email_normalized,
       p.created_at,
       p.created_at - lag(p.created_at)
         over (partition by p.neighborhood_id order by p.created_at) as gap_since_previous
  from public.neighborhoods n
  join public.pledges p on p.neighborhood_id = n.id
 where n.threshold is not null
 order by n.slug, p.created_at;
```

---

## Why all three, and not one

**Because each of the first two can be fooled, and the failure was demonstrated rather than
imagined.** Two seeded campaigns with the *same* pledge count — nine each — one filling over
four days, one a scripted burst of eight inside twelve seconds plus a single straggler three
days later:

| | braydon-park (burst) | maplewood (real) |
|---|---|---|
| pledges | 9 | 9 |
| **span** | **2 days 22:00:00** | **3 days 20:00:00** |
| days_with_arrivals | 2 | 4 |

**First/last and span alone fail.** The burst's span is *2 days 22 hours* — indistinguishable
at a glance from the healthy campaign, because one straggler three days after a burst
produces a wide, comfortable-looking window. Span is useful for orientation and is worthless
as a signal on its own.

**Per-day buckets catch that case** — 8 + 1 across two days against 2/2/2/3 across four —
which is exactly the "filling over days" shape a real neighborhood makes.

**But buckets hide the intra-day burst.** A whole day's arrivals landing in forty seconds is
still one bucket reading `8`. Nothing above the roster can separate that from eight people
pledging across a Saturday.

**The roster is what actually decides it**, because it puts plausibility and pace on the same
line:

```
braydon-park | qx7a@mailinator.com    | ... |
braydon-park | qx7b@mailinator.com    | ... | 00:00:02
braydon-park | qx7c@mailinator.com    | ... | 00:00:02
braydon-park | qx7d@mailinator.com    | ... | 00:00:01
...
braydon-park | realneighbor@gmail.com | ... | 2 days 21:59:48

maplewood    | dana.k@gmail.com       | ... |
maplewood    | m.ortiz@yahoo.com      | ... | 03:00:00
maplewood    | jwhitaker@outlook.com  | ... | 21:00:00
maplewood    | sam.begay@gmail.com    | ... | 07:00:00
```

A run of one- and two-second gaps against a single throwaway domain is a script, and it does
not need to be defined more precisely than that — a person reading it knows. Hours-apart
gaps against a spread of ordinary providers is a neighborhood. Reading addresses and timing
in one pass is the point; in two passes you match them up by hand and stop bothering.

**This is judgment, not a test.** There is no threshold on `gap_since_previous` and there
should not be: a legitimate door-knock afternoon produces short gaps, and a patient adversary
produces long ones. The queries make the evidence legible. The decision is the founder's, and
it stays that way — see `docs/decisions/neighborhood-pledge-campaigns.md`.

---

## Opening the campaign

Only after the read above. This is the whole of the act — one statement, typed by a person:

```sql
update public.neighborhoods
   set opened_at = now()
 where slug = 'the-slug'
   and opened_at is null;   -- so a second run cannot rewrite when it happened
```

`is_open` on the public page is `opened_at is not null` and nothing else, so this statement
is what changes what a neighbor sees. Reaching the threshold does not.

**If a count was inflated**, the remedy is to correct it publicly and say so
(`docs/decisions/neighborhood-pledge-campaigns.md` § Abuse). Removing rows quietly and
opening anyway is the one response the record rules out.
