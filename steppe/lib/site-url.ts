/**
 * Canonical site origin — one source for every absolute URL the app hands
 * out (OG metadata, calendar feed URLs). Prefer the explicit
 * NEXT_PUBLIC_SITE_URL (https://www.steppe.community in prod) so shared
 * links resolve to the real domain, not the *.vercel.app machine name;
 * VERCEL_URL remains the fallback so preview deploys stay self-referential.
 */
export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
}
