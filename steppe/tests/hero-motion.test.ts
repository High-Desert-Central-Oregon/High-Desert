import { describe, expect, it } from "vitest";
import { shouldAnimateSky } from "@/lib/hero-motion";

describe("optional night-sky motion", () => {
  const baseline = { reducedMotion: false, online: true };
  it("allows a fast connection and browsers without connection information", () => {
    expect(shouldAnimateSky(baseline)).toBe(true);
    expect(
      shouldAnimateSky({
        ...baseline,
        connection: { effectiveType: "4g", downlink: 10 },
      }),
    ).toBe(true);
  });
  it.each([
    { reducedMotion: true },
    { online: false },
    { connection: { saveData: true } },
    { connection: { effectiveType: "slow-2g" } },
    { connection: { effectiveType: "2g" } },
    { connection: { effectiveType: "3g" } },
    { connection: { downlink: 1 } },
    { connection: { rtt: 700 } },
    { responseTime: 1800 },
  ])("keeps the static fallback for %j", (setting) => {
    expect(shouldAnimateSky({ ...baseline, ...setting })).toBe(false);
  });
});
