# PWA service worker — why it exists, what it deliberately does *not* do

**TL;DR:** `app/sw.ts` is a **minimal** service worker whose only job is to make
Steppe installable as a real Android app (a Chrome **WebAPK**, not the degraded
"add to home screen" shortcut). It caches **nothing**, never touches auth, and
can never serve a stale app shell. If it ever misbehaves, it is designed to be
**superseded on the next visit**, and there is a documented force-unregister
stub below.

## Why a service worker at all

Chrome only offers a real install (fires `beforeinstallprompt`, mints a WebAPK on
Android) when a page meets all of:

1. A valid web app manifest — name, 192px + 512px icons, `start_url`, and a
   standalone-ish `display`. Ours is `app/manifest.ts`, served at
   `/manifest.webmanifest`.
2. Served over HTTPS.
3. A registered **service worker with a `fetch` handler**.

We already had (1) and (2). Without (3), Android install degrades to a bookmark
shortcut. This SW supplies (3) — and nothing more than needed.

## The safety problem this had to avoid

A service worker runs in **every member's browser** and sits in front of **every
request**. A careless one is a login-breaking, deploy-shadowing bug:

- If it caches HTML, members can be pinned to a **stale app shell** after a
  deploy.
- If it caches or synthesizes an **auth/session** response, sign-in silently
  breaks — and a bad SW can get **stuck** in browsers for a long time.

So this SW is written to be *incapable* of those failures, not merely careful.

## What the SW actually does (`app/sw.ts`)

- **Caches nothing.** The precache manifest is empty by construction —
  `next.config.ts` sets `exclude: [/./]` (drops every build chunk) **and**
  `globPublicPatterns: []` (drops every `public/` file). `self.__SW_MANIFEST`
  injects as `[]`. There is no runtime cache either.
- **Handles exactly one thing:** a same-origin **top-level navigation** to a
  **public** route, served **NetworkOnly** (straight pass-through). Members
  always get the current server response, so a deploy can never be shadowed by a
  cached shell. This single route is also what registers the `fetch` handler
  Chrome requires for installability.
- **Never intercepts auth/session traffic.** Navigations matching
  `^/(auth|protected|api|cal|c|d|e|p|q)(/|$)` are **not matched**, so the SW does
  not call `respondWith` for them — they reach the network exactly as if no SW
  were installed. This is verified below.
- **Never touches Supabase.** `api.*.supabase.co` and the auth token refresh are
  cross-origin, so `sameOrigin` is false and they are never matched.

### `start_url: '/protected'` still works with the SW active

The manifest's `start_url` is `/protected` on purpose (see
`pwa-session-persistence.md`): opening the installed app must hit the Next proxy
(`lib/supabase/proxy.ts` → `updateSession`) so the **server** re-sets the Supabase
session cookies on launch. Because `/protected` is in the never-intercept set,
the SW leaves that navigation entirely to the network — the proxy runs, the
session refreshes, exactly as without a SW.

`/sw.js` and `/manifest.webmanifest` are allow-listed as static assets in
`updateSession` (before the auth/launch gate), so they load unauthenticated in
every launch phase — otherwise the gate would redirect them and install would
silently fail.

## Update path / kill switch

The SW uses `skipWaiting: true` + `clientsClaim: true`, so a newly deployed SW
**takes over on the next visit** instead of waiting for every tab to close. This
is safe here *because nothing is cached* — there is no asset-version skew for
`skipWaiting` to cause.

Normal recovery from a bad SW is therefore just: **deploy a fixed `app/sw.ts`.**
The next time a member opens the app, the new SW supersedes the old one.

### Force-unregister (nuclear option)

If you need to remove the SW from members entirely (not replace it), deploy a
`app/sw.ts` that unregisters itself and clears caches. On next visit it installs,
activates, unregisters, and reloads controlled clients:

```ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => "navigate" in c && c.navigate(c.url));
    })(),
  );
});
```

When shipping the stub, also set `globPublicPatterns: []`/`exclude: [/./]` as now,
or temporarily set `disable: true` in `next.config.ts` after the stub has rolled
through your members (a disabled build ships no SW and `@serwist/next` will not
re-register one).

An individual member can also self-recover in Chrome: **DevTools → Application →
Service workers → Unregister**, or `chrome://serviceworker-internals`.

## Build note: webpack, not Turbopack

`@serwist/next` compiles the SW with **webpack**, so `package.json`'s `build` runs
`next build --webpack`. Next 16 defaults to Turbopack; the baseline webpack build
was verified to work on this app before the SW was added. `next dev` stays on
Turbopack — the SW is `disable`d in development, so it never interferes with hot
reload or local auth debugging. The generated `public/sw.js` is git-ignored; the
source of truth is `app/sw.ts`.

## What was verified (2026-07-14)

Production build (`next build --webpack`) on this app, then:

- **Generated `public/sw.js`:** precache manifest is `[]` (caches nothing); one
  `fetch` handler; `skipWaiting`/`clientsClaim` present; the never-intercept
  regex compiled in.
- **Endpoints, `LAUNCH_PHASE=live`:** `/sw.js` → 200 `application/javascript`
  (not redirected); `/manifest.webmanifest` → 200 `application/manifest+json`;
  `/protected` → 307 → `/auth/login` (still gated — the proxy processes it);
  `/auth/login` → 200. **Prelaunch:** `/sw.js` and `/manifest.webmanifest` still
  200; `/protected` → 307 → `/` (launch gate).
- **Real Chrome (headless, CDP):** the SW **registers and activates**
  (`state: activated`, `scope: /`, `scriptURL: /sw.js`) and **controls** the page
  (`navigator.serviceWorker.controller` = `/sw.js`) — proving `sw.ts` has no
  runtime error and satisfies the "controlled page with a fetch handler" install
  criterion. With the SW active, `fetch('/protected', { redirect: 'manual' })`
  returns an **opaqueredirect** — the request hit the network and got the proxy's
  307, i.e. the SW did **not** cache or synthesize the auth response.

### Still requires a physical device to confirm

`beforeinstallprompt` firing, the WebAPK mint, opening standalone, and the full
signed-in session round-trip inside the installed app cannot be exercised
headless (they need Android Chrome + engagement heuristics). On an Android device
against a deployed HTTPS build, confirm: (a) install is offered / the app
installs; (b) it opens standalone; (c) sign in, background the app, reopen — the
session persists and there is no cached-auth breakage; (d) redeploy, reopen — the
new build is served (no stale shell).
