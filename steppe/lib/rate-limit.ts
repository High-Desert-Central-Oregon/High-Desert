/** Best-effort per-process limits. Shared durable mail admission is separate. */
const WINDOW_MS = 10 * 60_000;
const DEFAULT_MAX = 6;
const MAX_KEYS = 4096;
const MAX_KEY_LENGTH = 256;
const MAX_HITS = 1000;
const hits = new Map<string, number[]>();
let nextSweep = 0;

/** Sliding window; rejected hits never allocate another timestamp or key. */
export function rateLimited(key: string, max: number = DEFAULT_MAX): boolean {
  if (!key || key.length > MAX_KEY_LENGTH || !Number.isInteger(max) || max < 1 || max > MAX_HITS) return true;
  const now = Date.now();
  if (now >= nextSweep || hits.size >= MAX_KEYS) {
    for (const [storedKey, times] of hits) {
      if (now - times[times.length - 1] >= WINDOW_MS) hits.delete(storedKey);
    }
    nextSweep = now + 60_000;
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) return true;
  // Never evict live budgets to admit new attackers: fail closed at capacity.
  if (!hits.has(key) && hits.size >= MAX_KEYS) return true;
  recent.push(now);
  hits.set(key, recent);
  return false;
}

/** First forwarded hop; bounded, ephemeral, never logged or persisted. */
export function clientIp(request: Request): string {
  const value = (request.headers.get("x-forwarded-for") ?? "").split(",", 1)[0].trim();
  return value.length <= 64 && /^[0-9a-fA-F:.]+$/.test(value) ? value : "unknown";
}
