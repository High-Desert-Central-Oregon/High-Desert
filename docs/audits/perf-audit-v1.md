# Performance audit v1 — measure, don't optimize

| | |
|---|---|
| **Status** | READ-ONLY diagnosis. **No code, no schema, no migration changed.** Every fix below is a *shape* + a routing (schema vs code); nothing is implemented. |
| **Method** | Hot-path queries EXPLAINed with `(ANALYZE, BUFFERS)` against a **prod-shaped local DB seeded to realistic volume**, run **as an impersonated member with RLS active**, then re-run with candidate indexes — all inside **one rolled-back transaction** (writes nothing; the matrix doctrine). Code streams (server-render, payload, poll-on-nav) audited by reading the built app. |
| **Seed volume** | 1,000 members · **20,000 posts** · **5,000 events** · ~20,000 RSVPs · **6,000 threads** · **100,000 messages** · ~12,000 thread_state · **3,000 moderation_actions** · 300 proposals · ~15,000 votes. Deliberately **beyond** the ~50-person cohort — a perf audit's job is to find where the curve bends, not to describe today's 6-row dev DB. Acting member "A" seeded into 69 threads. |
| **Environment** | PostgreSQL 17.6, local Supabase (`127.0.0.1:54322`), warm cache (`buffers: shared hit`). Timings are single-run wall clock on a warm buffer pool — read them as *ratios and buffer counts*, not absolutes. |
| **Harness** | `scratchpad/perf-seed.sql` (seed) + `scratchpad/perf-measure.sql` (baseline → create candidate indexes → re-measure → rollback). Reproducible; the DB is pristine after each run. |

The six migrations (0017–0022) landed under **security** review, not perf review — exactly as the brief guessed, the DB layer is where the cost is, and it's concentrated in **two tables that shipped with no secondary indexes at all** (`events`, `moderation_actions`) plus **one index built on the wrong column order** (`thread_state`).

---

## Headline — ranked by *measured* impact

| # | Finding | Measured (realistic volume, RLS on) | Fix | Routing |
|---|---|---|---|---|
| **1** | `events` has **only a primary key** — every event read is a full seq scan + sort | Exchange events feed **134 ms**; Upcoming agenda **133 ms** → **5.9 ms / 7.0 ms** with indexes (**≈20–23×**); buffers 15,087 → ~800 | 2 indexes: `events(group_id, created_at desc)`, `events(status, starts_at)` | **Schema** — batch w/ Y1 |
| **2** | `moderation_actions` has no lookup index → `is_content_hidden()` **runs per row** inside `po_read`, seq-scanning it each call | Posts feed **40.4 ms / 6,504 buffers → 15.6 ms / 1,168 buffers** (**2.6×**) | `moderation_actions(target_type, target_id, created_at desc)` | **Schema** — batch w/ Y1 |
| **3** | `thread_state` pkey is `(thread_id, member_id)` — unusable for the `member_id` lookup that fires on **every protected navigation** (unread dot) and the inbox | **10.3 ms → 0.3 ms** (**34×**); buffers 101 → 14 | `thread_state(member_id)` | **Schema** — batch w/ Y1 |
| **4** | Inbox / unread-dot read messages **globally** (newest-N + RLS filter) — cost is O(*all platform messages*), not O(*your* messages) | 8.2 ms at 100k msgs today; **adding `messages(created_at)` makes it 64 ms — a trap** (see §1.4) | **Restructure query** to per-thread-latest; do **not** add the index | **Code** |
| **5** | Poll-on-nav recomputes the unread dot on **every** `/protected/*` navigation (2 queries), duplicated again on `/messages` | 2 queries/nav; one is #3 (fixed by index), one is #4 (fixed by restructure) | Fold into #3/#4; consider per-request memo | **Code** |
| **6** | Unbounded `select` on growth tables | "add a member" fetches **all** verified profiles; RSVPs, proposals, groups dir have no `LIMIT` | Add `.limit()` + pagination | **Code** |
| **7** | Sequential `await`s that have no data dependency | ~1 extra round-trip each on 4 routes | Merge into `Promise.all` | **Code** |
| **8** | Member-facing asset weight | **217 KB** Strata Seal SVG shipped unoptimized on governance/vote; ~237 KB **orphaned** seal PNGs | Optimize SVG; delete orphans | **Code/asset** |

