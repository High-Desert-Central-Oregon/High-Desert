/**
 * Which neighborhood slugs are running a pledge campaign — the list the proxy
 * uses to answer an unknown /n/ URL with a real 404.
 *
 * WHY THIS EXISTS AT ALL. A 404 status has to be decided before the response is
 * committed. Under cacheComponents every uncached read must sit behind
 * <Suspense>, so by the time the page could check a slug, Next has already
 * flushed a shell with a 200 and notFound() can only change the body. The two
 * route segment configs that would express "this param does not exist"
 * (`dynamic`, `dynamicParams`) are BOTH rejected outright by cacheComponents,
 * and generateStaticParams without dynamicParams still renders unknown params on
 * demand. That leaves the proxy as the only layer that can still set a status.
 *
 * Deliberately edge-safe and dependency-light: no next/headers, no cookies, no
 * service key. `neighborhoods` is anon-readable, so the publishable key is
 * enough, and the query returns nothing but slugs.
 *
 * FAILS OPEN, ALWAYS. If the lookup errors or is unconfigured this reports
 * "don't know" and the proxy lets the request through to the page, which
 * behaves exactly as it did before this gate existed. The failure mode of
 * failing CLOSED would be 404-ing live neighborhoods — every printed QR code,
 * mailer, and yard sign for that campaign dead — because of a transient
 * database blip. A soft 404 on an already-invalid URL is a far cheaper wrong
 * answer than a hard 404 on a valid one.
 */

/** How long a fetched list is trusted. Campaigns are opted in by hand, rarely. */
const TTL_MS = 60_000;

type Snapshot = { at: number; slugs: Set<string> };

let cache: Snapshot | null = null;
// Collapses a thundering herd on cold start: many concurrent requests share one
// query rather than each issuing their own.
let inflight: Promise<Set<string> | null> | null = null;

async function fetchSlugs(): Promise<Set<string> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  try {
    // Plain REST rather than supabase-js: this runs on every /n/ request in the
    // proxy, and the query is one filtered column. Pulling the client in here
    // would cost more than the request it serves.
    const res = await fetch(
      `${url}/rest/v1/neighborhoods?select=slug&threshold=not.is.null`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // The TTL below is the cache; don't let the platform add another layer
        // with different semantics.
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ slug?: unknown }>;
    if (!Array.isArray(rows)) return null;
    return new Set(
      rows
        .map((r) => r.slug)
        .filter((s): s is string => typeof s === "string"),
    );
  } catch {
    return null;
  }
}

/**
 * Reports whether `slug` names a live campaign.
 *
 * Returns `null` for "could not determine" — callers MUST treat that as
 * permission to continue, never as a refusal.
 */
export async function isCampaignSlug(slug: string): Promise<boolean | null> {
  const now = Date.now();

  if (cache && now - cache.at < TTL_MS) {
    return cache.slugs.has(slug);
  }

  if (!inflight) {
    inflight = fetchSlugs().finally(() => {
      inflight = null;
    });
  }
  const slugs = await inflight;

  if (!slugs) {
    // Serve a stale snapshot if we have one — an expired list is far better
    // evidence than none, and this keeps a database blip from disabling the
    // gate entirely.
    return cache ? cache.slugs.has(slug) : null;
  }

  cache = { at: now, slugs };
  return slugs.has(slug);
}

/** Test seam: drop the memoized list so a case starts from a known state. */
export function __resetCampaignSlugCache() {
  cache = null;
  inflight = null;
}
