# Performance audit v2 — the per-navigation FLOOR

| | |
|---|---|
| **Status** | READ-ONLY diagnosis. **No code, schema, or config changed.** Every fix is a *shape* + a routing (schema / code / config); nothing is implemented. |
| **Symptom** | ~0.5–1 s lag on **every** `/protected/*` navigation — a constant floor present even on trivial pages — plus extra on data-heavy pages. |
| **Scale** | **n = 2 members** on prod (`profiles`), **0 posts, 0 messages, 0 threads, 63 events**. This is emphatically **not** a scale problem. The floor is per-action overhead, not data volume. |
| **Method** | Measured prod directly: JWKS endpoint, auth-js source (`getClaims`/`fetchJwk`), Vercel deployment region + Supabase project region, production TTFB samples (cold vs warm), live `pg_indexes`, live row counts, the `public_profiles` view def. Authenticated render time is **decomposed from parts** (see §0.3) — labelled *inferred* where I could not measure it without minting a member session (out of scope for read-only). |
| **Date** | 2026-07-14. |

---

## §0 · FLOOR — the per-navigation constant (the win)

### 0.1 The two lead suspects are both RULED OUT (measured)

| Suspect | Verdict | Evidence |
|---|---|---|
| **Cross-region hop on every `getClaims`** | ❌ **Not it — co-located** | Vercel functions run in **`pdx1` (Portland, OR)** (`deployment.regions=["pdx1"]`); Supabase is **`us-west-2` (Oregon)**. Same region, RTT ~1–5 ms. There is no cross-country tax. |
| **`getClaims` network-refresh on every nav** | ❌ **Not it — local verify** | The project has **asymmetric ES256 JWT signing keys live** (`/auth/v1/.well-known/jwks.json` returns an EC key, `kid e3dae270…`). auth-js `getClaims()` ([GoTrueClient.js:5069](../../steppe/node_modules/@supabase/auth-js/dist/module/GoTrueClient.js)) verifies an ES256 token **locally with WebCrypto** — it only falls back to a network `getUser()` for `HS*`/kid-less tokens. The JWKS is cached in a **module-level `GLOBAL_JWKS`** (10-min TTL) shared across all clients in a warm lambda, so even though `updateSession` news-up a client per request, JWKS is fetched ~once per warm instance, not per nav. Measured: `/protected` → 307 redirect (which runs the full proxy `getClaims`) returns in **~115–130 ms warm** — far too fast to contain a blocking auth round-trip. |

**So the floor is neither auth nor region.** It is **serverless cold-start + fully-dynamic RSC render overhead**, described below.

> ⚠️ One asterisk on the auth verdict: this assumes members' access tokens are actually **ES256**-signed. That is near-certain (ES256 is the sole published key and asymmetric is enabled), but it is the one thing I could not measure without a live member token. **Decisive check:** decode any member's `access_token` cookie and read the header — `{"alg":"ES256",...}` confirms local verify; `"HS256"` would mean `getClaims` network-calls `getUser` every nav (then auth *would* be part of the floor). One-liner in §6.

### 0.2 What the floor actually is — measured production TTFB

```
Marketing "/" (PRERENDER-cached):   cold 890 ms  →  warm 240–300 ms   (cold penalty ≈ +600 ms)
/protected → 307 redirect (no auth): warm 115–130 ms   (proxy + getClaims-local + redirect, NO authed render)
/auth/login (real dynamic render):   warm 120–250 ms
```

Two components, both real:

1. **Cold start ≈ +600 ms.** Measured 890 ms first-hit vs ~250 ms warm. At **2 members** the app gets ~zero traffic, so lambdas are cold on most first-clicks after any idle gap. This is the source of the *upper* end (~1 s) of the range and why it feels "constant" — sparse traffic never keeps an instance warm. `lambdaRuntimeStats {"nodejs":3}`, Node 24.x, `type=LAMBDAS`.
2. **Warm dynamic-render baseline ≈ 120 ms + layout work.** Every `/protected/*` page reads cookies → **fully dynamic** under `cacheComponents` (no prerender possible), so each nav is a full function invocation + RSC render + stream. The 120 ms redirect measurement is the *floor of the floor* — before any authed data or render is added.

### 0.3 ms breakdown of one *simple-page* navigation (the thing that should do almost no work)

Measured parts in **bold**; the rest is decomposed/inferred (see caveat).

