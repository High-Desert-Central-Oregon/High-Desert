# The security_invoker revert, twice — and how to stop it

**Dates:** 2026-07-30 and 2026-07-31
**Status:** second occurrence fixed by migration 0030; durable fix recommended below, not yet applied
**Severity:** live, member-facing, silent — no error, no empty page, just wrong numbers

---

## Both instances

| | First | Second |
|---|---|---|
| **Date** | 2026-07-30 | 2026-07-31 |
| **What changed** | `security_invoker = on` on all four public views | `security_invoker = on` on all four public views |
| **Grants** | **also reset** — `anon` regained all 7 privileges on each | **intact** — `anon` none, `authenticated` SELECT only |
| **Therefore** | the run recreated the views (drop/create) | the run was `ALTER VIEW … SET` |
| **Fixed by** | migration 0028 (revoke-first, then restore) | migration 0030 (three ALTERs, no grant repair needed) |
| **Found by** | accident, during an unrelated mirror audit | reported by Greg |
| **Detected by a control** | **no** | **no** |

The design being reverted is not new and is not accidental. **Migration 0023 (2026-07-14)** set
`public_profiles` to owner rights deliberately and said so in its own comment: *"OWNER-RIGHTS
view: security_invoker = false … so it reads PAST the narrowed base pf_read — that is precisely
what makes it the single cross-member read path."* **0013** did the same for `groups_directory`
(*"mirrors public_profiles … ALL GROUPS to any verified member"*). Both reverts undid a decision
that was recorded, reasoned, and load-bearing.

## What breaks, each time

- **`public_profiles`** — a member sees **only themselves**. Nine call sites read it for other
  members' names (Exchange, messages, groups, the maintainer console). Measured both times.
- **`proposal_results`** — `vt_select` applies *inside* the aggregate, collapsing the community
  tally to the reader's own single ballot. This is invariant 4's only sanctioned results path.
- **`groups_directory`** — unjoined `members_only` groups vanish, which also makes
  `join_policy = 'request'` unreachable: you cannot ask to join a group you cannot see.

`content_moderation` is correct at `security_invoker=on` and is pinned there deliberately —
`mod_read` is `using (true)` for authenticated, so invoker rights change nothing for its audience.

## Convention 6, violated twice

`docs/migrations-applied.md` convention 6 already says: *Supabase advisor remediations are
applied as MIGRATIONS, never from the dashboard.* It was written after the first instance. The
second happened anyway. A convention that is only a sentence in a file does not stop a one-click
button in a different product, and it should not be expected to.

---

## The durable fix — three options, one recommendation

The advisor will flag these views as `0010_security_definer_view` **indefinitely**, because from
the linter's perspective they are exactly what it exists to find. Any fix that does not address
the recurring prompt is a fix that waits for the next person to click.

### (a) Advisor suppression — **researched, and it does not exist**

I checked the Supabase documentation for a per-lint or per-object suppression, ignore list, or
acknowledgement mechanism. The lint's own page
(`database-advisors?lint=0010_security_definer_view`) documents the rule, its rationale, and a
single "How to Resolve" — set `security_invoker=on`. **No suppression, no ignore, no
false-positive path is documented anywhere in the advisor guides.** Reporting that honestly:
option (a) is not available. If Supabase adds one later this becomes the cheapest fix.

Worth noting what the lint's own rationale says the risk is: *"could expose more data publically
over the project's APIs than the developer intended."* That risk is real **and it does not apply
here**, because `anon` holds nothing on any of these four views — the only role that can reach
them is `authenticated`. The linter cannot see that distinction; it flags the reloption, not the
grant. Which is precisely why a human decision needs to be recorded where the next human looks.

### (b) A standing exception, documented where the advisor's suggestion is encountered

Name the four views, state which setting each should carry and why, and make the advisor's
suggestion recognisable as **already-decided** rather than as a new finding. The decision already
exists in 0023, 0028 and 0030 — but it lives in migration headers, and nobody reading a dashboard
advisor panel is reading migration headers.

### (c) A redesign satisfying the advisor without owner rights — **not possible as designed**

Stating this plainly rather than leaving it open. The advisor is satisfied only by
`security_invoker=on`, which means base-table RLS applies to the caller. For these views that is
not a tuning difference, it is the opposite of the design:

- `public_profiles` exists **because** `pf_read` is owner-only (`id = auth.uid()`). 0023 narrowed
  the policy *on purpose* and moved the cross-member boundary into the view's per-viewer `CASE`.
  Under invoker rights the policy re-applies and the view returns one row. **The per-viewer CASE
  cannot be expressed as an RLS policy**, because it is a per-column decision (`neighborhood_id`
  is returned to the row's owner or when `visibility='members'`, and withheld otherwise) and RLS
  gates rows, not columns.
- `proposal_results` must aggregate across *all* ballots while no member may read another's
  ballot. Any invoker-rights formulation reduces the aggregate to the caller's own row. A
  `SECURITY DEFINER` function returning the tally would satisfy the linter — but that is the same
  privilege posture wearing a different hat, and it would trade a declarative view the app reads
  with PostgREST for an RPC every call site must be rewritten to use.

There is a theoretical route — move the base tables to a private schema and expose only
invoker-rights views — but it is a schema-wide restructuring that would touch every policy, every
call site and every migration, to satisfy a linter that is wrong about this specific case. That
is not a proportionate response.

### ✅ Recommendation: (b) **plus a detection control**

Do (b) because it is the only option available, and pair it with detection because (b) is
documentation and documentation does not fire.

**The detection control.** Nothing caught either revert. Both were found by a person. A scheduled
check is cheap and closes exactly this gap:

```sql
-- Expected: zero rows. Any row is an out-of-band revert.
select c.relname, array_to_string(c.reloptions, ',') as reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v'
   and ( (c.relname in ('public_profiles','proposal_results','groups_directory')
          and coalesce(array_to_string(c.reloptions,','),'') ilike '%security_invoker=on%')
      or (c.relname = 'content_moderation'
          and coalesce(array_to_string(c.reloptions,','),'') not ilike '%security_invoker=on%') );
```

It must **reach a person**, not merely turn a build red — Woodpecker pipeline #218 failed on
`mirror-provenance` once and the failure went unnoticed, which is the same failure mode one level
up. This shares its shape with deferred item 11 (scheduled mirror-equality monitoring) and should
be built alongside it: both are "assert an invariant on a schedule and tell a human", and neither
is expressible as a push-time gate.

**Filed as `docs/ops/deferred-hardening.md` item 12.**

---

## The general lesson, which is not about views

A vendor's convenience affordance wrote to infrastructure outside the review record — twice —
and the repository could not see it either time. This is the same shape as the analytics beacon
that reached production through the GitHub mirror
(`docs/ops/incident-2026-07-30-mirror-analytics-beacon.md`): **a one-click fix in a vendor UI is
a change nobody reviewed.** The controls that work against it are the ones that assert the
expected state on a schedule and tell a person when it moves — not the ones that describe the
right behaviour in a file.
