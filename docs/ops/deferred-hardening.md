# Deferred hardening

Work that is **known, decided, and not done**. Each item was deferred on purpose during a
build that had a reason not to widen, and each one is written down here because a decision
that lives only in a commit message is a decision that gets rediscovered as a bug.

This is not a wishlist. Everything below is a specific change to specific objects, with
the reason it waited and what has to be true before it lands. If an item turns out not to
be worth doing, delete it and say why in the commit — an item quietly dropped is
indistinguishable from an item forgotten.

**Nothing here is applied to production.** These are all migrations or changes still to be
written; the applied ledger is `docs/migrations-applied.md`.

---

## 1. `search_path` sweep on pre-0026 definer functions

**What.** Migration 0026 established `SET search_path = public, pg_temp` as the standard
for every `SECURITY DEFINER` function, which prevents a temporary table shadowing a real
one inside a definer body. Roughly **forty-four** functions predate that standard and
carry the older `SET search_path TO 'public'`.

**Including `enforce_invited_signup()`** — the invite gate itself. That is the reason this
is written down rather than done: the byte-identity of that function is the regression
criterion for migration 0027
(`sha256(pg_get_functiondef(...)) = 8f2f632e92d2eab9900fd11b9a0bd9156c2f867bedff33d211f322086366532e`),
asserted in the migration header, the dry-run matrix, and the test suite. Changing its
`search_path` moves that hash. Doing it inside 0027 would have folded an unrelated
hardening into a build whose entire claim was that the gate was not touched, and would have
broken the check that proved it.

**How it must be done.** Its own migration, with **the hash of every affected body recorded
before and after** — not a count of functions changed. The before-hashes are the evidence
that the sweep touched what it claimed to; the after-hashes become the new baseline, and
0027's recorded criterion is superseded in the same commit rather than left dangling.

**Before it lands.** Nothing blocks it. It should not share a commit with any behavioural
change.

**Sources.** `docs/decisions/invite-tokens.md` § *Known deviation*;
`migrations/0027_invite_tokens.sql` header.

---

## 2. Two unqualified predicates in the 0027 probe tuple

**What.** The canonical apply-status probe for 0027 — committed in the migration header and
in `docs/migrations-applied.md` — contains two clauses that do not qualify their schema:

```sql
and exists (select 1 from pg_proc where proname='redeem_invite')
and exists (select 1 from pg_proc where proname='purge_stale_invites')
-- ...and:
and not exists (select 1 from information_schema.columns
                 where table_name='profiles' and column_name='invited_by')
```

`pg_proc` is queried without joining `pg_namespace`, so a same-named function in any other
schema would satisfy the clause. The `profiles` check omits `table_schema`, so a `profiles`
table in another schema gaining an `invited_by` column would make the probe report the
invite graph as having escaped when it had not — and, in the other direction, would not
notice `public.profiles` if another schema's copy were absent.

**Why it was left.** The tuple in the ledger is character-identical to the tuple in the
applied migration's header, and that identity is deliberate: it is what stops the two
copies drifting. Correcting the predicates in one place would desync the ledger from the
file that actually ran, in the one file whose purpose is being true about what ran.

**How it must be done.** Both copies in the same commit, with the diff shown to be
identical on both sides, and a note in the ledger that the probe text was corrected after
the fact and why. Do not correct one and not the other.

**Risk if left.** Low in practice — this database has one application schema — but the
clause reads as a schema-qualified check and is not one, and a reader trusting it would be
trusting something weaker than it appears.

---

## 3. `default auth.uid()` on `invite_tokens.created_by`

**What.** Migration 0027 ships `created_by` with no default and no trigger. The mint server
action sets it from the caller's session, so the attribution is server-set and a client
cannot choose it — but the *database* does not enforce that, and a second write path added
later (a script, a fixture, a future member-minting surface) would store NULL without
anything complaining.

**Why it was left.** 0027 is applied to production and is not editable. Attribution held
correctly by the one existing write path was not worth a follow-up migration on its own.

**How it must be done.** Fold into the `search_path` sweep (item 1) — that migration is
already revisiting definer-function hygiene and already carries before/after hashes. Add
`alter table public.invite_tokens alter column created_by set default auth.uid()`. Note
that this does **not** retroactively attribute existing rows, and must not: a guessed
attribution is indistinguishable from a recorded one, which is the same rule
`invited_emails.invited_by` already states in its column comment.

**Sources.** `docs/decisions/invite-tokens.md` §4 (corrected in 1.1);
`steppe/app/protected/invites/actions.ts`.

