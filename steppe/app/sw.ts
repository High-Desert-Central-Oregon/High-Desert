/// <reference lib="webworker" />
// Steppe service worker — deliberately minimal.
//
// WHY THIS EXISTS. Chrome only mints an Android WebAPK (a real installed app,
// not the degraded "add to home screen" shortcut) when the site serves a web
// app manifest AND registers a service worker that has a fetch handler. This
// file is that fetch handler and nothing more. It is NOT an offline layer and
// deliberately builds no offline UX (see docs/pwa-service-worker.md).
//
// SAFETY CONTRACT. This SW ships to every member's browser, so it is written to
// be incapable of breaking auth or serving stale UI:
//   • It caches NOTHING. No precache, no runtime cache. `precacheEntries` is
//     empty by construction — next.config.ts excludes every file from the
//     precache manifest, so `self.__SW_MANIFEST` injects as `[]`.
//   • The only request it handles is a same-origin top-level *navigation* to a
//     PUBLIC route, handled NetworkOnly — a straight pass-through to the
//     network. The member always gets the current server response, so a new
//     deploy can never be shadowed by a stale cached shell.
//   • It never touches auth/session traffic. Navigations to /auth, /protected,
//     /welcome (the consent gate — session-bearing and server-redirected),
//     /api, /cal and the /c /d /e /p /q /s shortlinks are NOT matched, so the SW
//     never calls respondWith for them — they reach the network exactly as if
//     no SW were installed. In particular the manifest's start_url '/protected'
//     is excluded, so opening the installed app still hits the Next proxy
//     (lib/supabase/proxy.ts → updateSession), which re-sets the Supabase
//     session cookies on launch. See docs/pwa-session-persistence.md.
//   • Cross-origin traffic (Supabase api.*.supabase.co, the auth token refresh)
//     is never same-origin, so it is never matched either.
//
// UPDATE PATH / KILL SWITCH. skipWaiting + clientsClaim make a newly deployed
// SW supersede the old one on the next visit instead of waiting for every tab
// to close — a bad SW is replaceable, not stuck. This is safe precisely because
// nothing is cached: there is no stale asset set to skew. To force-remove the
// SW from members entirely, deploy the unregistering stub documented in
// docs/pwa-service-worker.md.
import { NetworkOnly, Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next. Empty by construction (see the
    // `exclude` option in next.config.ts). Referenced here only so the injector
    // has a splice point; the SW precaches nothing.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Routes the SW must never intercept: anything auth/session-bearing or
// server-redirected. These fall through to the browser's own networking, so
// behaviour is byte-for-byte identical to having no SW installed. Keep this in
// sync with the public/gated split in lib/supabase/proxy.ts.
const NEVER_INTERCEPT = /^\/(auth|protected|welcome|api|cal|c|d|e|p|q|s)(?:\/|$)/;

const serwist = new Serwist({
  // Empty precache (see __SW_MANIFEST note above). Present so @serwist/next has
  // its injection point.
  precacheEntries: self.__SW_MANIFEST,
  // A bad SW must be replaceable, not stuck in members' browsers: take over
  // immediately on update rather than waiting for all tabs to close. Safe here
  // only because we cache nothing — there is no stale asset set to skew.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // The ONLY thing this SW handles: public same-origin page navigations,
      // always straight from the network (never cached → never stale). This is
      // what registers the fetch handler Chrome requires for installability.
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        request.mode === "navigate" &&
        !NEVER_INTERCEPT.test(url.pathname),
      handler: new NetworkOnly(),
    },
  ],
});

serwist.addEventListeners();