| Segment | Warm | Cold | Notes |
|---|---:|---:|---|
| Vercel edge → function invoke + **proxy `updateSession`** (getClaims **local**, launch-gate, cookie set) | **~120 ms** | ~700–890 ms | **Measured** via the `/protected` 307. Cold adds the lambda spin-up (Node init + module eval + first JWKS fetch). |
| Layout `ConsentGuard` → `getConsentState` — **2 *sequential* round-trips** (`documents` **then** `consents`), and it pulls full document **bodies** | ~20–50 ms | +TLS on cold | *Inferred* (co-located PostgREST, empty tables). Serial + oversized; runs on **every** nav. §0.4 #3. |
| Layout `NavBar` → `getUnreadState` — 2 *parallel* round-trips (`thread_state`, `messages` limit 300) | ~10–15 ms | — | *Inferred*. 0 rows today. Parallel already. |
| `getClaims` called **again ×2** in render (`ConsentGuard` + `NavBar` both call `getCurrentUser`) | ~5–10 ms | — | Local verify, but redundant (no request-memo). §0.4 #4. |
| RSC render + serialize + stream + client apply / partial hydration | ~50–150 ms | more | *Inferred*; inherent to dynamic RSC. |
| **Total (simple page)** | **≈ 250–400 ms** | **≈ 850–1100 ms** | Matches the reported 0.5–1 s: **warm ≈ 0.3 s, cold ≈ 1 s.** |

**Is the floor auth, region, or both? Neither.** It is **(1) cold-start + (2) an unavoidable warm dynamic-render baseline**, with a thin layer of **(3) serial, redundant per-nav layout work** on top. Auth is cheap (local), region is co-located.

### 0.4 Floor findings, ranked by ms-impact

