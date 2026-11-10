import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
let limiter: typeof import("@/lib/rate-limit");
beforeEach(async () => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(1_000_000); limiter = await import("@/lib/rate-limit"); });
afterEach(() => vi.useRealTimers());
describe("bounded public request limits", () => {
  it("rejects churn at capacity without resetting live callers, then expires entries", () => {
    for (let n = 0; n < 4096; n++) expect(limiter.rateLimited(`key:${n}`, 1)).toBe(false);
    for (let n = 0; n < 2000; n++) expect(limiter.rateLimited(`extra:${n}`, 1)).toBe(true);
    expect(limiter.rateLimited("key:0", 1)).toBe(true);
    vi.advanceTimersByTime(600_000);
    expect(limiter.rateLimited("extra:new", 1)).toBe(false);
    expect(limiter.rateLimited("key:0", 1)).toBe(false);
  });
  it("does not retain rejected hits or extend their expiry", () => {
    expect(limiter.rateLimited("caller", 1)).toBe(false);
    vi.advanceTimersByTime(599_999);
    for (let n = 0; n < 10000; n++) expect(limiter.rateLimited("caller", 1)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(limiter.rateLimited("caller", 1)).toBe(false);
  });
  it("preserves caller budgets and independent namespaces", () => {
    for (const [key, max] of [["invite:x", 5], ["pledge:x", 6], ["neighborhood-address:x", 30], ["locations:x", 120], ["pledge:global", 600]] as const) {
      for (let n = 0; n < max; n++) expect(limiter.rateLimited(key, max)).toBe(false);
      expect(limiter.rateLimited(key, max)).toBe(true);
    }
  });
  it("rejects overlong keys and bounds untrusted forwarded headers", () => {
    expect(limiter.rateLimited("x".repeat(257))).toBe(true);
    expect(limiter.clientIp(new Request("https://example.test", { headers: { "x-forwarded-for": "x".repeat(1000) } }))).toBe("unknown");
    expect(limiter.clientIp(new Request("https://example.test", { headers: { "x-forwarded-for": "2001:db8::1, 192.0.2.1" } }))).toBe("2001:db8::1");
  });
});
