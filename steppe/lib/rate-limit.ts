/**
 * Best-effort in-memory rate limiting for public POST endpoints.
 *
 * Per serverless instance, resetting on cold start, and deliberately without a
 * new dependency — a durable limiter would need shared storage this project
 * does not run. It is the same shape already in app/api/contact/route.ts,
 * lifted here so the pledge routes can share it and so it can be tested without
 * dragging a database client along.
 *
 * Be honest about what this stops. It handles casual noise, a double-tapped
 * submit button, and a naive script from one address. It does not stop a
 * determined actor with many IPs, and it is not pretending to.
 */

const WINDOW_MS = 10 * 60_000;
const DEFAULT_MAX = 6;

const hits = new Map<string, number[]>();

/**
 * Records a hit for `key` and reports whether it has now exceeded `max` within
 * the window. Key it as narrowly as the abuse you are limiting — the pledge
 * route uses (ip, neighborhood) so that pledging to one neighborhood cannot
 * spend the allowance for another.
 */
export function rateLimited(key: string, max: number = DEFAULT_MAX): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

/**
 * First hop of X-Forwarded-For, or "unknown". Used ONLY as a rate-limit key —
 * never stored, never logged, never associated with an address.
 */
export function clientIp(request: Request): string {
  return (
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown"
  );
}
