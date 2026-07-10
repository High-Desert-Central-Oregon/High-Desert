# Vercel Portability Audit — Steppe

**Date:** 2026-06-22
**Scope:** Read-only investigation of `steppe/` (Next.js 16 App Router, Supabase,
currently on Vercel). Goal: enumerate any dependence on Vercel-proprietary behavior
so a future move to a self-hosted Next.js container (`output: 'standalone'`, behind a
reverse proxy) is a known quantity. **No application code, config, schema, or
dependencies were changed.** Remediation is out of scope for this pass.

Supabase is slated to be self-hosted later too, so Supabase coupling is explicitly
**not** treated as a portability risk — client-init patterns are listed for
completeness only.

---

## Summary

**Verdict: minor work.** The app is already close to host-agnostic by design (see
[DEPLOYMENT.md](../DEPLOYMENT.md), which already commits to "nothing below is
Vercel-specific"). The dependency tree is clean of every `@vercel/*` SDK, there is no
edge runtime anywhere, no `vercel.json` (so no platform crons/rewrites/redirects/headers),
no `next/image`/image-optimizer coupling, no platform geo/IP usage, and no `waitUntil`.

There is exactly **one** line of genuinely Vercel-proprietary code (`process.env.VERCEL_URL`).
The remaining work is not about *removing Vercel coupling* — it's about *adding the
standalone build wiring* that Vercel does for you implicitly: turning on
`output: 'standalone'`, making sure a runtime-read content file gets traced into the
container, copying `public/` + `.next/static`, and supplying a self-host site-URL env var.

**Tally:** **2 blockers** (both conditional on enabling standalone output, not on Vercel
removal) · **3 conveniences to replace** · several notes. No edge-runtime rewrites, no
SDK removals, no architectural changes required.

---

## Findings table

| # | File:line | What it is | Category | Portability impact |
|---|-----------|------------|----------|--------------------|
| 1 | [next.config.ts](../steppe/next.config.ts#L4-L6) | `output: 'standalone'` is **not** set (only `cacheComponents: true`) | **BLOCKER** | No self-hostable minimal build artifact is produced today. Required for the container goal. |
| 2 | [app/(site)/legal/privacy/page.tsx:83-86](../steppe/app/(site)/legal/privacy/page.tsx#L83-L86) | Runtime `fs.readFileSync(process.cwd() + "content/legal/privacy.md")` | **BLOCKER** | `content/` sits outside the route graph; standalone tracing may not copy it → runtime `ENOENT` on the privacy page in the container. Needs `outputFileTracingIncludes` or a static import. |
| 3 | [app/layout.tsx:49-51](../steppe/app/layout.tsx#L49-L51) | `process.env.VERCEL_URL` builds `metadataBase` | **REPLACE** | Only true Vercel coupling. Unset off-Vercel → falls back to `http://localhost:3000`, breaking canonical/OG URLs in prod. Replace with a generic site-URL env var. |
| 4 | [app/protected/*/actions.ts](../steppe/app/protected/governance/actions.ts#L73) (many: verify, neighborhoods, groups, governance, review, events, moderation) | `revalidatePath(...)` across ~30 call sites | **REPLACE** | Portable Next.js API; works against the local cache in a single container. Multiple replicas would not share invalidations — name a shared cache handler if scaling out. |
| 5 | [app/api/weather/route.ts:44](../steppe/app/api/weather/route.ts#L44) | `fetch(..., { next: { revalidate: 600 } })` (Data Cache) | **REPLACE** | Same as #4: fine single-container; needs a shared `cacheHandler` if multi-replica. The `Cache-Control` `s-maxage` ([:66](../steppe/app/api/weather/route.ts#L66)) assumes a shared CDN that you'd now own. |
| 6 | [app/api/contact/route.ts:25-35](../steppe/app/api/contact/route.ts#L25-L35) | Module-scope `Map` in-memory rate limiter | NOTE | Per-instance state. Single container is *more* reliable than serverless here; not shared across replicas. Comment already acknowledges this. |
| 7 | [app/api/contact/route.ts:67-69](../steppe/app/api/contact/route.ts#L67-L69) | Reads `x-forwarded-for` for client IP | NOTE | Standard proxy header, **not** `x-vercel-*`. Portable as long as the reverse proxy sets it. |
| 8 | [proxy.ts](../steppe/proxy.ts) + [lib/supabase/proxy.ts](../steppe/lib/supabase/proxy.ts) | Next 16 middleware (renamed `middleware.ts`→`proxy.ts`); LAUNCH_PHASE gate | NOTE | Standard middleware, default Node runtime, **no** edge APIs. `LAUNCH_PHASE` gate ([proxy.ts:38-44](../steppe/lib/supabase/proxy.ts#L38-L44)) is plain `process.env` logic. Fully portable. |
| 9 | [next.config.ts:5](../steppe/next.config.ts#L5) | `cacheComponents: true` (Next 16 / dynamicIO) | NOTE | A Next.js feature, not a Vercel feature — portable. It forbids `export const runtime` pins (see weather/contact route comments), which is why none exist. |
| 10 | [lib/supabase/{server,client,admin,proxy}.ts](../steppe/lib/supabase/server.ts#L13-L14) | Supabase init from env (`NEXT_PUBLIC_SUPABASE_URL`, publishable key, `SUPABASE_SERVICE_ROLE_KEY`) | NOTE | Completeness only — no hardcoded URLs; all env-driven. Self-host-ready. |
| 11 | [lib/contact.ts:30-40](../steppe/lib/contact.ts#L30-L40) | Resend via `RESEND_API_KEY` / `CONTACT_FROM` / `CONTACT_TO`, reached over `fetch` | NOTE | External SaaS over HTTPS; host-agnostic. Degrades cleanly when unset. |
| 12 | [package.json](../steppe/package.json#L42-L55) | No `engines`, no `packageManager`, no `.nvmrc`/`.node-version` | NOTE | Node version unpinned (docs say Node 26/npm 11). Pin for reproducible container builds. |
| 13 | Verification uploads → [verify-form.tsx:67-69](../steppe/app/protected/verify/verify-form.tsx#L67-L69), [review/actions.ts](../steppe/app/protected/review/actions.ts#L33) | Evidence files go to **Supabase Storage**, not local disk | NOTE | No local-filesystem write state to lose in a container. Portable. |

### Categories where nothing was found (absence of coupling is the finding)

- **`@vercel/*` dependencies:** none. `grep` of `package.json` and `package-lock.json` is
  clean (analytics, og, kv, blob, postgres, speed-insights, functions — all absent).
- **`runtime = "edge"` / edge-only APIs:** none anywhere in `app/` or `lib/`.
- **`waitUntil` / `@vercel/functions`:** none.
- **Vercel request headers (`x-vercel-ip-*`, platform `geo`/`ip`):** none. The only header
  read is the standard `x-forwarded-for` (#7).
- **`process.env.VERCEL*`:** exactly one reference — `VERCEL_URL` (#3). No
  `VERCEL_ENV`, `VERCEL_REGION`, etc.
- **`vercel.json`:** does not exist → no platform crons, rewrites, redirects, headers, or
  region pins to port. `next.config.ts` defines no `redirects()`/`rewrites()`/`headers()` either.
- **`next/image` / image optimizer:** no imports anywhere. Static icons in
  [public/](../steppe/public) are plain files. No `images`/`remotePatterns`/`loader` config
  needed because the optimizer is unused.
- **Local filesystem *write* state:** none. The only `fs` use is the read at #2; uploads go
  to Supabase Storage (#13).

---

## Standalone-output readiness

To produce a self-hostable container build, concretely:

1. **Enable standalone output.** Add `output: 'standalone'` to
   [next.config.ts](../steppe/next.config.ts). This emits `.next/standalone/` with a minimal
   `server.js` and a pruned `node_modules`.
2. **Trace the runtime-read content file.** `app/(site)/legal/privacy/page.tsx` reads
   `content/legal/privacy.md` at request time via `process.cwd()`. Standalone tracing keys
   off the module graph and may not copy a sibling `content/` dir. Either:
   - add `outputFileTracingIncludes: { '/legal/privacy': ['./content/**'] }` to the config, or
   - convert the read to a static `import` of the markdown so it's bundled.
   The file *is* git-tracked, so it's available at build time — the risk is purely tracing.
3. **Copy the assets standalone omits.** `.next/standalone` does **not** include
   `public/` or `.next/static`. The container/Dockerfile must copy both next to `server.js`
   (standard Next standalone step), or the icons and static chunks 404.
4. **Pin the runtime.** Add `.nvmrc`/`engines` (and optionally `packageManager`) so the
   image uses a known Node (current LTS 20/22; docs reference Node 26). See finding #12.
5. **Supply env at container runtime:** `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `CONTACT_FROM`, `CONTACT_TO`, `LAUNCH_PHASE`, and the new site-URL var replacing
   `VERCEL_URL` (#3). `NEXT_PUBLIC_*` must be present **at build time** (they inline).
6. **Reverse proxy must forward** `x-forwarded-for` / `x-forwarded-host` / `x-forwarded-proto`
   so the contact rate-limiter (#7) and Next's URL inference behave behind the proxy.

Nothing here requires touching the runtime model (no edge→node migration, no SDK swaps).

---

## Vercel conveniences we'd own ourselves

| Convenience | Today (Vercel) | Self-hosted equivalent (named, not implemented) |
|-------------|----------------|--------------------------------------------------|
| **ISR / `revalidatePath` / Data Cache** (#4, #5) | Vercel's managed cache + cross-instance invalidation | Default file-system cache works for a **single** container. For >1 replica, configure a Next `cacheHandler` backed by shared storage (e.g. Redis) so revalidations propagate. |
| **CDN edge cache** (weather `s-maxage`, #5) | Vercel edge network honors `s-maxage`/`stale-while-revalidate` | Put a CDN/reverse-proxy cache (Cloudflare, Fastly, or nginx `proxy_cache`) in front; otherwise those response headers are advisory only. |
| **Image optimization** | Vercel optimizer | **N/A** — app uses no `next/image`. If introduced later, self-hosting needs `sharp` in the image (default) or `images.unoptimized`/a custom loader. |
| **Cron jobs** | (none configured) | **N/A** — no `vercel.json` crons exist. Any future scheduled work needs host cron/systemd-timer/queue. |
| **Geo / IP** | (not used) | **N/A** — app derives nothing from platform geo. Client IP comes from `x-forwarded-for`, which the reverse proxy supplies. |
| **`VERCEL_URL` auto-domain** (#3) | Injected per-deploy | Set an explicit `NEXT_PUBLIC_SITE_URL` (or similar) env var for `metadataBase`. |

---

## Remediation appendix (future passes — recommendations only, no changes made)

Ordered, each scoped to a single DCO-signed commit:

1. **Replace `VERCEL_URL` with a host-agnostic site URL.** In
   [app/layout.tsx:49-51](../steppe/app/layout.tsx#L49-L51), read e.g.
   `process.env.NEXT_PUBLIC_SITE_URL` with a sane prod default; document it in
   `.env.example` and `DEPLOYMENT.md`. (Removes the last Vercel-proprietary reference.)
2. **Enable `output: 'standalone'`** in [next.config.ts](../steppe/next.config.ts) and
   verify a clean `next build` produces `.next/standalone`.
3. **Guarantee the privacy markdown is traced** — add `outputFileTracingIncludes` for
   `content/**` (or switch the read at
   [privacy/page.tsx:83](../steppe/app/(site)/legal/privacy/page.tsx#L83) to a static import).
   Smoke-test the `/legal/privacy` route inside the built standalone output.
4. **Add a Dockerfile** that builds, then copies `.next/standalone`, `.next/static`, and
   `public/` into the runtime image; runs `node server.js`. (No app code change.)
5. **Pin the Node runtime** — add `.nvmrc` and/or `engines` to
   [package.json](../steppe/package.json) matching the image (finding #12).
6. **Document the reverse-proxy contract** in `DEPLOYMENT.md`: required forwarded headers,
   and the `s-maxage`/CDN expectation for [api/weather](../steppe/app/api/weather/route.ts#L66).
7. **(Only if scaling past one container)** Add a shared `cacheHandler` and a durable
   rate-limiter store so `revalidatePath` (#4) and the contact limiter (#6) work across
   replicas. Single-container launch does **not** need this — log the decision rather than
   build it prematurely.
