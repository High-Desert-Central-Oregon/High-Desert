/**
 * Where absolute URLs point.
 *
 * Two functions, because there are two different questions, and conflating them
 * put an expiring deployment hostname into a confirmation email:
 *
 *   siteOrigin()    — "where am I running?"  Self-referential. Right for OG
 *                     metadata and anything scoped to the current request, so a
 *                     preview deploy describes itself rather than production.
 *
 *   durableOrigin() — "where will this still resolve next year?"  Right for any
 *                     URL that OUTLIVES the request that made it: an email body,
 *                     a calendar entry, anything printed. These are copied,
 *                     forwarded, and pasted into other people's software, long
 *                     after the deployment that generated them is gone.
 *
 * The distinction is not theoretical. A pledge confirmation went out with
 * `https://high-desert-<hash>-<account>.vercel.app/n/wildflower` in it, because
 * siteOrigin() falls back to VERCEL_URL and NEXT_PUBLIC_SITE_URL was not set on
 * the production deployment. That URL expires, and it leaks the old project name
 * to every recipient.
 */

/**
 * The canonical public origin, as a literal.
 *
 * Deliberately not env-derived. Everything else here is configuration that can
 * be wrong or missing; this is the answer when it is. The same origin is already
 * hardcoded in lib/email-shell.mjs for the brand seal, so this names it once
 * instead of leaving it scattered.
 */
export const CANONICAL_ORIGIN = "https://www.steppe.community";

/** An ephemeral per-deployment host — correct for previews, never for email. */
function isEphemeral(origin: string): boolean {
  return /\.vercel\.app$/i.test(new URL(origin).hostname);
}

function normalize(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/**
 * Self-referential origin: the explicit NEXT_PUBLIC_SITE_URL, else this
 * deployment's own hostname, else localhost. Use for OG metadata and
 * request-scoped links — NOT for anything that gets emailed or saved.
 */
export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ? normalize(process.env.NEXT_PUBLIC_SITE_URL)
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
}

/**
 * Origin for URLs that outlive the request. NEVER falls back to VERCEL_URL.
 *
 * NEXT_PUBLIC_SITE_URL is still the knob — set it to a localhost or staging
 * origin and durable links follow it, which is what you want when testing the
 * flow somewhere other than production. But an UNSET variable resolves to the
 * canonical origin rather than to whatever machine happens to be serving, so a
 * missing environment variable can no longer put an expiring hostname in front
 * of a member. A variable accidentally pointing AT a deployment host is
 * rejected for the same reason.
 */
export function durableOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return CANONICAL_ORIGIN;
  try {
    return isEphemeral(configured) ? CANONICAL_ORIGIN : normalize(configured);
  } catch {
    // Unparseable value — treat exactly like unset rather than emitting it.
    return CANONICAL_ORIGIN;
  }
}