---

## 4. Per-token failed-attempt counter for redemption

**What.** The redemption route is rate-limited per connection (`invite:<ip>`, five attempts
per ten minutes) using the in-memory limiter shared with the pledge and contact routes. On
Fluid Compute that map is **per serverless instance**: it resets on cold start and
concurrent instances each hold their own count, so the effective production ceiling is a
multiple of five rather than five, and is not a number the platform can state.

**The additive control** is a per-token failed-attempt counter in the database — the only
place a count can be authoritative across instances. A token accumulating failed
redemptions past a threshold stops being redeemable until a moderator looks at it. It
bounds enumeration against a *specific* token in a way an in-memory map cannot, and it
composes with the connection limiter rather than replacing it.

**Constraint on the design: no IP address is persisted.** The current limiter holds the
first hop of `X-Forwarded-For` as a map key in memory and writes it nowhere; the counter
must be keyed on the **token** and store no client identifier at all. A limiter that
logged addresses to enforce itself would build exactly the behavioural record this platform
exists not to keep (CLAUDE.md invariant 8).

**What it does not fix.** Neither control bounds a holder of a legitimately distributed
token exhausting its cap. Those are valid requests against a code the person was given; the
answer there is revocation and a reprint. The cap is a blast-radius dial, not an abuse
budget.

**Sources.** `docs/decisions/invite-tokens.md` §7; `steppe/lib/rate-limit.ts`;
`steppe/app/api/invite/redeem/route.ts`.

---

## ~~5. The invite landing destination is unwired~~ — CLOSED, withdrawn

**Not deferred. Withdrawn**, 2026-07-29, and kept here with a line through it because an
item that silently disappears is indistinguishable from an item forgotten — which is the
rule stated at the top of this file.

The item asked for `invite_tokens.neighborhood_id` to route a redeemed member to that
neighborhood's pledge campaign after sign-in. A read-only audit before building it
established that **pledging never required an account**: `/n/<slug>` is on the public
allowlist ahead of both the auth redirect and the launch gate, `submit_pledge` is
service_role-only and called from `/api/pledge`, a route that imports no auth module, and
the page renders a working pledge form to an anonymous visitor. An anonymous request with
no cookies submits a pledge and it is recorded.

So the destination answered a question nobody had. A pledger acts months before any account
exists; by the time someone holds an account, the campaign has opened and the ask is
verification, not a pledge. The neighborhood QR points at `/n/<slug>` directly and should —
putting a capped, expiring token in front of a yard sign would be the wrong instrument.

`neighborhood_id` is redesignated **mint-time provenance** — which audience a batch of cards
was printed for — rather than a routing input. Full reasoning in
`docs/decisions/invite-tokens.md` §9 (v1.2).

---

## 6. Founder notification when a campaign reaches its threshold

**Trigger condition — build it when more than one campaign is running concurrently.**
Not before. With a single campaign, "notice it by running the review read" is adequate and
adds no moving parts. With several, that becomes "remember to look at several things", and a
neighborhood sitting at threshold for two weeks because nobody checked is a real cost — the
count is public, and stale-at-threshold is visible to exactly the people waiting on it.

**What.** Nothing tells the founder that a campaign crossed its threshold. It is found by
running `docs/ops/campaign-review.md`.

**Shape when built.** `close_stale_pledge_campaigns()`'s shape: a function invoked
deliberately that returns what it found, **not** a cron job. The reason is the one that keeps
opening manual — a scheduled notification is one step from a scheduled opening, and the whole
point of this subsystem is that a person stands between the arithmetic and the act. It should
carry what makes the review fast: the count and the arrival distribution, so the mail is the
read rather than a prompt to go do the read.

**Also needed.** A recipient. There is no pledge-side inbox today; `CONTACT_TO` is the
contact form's and should not be reused, or a change to contact routing would silently
redirect campaign alerts. A separate `PLEDGE_NOTIFY_TO` is the smaller surprise.

**Sources.** `docs/decisions/neighborhood-pledge-campaigns.md` § *Deferred, not rejected*
(v1.1); `docs/ops/campaign-review.md`.

---

## 7. `/api/interest` has an inert limiter, and two routes bypass `clientIp`

**What.** `interestRateLimited()` in `steppe/app/api/interest/route.ts` is a stub:

```ts
function interestRateLimited(_ip: string): boolean {
  return false; // not implemented — no enforcement yet; every request passes.
}
```

