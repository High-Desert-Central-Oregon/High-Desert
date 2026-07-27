import { describe, it, expect, afterEach, vi } from "vitest";
import { siteOrigin, durableOrigin, CANONICAL_ORIGIN } from "@/lib/site-url";

/**
 * A pledge confirmation went out containing
 * `https://high-desert-<hash>-<account>.vercel.app/n/wildflower`.
 *
 * That URL expires with the deployment and leaks the old project name to every
 * recipient. The cause: siteOrigin() falls back to VERCEL_URL, and
 * NEXT_PUBLIC_SITE_URL was not set on the production deployment — so a missing
 * environment variable was enough to put an ephemeral hostname in front of a
 * member, permanently, in something they keep.
 *
 * These tests pin the split. siteOrigin() may still be self-referential, because
 * OG metadata on a preview deploy should describe that preview. durableOrigin()
 * may not be, ever — it is what email and calendar entries use.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("durableOrigin — for URLs that outlive the request", () => {
  it("uses the canonical origin when NEXT_PUBLIC_SITE_URL is unset (the prod misconfiguration)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "high-desert-qy8ot75yj-gchism94s-projects.vercel.app");
    expect(durableOrigin()).toBe(CANONICAL_ORIGIN);
  });

  it("NEVER returns a deployment hostname, whatever VERCEL_URL says", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    for (const host of [
      "high-desert-qy8ot75yj-gchism94s-projects.vercel.app",
      "steppe-git-some-branch-someone.vercel.app",
    ]) {
      vi.stubEnv("VERCEL_URL", host);
      expect(durableOrigin()).not.toContain("vercel.app");
      expect(durableOrigin()).toBe(CANONICAL_ORIGIN);
    }
  });

  it("rejects NEXT_PUBLIC_SITE_URL if it is itself pointed at a deployment host", () => {
    // Belt and braces: setting the knob to a preview URL would reintroduce the
    // exact bug through the exact variable meant to prevent it.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://steppe-git-preview-x.vercel.app");
    expect(durableOrigin()).toBe(CANONICAL_ORIGIN);
  });

  it("honours a deliberately configured origin — the knob still works", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3100");
    expect(durableOrigin()).toBe("http://localhost:3100");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.steppe.community");
    expect(durableOrigin()).toBe("https://staging.steppe.community");
  });

  it("strips a trailing slash so joined paths never double up", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.steppe.community/");
    expect(durableOrigin()).toBe("https://www.steppe.community");
    expect(`${durableOrigin()}/n/wildflower`).toBe(
      "https://www.steppe.community/n/wildflower",
    );
  });

  it("falls back rather than emitting an unparseable value", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    expect(durableOrigin()).toBe(CANONICAL_ORIGIN);
  });
});

describe("siteOrigin — self-referential, deliberately", () => {
  it("still follows VERCEL_URL so a preview deploy describes itself", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "steppe-git-preview-x.vercel.app");
    // This is correct for OG metadata; it is why the two functions are separate
    // rather than one being "fixed".
    expect(siteOrigin()).toBe("https://steppe-git-preview-x.vercel.app");
  });
});
