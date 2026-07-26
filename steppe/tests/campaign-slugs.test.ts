import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isCampaignSlug, __resetCampaignSlugCache } from "@/lib/campaign-slugs";

/**
 * The proxy's slug gate — what turns an unknown /n/ URL into a real 404.
 *
 * Hermetic: fetch and the env are stubbed, so this runs with no database and no
 * network. What it pins is the failure behaviour, because that is where this
 * function can do real damage. Failing CLOSED would 404 live neighborhoods —
 * every printed QR code, mailer, and yard sign for that campaign dead — over a
 * transient blip. So "could not determine" must always come back as null, and
 * the proxy must read null as permission to continue.
 */

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

function okResponse(slugs: string[]) {
  return {
    ok: true,
    json: async () => slugs.map((slug) => ({ slug })),
  } as unknown as Response;
}

beforeEach(() => {
  __resetCampaignSlugCache();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ENV.NEXT_PUBLIC_SUPABASE_URL);
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  __resetCampaignSlugCache();
});

describe("isCampaignSlug", () => {
  it("recognises a live campaign and rejects a neighborhood without one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(["canyon-rim", "north-rim"])));
    expect(await isCampaignSlug("canyon-rim")).toBe(true);
    // Seeded, real, but not running a campaign — refused identically to a slug
    // that does not exist, so there is no browsable directory.
    expect(await isCampaignSlug("braydon-park")).toBe(false);
    expect(await isCampaignSlug("not-a-neighborhood-at-all")).toBe(false);
  });

  it("returns false for every slug when there are genuinely zero campaigns", async () => {
    // Distinct from "could not read": an empty list is a real answer, and every
    // /n/ URL correctly 404s.
    vi.stubGlobal("fetch", vi.fn(async () => okResponse([])));
    expect(await isCampaignSlug("canyon-rim")).toBe(false);
  });

  it("FAILS OPEN when the lookup throws — never 404s a live neighborhood", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    expect(await isCampaignSlug("canyon-rim")).toBeNull();
  });

  it("FAILS OPEN on a non-ok response and on malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    expect(await isCampaignSlug("canyon-rim")).toBeNull();

    __resetCampaignSlugCache();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ not: "an array" }),
    }) as unknown as Response));
    expect(await isCampaignSlug("canyon-rim")).toBeNull();
  });

  it("FAILS OPEN when the environment is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await isCampaignSlug("canyon-rim")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches, so the gate does not query on every request", async () => {
    const fetchSpy = vi.fn(async () => okResponse(["canyon-rim"]));
    vi.stubGlobal("fetch", fetchSpy);
    await isCampaignSlug("canyon-rim");
    await isCampaignSlug("north-rim");
    await isCampaignSlug("canyon-rim");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("collapses concurrent cold-start lookups into one query", async () => {
    const fetchSpy = vi.fn(async () => okResponse(["canyon-rim"]));
    vi.stubGlobal("fetch", fetchSpy);
    const results = await Promise.all([
      isCampaignSlug("canyon-rim"),
      isCampaignSlug("canyon-rim"),
      isCampaignSlug("other"),
    ]);
    expect(results).toEqual([true, true, false]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("serves a stale snapshot rather than nothing when a refresh fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(["canyon-rim"])));
    expect(await isCampaignSlug("canyon-rim")).toBe(true);

    // Expire the TTL, then make the refresh fail. An expired list is far better
    // evidence than none, so the gate keeps working.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 120_000);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("blip");
    }));
    expect(await isCampaignSlug("canyon-rim")).toBe(true);
    expect(await isCampaignSlug("unknown-slug")).toBe(false);
    vi.useRealTimers();
  });

  it("asks only for slugs, and only for rows that have a threshold", async () => {
    const fetchSpy = vi.fn(async () => okResponse(["canyon-rim"]));
    vi.stubGlobal("fetch", fetchSpy);
    await isCampaignSlug("canyon-rim");

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("select=slug");
    expect(url).toContain("threshold=not.is.null");
    // No address, no id, no count — this gate has no business reading anything else.
    expect(url).not.toMatch(/pledges|email/);
  });
});
