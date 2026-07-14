# PWA session persistence — why `start_url` is `/protected`, not `/`

**TL;DR:** the installed-app manifest sets `start_url: '/protected'` on purpose.
Do not change it back to `/`. Opening the app must land on a route the auth
proxy processes, so the **server** re-establishes the session on launch.

## The constraint

Steppe authenticates with Supabase magic links. `@supabase/ssr`'s browser client
stores the session in **cookies with `httpOnly: false`** (they must be readable by
client-side JavaScript), written via `document.cookie`. Its nominal lifetime is
long (400 days).

On **iOS Safari and installed standalone PWAs**, Apple's Intelligent Tracking
Prevention (ITP) overrides that lifetime: cookies that are **script-writable**
(set via `document.cookie`, or any JS-readable cookie) are capped — historically a
7-day cap, plus eviction after ~7 days of no interaction with the site. So the
client-side session silently disappears, and the member is bounced back to the
magic-link screen. This looks like "login keeps recurring." `httpOnly` cannot be
flipped to `true` — the browser client has to read these cookies — so we cannot
escape the cap purely client-side.

## The defense

The durable session cookies are the ones the **server** sets in the HTTP response.
`lib/supabase/proxy.ts` (`updateSession`, wired as the Next.js proxy/middleware)
calls `getClaims()` and re-sets the auth cookies on every request it processes.
Server-set cookies on each app open reset the clock and keep the session alive far
better than relying on the client-side timer alone.

But the proxy **short-circuits the public marketing routes** — `/`, `/join`,
`/privacy`, `/partners`, `/preview`, the QR shortlinks, etc. — returning before it
ever creates a Supabase client (public requests make zero auth/DB calls, by
design). **`/` therefore never refreshes the session.**

If the PWA opened on `/`, launching the installed app would do no session work at
all; the session would only get refreshed once the member happened to navigate
into `/protected/*` — by which point the client-side cookie may already be gone.

**So `start_url` must be a proxy-processed route.** `/protected` is that route:
opening the app runs `updateSession`, which silently refreshes and re-sets the
session cookies before any content renders.

## Unauthenticated open is safe (verified)

Opening `/protected` without a session does **not** error:

- **Live** (`LAUNCH_PHASE=live`): the proxy finds no user and redirects to
  `/auth/login`, which renders the magic-link form (an anonymous-safe server
  component — it reads only the locale dictionary, no session call). After the
  link is clicked, `/auth/confirm?next=/protected` verifies the OTP and forwards
  back to `/protected`. Clean round trip.
- **Prelaunch** (`LAUNCH_PHASE` unset/≠`live`): the proxy's launch gate redirects
  `/protected` to `/` (the landing). Also clean — no 500.

No path from an unauthenticated app-open produces an error or a 500.

## Related config (not changed here)

The access-token (JWT) expiry and refresh-token rotation settings live in the
Supabase dashboard (Authentication → Sessions/JWT), not in this repo. A short JWT
expiry widens the "expired while the app was closed" window and makes the above
worse; raising it is a complementary dashboard change, tracked separately.