| # | Finding | Impact (per nav) | Fix shape | Routing |
|---|---|---|---|---|
| **F1** | **Cold starts.** ~zero traffic (2 members) ⇒ lambdas cold on most first-clicks. | **+~600 ms** (890→250, measured) | (a) Confirm/enable **Vercel Fluid Compute** (keeps instances alive, bytecode cache — big cold-start reducer); (b) shrink what the `/protected` server entry loads at init (audit server bundle; keep `three`/`vanta`/`gsap` — marketing-only — out of any shared import reachable from `app/protected`); (c) if still cold, a cheap **keep-warm** ping (cron hitting a light route) during cohort hours. | **Config** (+ minor code for (b)) |
| **F2** | **Fully-dynamic render every nav.** Cookie reads make every `/protected` page dynamic under `cacheComponents`; the nav shell re-renders server-side each move. | ~120–250 ms warm baseline | Make the **nav chrome static** (PPR/`cacheComponents`: cache the `AppNav`/`TabBar` shell; leave only the unread dot dynamic in its existing Suspense boundary). Cuts render work to the truly-dynamic sliver. | **Code/config** |
| **F3** | **`getConsentState` on every nav is serial + oversized.** `getCurrentDocuments()` (fetches full Terms/Privacy **bodies**) **then** `consents` — 2 sequential round-trips, on every navigation, to answer a boolean that changes ~never. [onboarding.ts:19-61](../../steppe/lib/onboarding.ts#L19-L61) | ~20–50 ms serial | (a) `Promise.all` the two reads; (b) **stop selecting `body`** — the guard only needs `id, kind, version` to check completeness; (c) **short-circuit once consented**: after the consent gate passes, set a lightweight signal (cookie/claim) so the hot path skips both DB reads until docs version-bump. | **Code** |
| **F4** | **`getClaims` ×3 per nav** (proxy + `ConsentGuard` + `NavBar`), each re-reading cookies + verifying. Local, but redundant. | ~10–20 ms | Wrap `getCurrentUser` in React `cache()` so it runs **once per request**; the proxy call is a separate runtime and stays. | **Code** |

**None of the floor fixes is "reduce getClaims frequency for network reasons," "colocate regions," or "edge-cache the auth check"** — those target costs that measurement shows aren't there. The levers are **cold-start (F1)** and **cheaper dynamic render (F2–F4)**. F1 is the single biggest win.

---

## §1 · STACK — the extra on data-heavy pages (secondary, mostly latent)

At **2 members / 0 posts / 0 messages / 0 threads**, the DB layer contributes **≈ nothing** to today's lag. This section is about what grows, and confirms the v1 fixes landed.

### 1.1 perf-audit-v1 indexes are **LIVE on prod** ✅ (measured `pg_indexes`)

`events_group_created_idx (group_id, created_at desc)`, `events_status_starts_idx (status, starts_at)`, `moderation_actions_target_idx (target_type, target_id, created_at desc)`, `thread_state_member_idx (member_id)` — all present, matching v1's recommended column orders. `messages_thread_idx`, `posts_feed_idx` also present. The v1 index batch (findings #1–#3) shipped. **Not applied:** the optional `member_blocks(blocked_id)` reverse-lookup (only `member_blocks_pkey` exists) — still latent, still low priority.

### 1.2 Per-hot-page round-trips & serial awaits (v1 code items, still open, still latent)

The v1 §2 findings are **code** and independent of the floor; they only bite once content exists:
- **#4 (the architectural one):** `getUnreadState` + inbox read `messages` **globally** (newest-300 + RLS filter) — O(all platform messages), not O(your threads). 0 ms today (0 messages); becomes the dominant messaging cost at volume. Fix = restructure to per-thread-latest via `messages_thread_idx` (do **not** add `messages(created_at)` — v1 §1.4 proved it backfires). **Code.**
- **#6 unbounded selects** (add-member picker fetches *all* verified profiles; RSVP lists; proposals) and **#7 sequential awaits** (governance `getHiddenIds`, groups `categories`, messages `thread_state`) — merge into `Promise.all`, add `.limit()`. **Code.** Latent at n=2.

### 1.3 Y1 `public_profiles` CASE — **cheap, not a hot-path concern** (measured view def)

```sql
CASE WHEN id = auth.uid() OR neighborhood_visibility = 'members' THEN neighborhood_id ELSE NULL END
```
A trivial per-row **scalar** CASE (one `auth.uid()` — STABLE, cached per statement — and a text compare). No subquery, no SECURITY DEFINER call. And it is **not on the every-nav path**: `public_profiles` is read only on data pages (exchange, messages, groups, review) — [exchange/page.tsx:237](../../steppe/app/protected/exchange/page.tsx#L237), [messages/page.tsx:80](../../steppe/app/protected/messages/page.tsx#L80), etc. — never in `layout.tsx`. Per-page-variable, negligible cost. No action.

---

## §2 · Client (not the floor)

RSC client-side navigation fetches a payload and applies it — it does **not** re-ship the JS bundle or re-hydrate the whole tree per nav, so bundle weight is a *first-load* cost, not a per-nav one. v1 §3/§4 already established: no client polling, no `setInterval`, no realtime under `/protected`; the marketing-only heavy libs (`three`/`vanta`/`gsap`) live in the `(site)` group, not the member app. The v1 asset trims (217 KB Strata Seal SVG on governance; orphaned PNGs) remain worth doing but are first-load, not the floor. No new client-waterfall found on protected nav.

---

## §3 · Per-navigation-CONSTANT vs per-page-VARIABLE (as requested)

| | Cost | Today (n=2) |
|---|---|---|
| **CONSTANT (the floor — paid on every nav)** | Cold start (F1); dynamic-render baseline (F2); `getConsentState` 2 serial reads (F3); `getClaims`×3 (F4); `getUnreadState`×2 | **~0.3 s warm / ~1 s cold** — this is essentially the *entire* current symptom |
| **VARIABLE (per-page — scales with content)** | events/posts feed, `public_profiles` joins, inbox message scan (#4), unbounded selects (#6) | **~0 ms** now (empty tables, indexes live); grows later |

**Sequencing implication:** fix the **CONSTANT** column first — it *is* the reported problem. **F1 (cold start)** is the biggest single lever and is config-level; **F2–F4** are code and cut the warm baseline. The VARIABLE column (v1's open code items) can wait until there's content to make it matter.

---

## §4 · Fix routing summary (nothing implemented)

| Finding | Schema | Code | Config |
|---|:--:|:--:|:--:|
| F1 cold start | | · (bundle) | **✔ (Fluid Compute / keep-warm)** |
| F2 static nav shell | | **✔** | ✔ (`cacheComponents`) |
| F3 consent check serial/oversized/every-nav | | **✔** | |
| F4 `getClaims` request-memo | | **✔** | |
| §1.2 #4 inbox O(all msgs) restructure | | **✔** | |
| §1.2 #6/#7 limits + parallel awaits | | **✔** | |

---

## §5 · Honest limits of this measurement

- The **authenticated `/protected` render time** (§0.3 non-bold rows) is **decomposed, not directly clocked** — measuring it end-to-end needs a live member session, which read-only + not-my-account precludes. The *parts* (co-located RTT, local `getClaims`, empty tables, 120 ms redirect base, +600 ms cold) are all measured; the assembly is inference.
- Vercel's log view exposed request/cache state (`PRERENDER`/`HIT`/`MISS`) but **not per-function execution duration**, so cold-vs-warm is quantified from **client TTFB samples**, not server self-timing.

## §6 · Reproduce / confirm (for whoever sequences fixes)

- **Confirm token alg (settles the auth asterisk):** in an authed browser, DevTools → Application → Cookies → copy the `…-auth-token` access token → decode the header at jwt.io (or `cut -d. -f1 | base64 -d`). `ES256` = local verify (floor excludes auth, as diagnosed); `HS256` = add per-nav `getUser` network to the floor.
- **Clock the real authed floor:** add `Server-Timing` headers in the proxy/layout (or read function duration in the Vercel dashboard's Observability tab) and navigate between two trivial `/protected` pages — compare first-click-after-idle (cold) vs rapid clicks (warm).
- **Cold-start lever check:** Vercel Project → Settings → **Fluid Compute** (on/off?) and Functions region (should stay `pdx1` to match Supabase `us-west-2`).

*READ-ONLY — measured, not optimized. Nothing here is implemented; the author of the fix sequences it.*