`/preview`'s 610 KB is **not** a member problem — §3 shows it's an isolated iframe document that never enters a member route's bundle. The RLS helper `is_group_member()` **is** a measurable per-row cost (§1.5), but it's structural (SECURITY DEFINER, un-inlinable) and mitigated by the same indexes that bound the row count — no separate fix.

---

## §1 · Database query layer (the cost is here)

### What exists today (live `pg_indexes`, hot tables)

Well-indexed already: `posts(group_id, created_at desc)` (`posts_feed_idx`), `messages(thread_id, created_at desc)` (`messages_thread_idx`), `threads` unique `(member_a,member_b)` + `threads_member_b_idx`, `calendar_feeds(token)`, `reports(created_at) where resolved_at is null`.

**Missing entirely:** `events` has *only* `events_pkey`. `moderation_actions` has *only* its pkey. `thread_state`'s only index is the composite pkey `(thread_id, member_id)` — wrong leading column for the query that matters.

### 1.1 `events` — no indexes → full seq scan on the two hottest event reads **[#1, schema]**

The Exchange "feed" is **not** a SQL UNION — [exchange/page.tsx:245-294](../../steppe/app/protected/exchange/page.tsx#L245-L294) runs a `posts` query and an `events` query separately and merges them in JS. The `events` half, and both Upcoming views, all filter/sort on columns with no index:

**Exchange events feed** — `where group_id=… and status='active' and starts_at>=now() order by created_at desc limit 100`:
```
BASELINE:  Limit (actual time=134.542..134.561 rows=100)
  -> Sort (top-N heapsort)  Sort Key: created_at DESC   Buffers: shared hit=15087
    -> Seq Scan on events (rows=2501)  Rows Removed by Filter: 2499
  Execution Time: 134.585 ms
AFTER events(group_id, created_at desc):
  Limit (actual time=0.432..5.885 rows=100)
    -> Index Scan using perf_ev_group_created   Buffers: shared hit=803
  Execution Time: 5.915 ms          -- 23× faster, 19× fewer buffers
```

**Upcoming agenda** ([upcoming/page.tsx:120-129](../../steppe/app/protected/exchange/upcoming/page.tsx#L120-L129)) — `where status='active' and starts_at>=now() order by starts_at asc limit 100`:
```
BASELINE:  Seq Scan on events (rows=2501)  Buffers: 15087   Execution: 133.383 ms
AFTER events(status, starts_at):  Index Scan  Buffers: 700   Execution: 6.993 ms   -- 19×
```

**Upcoming month grid** ([upcoming/page.tsx:95-105](../../steppe/app/protected/exchange/upcoming/page.tsx#L95-L105)) — `starts_at` bounded to one month, `limit 500`: baseline **26.4 ms**; with the `(status, starts_at)` index the range is found instantly **but the query stays ~ the same wall-clock** because it returns ~450 rows and pays `is_group_member()` per returned row (§1.5) — buffers 2,781 → 2,783. The index still matters (it stops scanning the other 4,550 events), but the month grid is the one event read that is *not* dominated by the scan.

**Fix shape.** Two btree indexes:
```sql
create index on events (group_id, created_at desc);   -- Exchange feed
create index on events (status, starts_at);            -- Upcoming agenda + month grid
```
Schema → migration → four-lens + manual apply. **Batch with Y1** (§5).

### 1.2 `moderation_actions` — `is_content_hidden()` is a per-row seq scan **[#2, schema]**

`po_read` ([0018_posts.sql:129-133](../../migrations/0018_posts.sql#L129-L133)) is
`is_group_member(group_id) AND (NOT is_content_hidden('post', id) OR author_id=uid OR is_moderator())`.
`is_content_hidden()` ([schema.sql:313-322](../../schema.sql#L313-L322)) is `LANGUAGE sql STABLE **SECURITY DEFINER**` — and a security-definer function **cannot be inlined**, so it is a black-box call **per candidate row**, each doing `… from moderation_actions where target_type=$1 and target_id=$2 order by created_at desc limit 1` against an unindexed table. In the posts-feed plan this shows up as the 6,504-buffer filter:
```
BASELINE Q1:  Index Scan using posts_feed_idx  Buffers: shared hit=6504   Execution: 40.399 ms
  Filter: is_group_member(group_id) AND (NOT is_content_hidden('post', id) OR …)
AFTER moderation_actions(target_type,target_id,created_at desc):
  Index Scan using posts_feed_idx  Buffers: shared hit=1168   Execution: 15.598 ms   -- 2.6×, buffers −82%
```
This index pays off on **every** list that filters removed content through RLS — posts, events, and proposal reads all call `is_content_hidden()`. (It does **not** speed the `content_moderation` view itself — see §1.6 — but the per-row RLS path is the bigger cost.)

**Fix shape.** `create index on moderation_actions (target_type, target_id, created_at desc);` Schema → **batch with Y1**.

### 1.3 `thread_state(member_id)` — wrong index for the every-navigation query **[#3, schema]**

The unread dot ([lib/messages.ts](../../steppe/lib/messages.ts)) and the inbox both read `thread_state` filtered by `member_id = auth.uid()` (`ts_read`). The only index is the pkey `(thread_id, member_id)` — `member_id` is the **second** column, so it can't serve the lookup:
```
BASELINE Q8:  Seq Scan on thread_state (rows=68)  Rows Removed by Filter: 11954  Execution: 10.254 ms
AFTER thread_state(member_id):  Bitmap Index Scan  Buffers: 14  Execution: 0.305 ms   -- 34×
```
Because getUnreadState runs on **every** `/protected/*` navigation (§4), this 10 ms is paid platform-wide on every page load, not just on the inbox. Highest *frequency* of any finding.

**Fix shape.** `create index on thread_state (member_id);` Schema → **batch with Y1**.

### 1.4 The inbox / unread scan is O(all messages) — and the obvious index is a trap **[#4, code]**

Both the inbox ([messages/page.tsx:63-67](../../steppe/app/protected/messages/page.tsx#L63-L67), `limit 400`) and getUnreadState (`limit 300`) read messages **globally, newest-first**, then let RLS `msg_read` filter to the member's threads and group-by-thread in JS. The plan hashes the member's ~68 threads once and seq-scans messages:
```
BASELINE Q6:  Limit rows=400  -> top-N Sort -> Seq Scan on messages
  Rows Removed by Filter: 98868   Buffers: 1552   Execution: 8.164 ms   (at 100k msgs)
```
8 ms sounds fine — but the work is **proportional to total platform messages**, not to the member's. It's ~1 ms for the cohort today and grows linearly forever.

The tempting fix — index `messages(created_at)` — **measurably backfires**, because the selective predicate (your 68 of 6,000 threads) isn't in the index, so the planner walks the global date order doing random heap fetches until 400 rows pass:
```
AFTER messages(created_at desc) Q6b:  Index Scan using perf_msg_created
  Rows Removed by Filter: 34866   Buffers: 35262   Execution: 64.046 ms   -- 8× WORSE
```
**Fix shape (code, no schema).** Make the read O(member's threads): resolve the member's threads first (already cheap — `threads_member_*` indexes, 0.15 ms, Q7), then fetch the latest message per thread via the existing `messages_thread_idx(thread_id, created_at desc)` — a bounded set of index probes over ~dozens of threads, not a global scan. Same restructure serves getUnreadState. **Do not** add `messages(created_at)`.

### 1.5 RLS per-row cost: `is_group_member()` is real but structural (no separate fix)

Answering the brief directly — **yes**, both helpers evaluate per row. `is_group_member()` ([schema.sql:329-337](../../schema.sql#L329-L337)) is also SECURITY DEFINER / un-inlinable; for the Everyone board it's *always* true (via the `is_verified()` branch) yet is still called for every surviving row at ~6 buffers/call. It's visible as the residual ~2,700 buffers in the month grid after the `starts_at` index (Q4b). There is no cheap way to remove a per-row SECURITY DEFINER call; the mitigation is exactly #1/#2 — an index + `LIMIT` shrinks the number of surviving rows the function runs on. No independent fix; noted so a future reviewer doesn't chase it.

### 1.6 `content_moderation` view — linear, un-indexable as written (low)

`getHiddenIds()` ([lib/moderation.ts:54-65](../../steppe/lib/moderation.ts#L54-L65)) reads the `content_moderation` view ([schema.sql:989-994](../../schema.sql#L989-L994)), a `DISTINCT ON (target_type, target_id) … ORDER BY … created_at desc` over the whole table. The `DISTINCT ON` forces a full scan + sort regardless of the §1.2 index:
```
Q5: Seq Scan moderation_actions (rows=3000) -> Sort -> Unique   Execution: 2.05 ms  (unchanged after index)
```
2 ms at 3k rows; grows linearly. Also note **double hidden-filtering**: `po_read` already hides removed posts in-DB, and the app *additionally* calls `getHiddenIds()` and re-filters in JS. Not pure waste — the JS pass also hides removed rows from the **author/moderator in the list** (RLS deliberately shows them the row for the P7 detail page) — but it means both paths run. Low priority; the §1.2 index makes the per-row path cheap, and the view stays small for the cohort.

### 1.7 Already-healthy hot paths (no action)

Thread view (0.29 ms, `messages_thread_idx`), inbox thread list (0.15 ms, `threads_member_*`), posts feed *ordering* (`posts_feed_idx`), governance list (2.2 ms at 300 rows). These shipped with the right indexes.

---

## §2 · Server-render

All fixes here are **code-only**, no schema.

**Unbounded queries on growth tables** — add `.limit()` + pagination, ranked:
- **Real:** [groups/[slug]/manage/page.tsx:83-87](../../steppe/app/protected/groups/[slug]/manage/page.tsx#L83-L87) fetches **all** verified profiles (`.eq("verified", true)`, no limit) for the add-member picker — grows with the whole membership. Needs a typeahead/paged lookup.
- [events/[id]/page.tsx:153-158](../../steppe/app/protected/events/[id]/page.tsx#L153-L158) — `event_rsvps` for an event, no limit (a popular event's whole RSVP list).
- [governance/page.tsx:106-109](../../steppe/app/protected/governance/page.tsx#L106-L109) — `proposals`, no limit (latent; 300 rows = 2 ms today).
- [groups/page.tsx](../../steppe/app/protected/groups/page.tsx) — groups directory, no limit (low-cardinality; low priority).

**Sequential `await`s with no data dependency** (≈1 round-trip each) — merge into `Promise.all`:
- [messages/[id]/page.tsx:105-110](../../steppe/app/protected/messages/[id]/page.tsx#L105-L110) — the `thread_state` (muted) read runs after the 3-way `Promise.all` above it; belongs in it.
- [governance/page.tsx:106-113](../../steppe/app/protected/governance/page.tsx#L106-L113) — `getHiddenIds` can run parallel to the proposals fetch.
- [groups/[slug]/page.tsx:165-170](../../steppe/app/protected/groups/[slug]/page.tsx#L165-L170) and [manage/page.tsx:116-120](../../steppe/app/protected/groups/[slug]/manage/page.tsx#L116-L120) — `categories` fetched sequentially.
- [events/[id]/page.tsx:163-169](../../steppe/app/protected/events/[id]/page.tsx#L163-L169) — RSVP author names could resolve alongside the RSVP fetch.

No app-layer N+1 found: author/name/neighborhood lookups are correctly batched with `.in(...)` (e.g. [exchange/page.tsx:335-347](../../steppe/app/protected/exchange/page.tsx#L335-L347)).

---

## §3 · Payload / bundle

**`/preview` (610 KB) does NOT leak into member routes — verified.** The weight is `public/preview-app/steppe-exchange.html` (609,798 B), a self-contained Claude Design export loaded as an **iframe `src`** ([components/preview-embed.tsx:38](../../steppe/components/preview-embed.tsx#L38), `:227`). An iframe document is fetched out-of-band and never enters the host route's JS bundle. `preview-embed.tsx` is imported by exactly one file — the `/preview` marketing page — and by nothing under `app/protected/` or the root layout; it pulls in only `react` + `next-intl`. No import edge, no bundling leak.

*(Caveat: this app builds on Next 16 + Turbopack + `cacheComponents`, whose build output does **not** emit the classic per-route "First Load JS" table — so exact member-route KB figures aren't available from the build. `@next/bundle-analyzer` would recover them if wanted.)*

**Real member-facing asset weight:**
- **217 KB** `public/brand/steppe-strata-seal.svg`, shipped via `next/image` on governance detail ([governance/[id]/page.tsx:169](../../steppe/app/protected/governance/[id]/page.tsx#L169)) and the vote receipt (`vote-form.tsx:60`) at 96×96. **`next/image` passes SVGs through un-optimized**, so all 217 KB ship to render a 96 px mark. Largest member-facing asset. Fix: optimize/flatten the SVG (SVGO) or ship a small rasterized seal for these small placements.
- 131 KB `steppe-isomimo-512.png` — raster via `next/image` (so auto-resized to the 150 px display), runtime cost modest; source oversized.
- **~237 KB orphaned:** `steppe-strata-seal-512.png` + `steppe-strata-seal-mono-512.png` are referenced by **no code** — dead weight in `public/`. Safe to delete.

All `next/image` uses carry explicit `width`/`height` (no layout-shift). All code-only / asset changes; none is a query cost.

---

## §4 · Poll-on-nav (M1/C1)

- getUnreadState ([lib/messages.ts](../../steppe/lib/messages.ts)) issues **2 queries per call** (`thread_state`, unbounded; `messages`, `limit 300`) and runs on **every** protected navigation via the `NavBar` server component ([protected/layout.tsx:47-56](../../steppe/app/protected/layout.tsx#L47-L56)). It's inside a Suspense boundary, so it **does not block** the page — good. No client polling, **no realtime subscription, no `setInterval`** anywhere under `/protected` (the only intervals are marketing-page weather/theme). The ICS calendar feed ([app/cal/[token]/route.ts](../../steppe/app/cal/[token]/route.ts)) is *pulled* by external calendar apps on their own PT1H TTL — Steppe never polls.
- The two per-nav queries are exactly findings **#3** (thread_state index → 10 ms→0.3 ms) and **#4** (messages global scan). Fix those and the unread dot's per-nav cost is ~sub-millisecond.
- **Duplication:** landing on `/messages` runs `thread_state` + `messages` **twice** — once in `NavBar`, once in the page. After #3/#4 this is cheap, but a per-request memo (compute the unread set once, share with the inbox) would remove the redundant round-trips. Code.

Aggressiveness verdict: **not aggressive** (nav-scoped, non-blocking, no realtime) — the problem is the *cost per computation* (#3/#4), not the *frequency*.

---

## §5 · The batch recommendation (indexes ↔ pending Y1 migration)

The four index additions from findings **#1–#3** are **pure additive `CREATE INDEX`** — no column change, no RLS change, no trust logic, no data rewrite. They touch `events`, `moderation_actions`, `thread_state`; the pending **Y1 visibility migration** touches `profiles` (add per-field `*_visibility` columns + amend the `public_profiles` view — see `docs/spec/profile-visibility-y1-spec-v1.md`). **Disjoint tables, zero interaction.** That makes them the ideal thing to fold into the **same migration file → one four-lens review → one manual apply** as Y1:

```sql
-- perf indexes (this audit) — safe to co-apply with the Y1 visibility columns
create index on events (group_id, created_at desc);
create index on events (status, starts_at);
create index on moderation_actions (target_type, target_id, created_at desc);
create index on thread_state (member_id);
-- optional, cheap, code-review-derived (not measured — member_blocks empty in seed):
-- can_send() checks blocks in both directions; the reverse lookup has no index
create index on member_blocks (blocked_id);
```

Notes for whoever sequences it:
- The four-lens review for a batch this size is light: the indexes are non-semantic, so the security lenses focus on Y1; a PG-correctness lens just confirms the index column orders match the query predicates above (they do — this audit measured it).
- On the cohort-sized prod DB these tables are tiny at apply time, so **plain `CREATE INDEX` is fine** at the stop-gate. If any target table is already large when applied, use `CREATE INDEX CONCURRENTLY` — which **cannot run inside a transaction**, so it would be applied as its own statement, separate from Y1's transactional DDL. For the cohort, not needed.
- The dry-run matrix (`seed/matrix-*.sql`) for the batch only needs to prove the Y1 semantics; the indexes need no matrix (they change plans, not results) — though this audit's `scratchpad/perf-measure.sql` is the reproducible before/after if a reviewer wants the numbers regenerated.

Findings **#4–#8** are **code**, independent of any migration, and safe to ship on their own cadence. Recommended order: **#3 + #1 + #2** (the batched index migration, biggest measured wins, one apply) → **#4** (inbox restructure, the O(n) architectural fix) → **#6/#7/#8** (unbounded limits, await merges, asset trims) as routine PRs.

---

## Appendix — reproducing the measurements

1. Local Supabase up (`supabase status` → DB on `54322`).
2. `psql … -f scratchpad/perf-measure.sql` — seeds realistic volume, prints baseline plans, creates candidate indexes, prints after-plans, **rolls back**. The DB is unchanged when it finishes.
3. Impersonation is `set local role authenticated` + `set_config('request.jwt.claims', …)` so `auth.uid()` resolves and every plan is measured with RLS enforced, as a real member sees it.

*Written 2026-07-13. READ-ONLY — measured, not optimized; nothing here is implemented. Numbers are warm-cache single-run at the seed volume above; treat as ratios + buffer counts.*