The call site reads exactly like the enforced limiters on `/api/pledge` and
`/api/invite/redeem` — `if (interestRateLimited(ip)) { ...429... }` — so a public write
endpoint **reads as rate-limited and is not**. The stub is honestly commented in place; the
problem is that the call site is indistinguishable from a real one at a glance, which is how
an inert control survives a review.

Separately, `/api/interest` and `/api/contact` each read `x-forwarded-for` **inline** rather
than through `clientIp()`:

```ts
const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
```

That is the same expression `lib/rate-limit.ts` exports, copied. It works, but the
no-IP-persistence property is documented on `clientIp()` — *"Used ONLY as a rate-limit key —
never stored, never logged, never associated with an address"* — and these two copies inherit
the behaviour without inheriting the statement. Both are currently key-only, verified; the
gap is that nothing keeps them that way.

**Why this is lower stakes than the pledge endpoint.** Nothing *trips* off interest signups.
There is no threshold, no campaign that opens, and no published count — the number is not
printed on a yard sign and is not a promise to anybody. Inflating the list produces **noise in
a list a person reads**, not a falsely-opened neighborhood. That is a different class of
failure from `/api/pledge`, where the count is the mechanic and appears on physical mail.

**But it is not consequence-free, and the honest version matters.** The route calls
`sendInterestConfirmation()`, so every *novel* address costs one Resend send. The
on-conflict dedup bounds **repeats**, not **novelty**: a script cycling distinct addresses
spends real send quota and, worse, sender reputation — which is shared with the transactional
mail the member app depends on.

**Conditions that raise its priority** (either one):

1. **A count from `interest_signups` is ever published or used to make a decision** — a
   landing-page number, a funder deck, a go/no-go on a neighborhood. At that moment
   inflation stops being noise and starts being a false claim, and it inherits the pledge
   endpoint's stakes.
2. **Novel-address volume appears in Resend metrics** — bounce rate climbing, or sends
   outpacing plausible human signups. That is the signal that the quota and the reputation
   are being spent, and it arrives before any count is published.

**Shape when built.** The stub's own comment names the two options: a generous per-IP window
using `clientIp()` (the `/api/contact` pattern), or a global send circuit-breaker capping
total sends per minute across the instance. The second addresses the reputation risk that a
per-IP limit does not. Whichever is chosen, route the two inline `x-forwarded-for` reads
through `clientIp()` so the documented property covers them.

**Sources.** `steppe/app/api/interest/route.ts`; `steppe/app/api/contact/route.ts`;
`steppe/lib/rate-limit.ts`; `docs/decisions/neighborhood-pledge-campaigns.md` § *Rate
limiting* (v1.1).

---

## 8. The prod column comment on `invite_tokens.neighborhood_id` describes withdrawn work

**What.** The live comment in production still reads:

> NULL = general-purpose token (counter cards, press). Set = minted for one neighborhood,
> and **prefills the pledge landing at `/n/<slug>`**. ON DELETE SET NULL: … (0027, G-INV-6).
> **Routing behavior is Phase 4.**

Both bolded claims are withdrawn. `docs/decisions/invite-tokens.md` §9 (v1.2) records that the
pledge landing was withdrawn rather than deferred — pledging never required an account, so
routing a redeemed member to a pledge page answered a question nobody had — and redesignates
the column as **mint-time provenance**: which audience a batch of cards was printed for, read
by nothing else. There is no Phase 4 routing and there will not be.

**Why it matters even though the ADR supersedes it.** The database is the surface consulted
first. Someone opening the SQL editor and running `\d+ invite_tokens` — or reading the column
in the Supabase dashboard — gets the withdrawn design stated as current fact, with no pointer
to the record that overrides it. A comment is documentation that ships *inside* the artifact
it describes, which is exactly why a stale one outranks a correct file nobody opened.

**Why it was not fixed in place.** Migration 0027 is applied to production. The file is not
editable after apply, and a `COMMENT ON COLUMN` is DDL, so correcting it is a migration.

**How it must be done.** Fold into the `search_path` sweep (item 1) — that migration already
touches this subsystem and already carries before/after hashes. Reword to state provenance
only, and cite ADR §9 so the next reader lands on the record rather than re-deriving it. The
column itself does not change: still nullable, still `ON DELETE SET NULL`, still read by no
function. Only the sentence describing it is wrong.

**Sources.** `docs/decisions/invite-tokens.md` §9 (v1.2);
`migrations/0027_invite_tokens.sql` lines 75, 197, 218.
