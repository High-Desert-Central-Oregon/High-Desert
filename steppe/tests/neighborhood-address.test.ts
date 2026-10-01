import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  coveredByNeighborhoodMap,
  photonAddresses,
} from "@/lib/neighborhood-address";
const m = vi.hoisted(() => ({ user: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/rate-limit", () => ({ rateLimited: m.limit }));
import { POST } from "@/app/api/neighborhood-address/route";
const feature = (coordinates: unknown, name = "Public Park") => ({
  geometry: { type: "Point", coordinates },
  properties: { name, city: "Redmond", state: "Oregon" },
});
const request = (q: unknown = "Sam Johnson Park", locale = "en") =>
  new Request("http://localhost/api/neighborhood-address", {
    method: "POST",
    body: JSON.stringify({ q, locale }),
  });
const fetcher = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({
    id: "member-id",
    email: "private@example.invalid",
  });
  m.limit.mockReturnValue(false);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue({
    ok: true,
    json: async () => ({ features: [feature([-121.1854115, 44.2733078])] }),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("authenticates before provider access; new unverified members can search", async () => {
  m.user.mockResolvedValueOnce(null);
  expect((await POST(request())).status).toBe(401);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await POST(request())).status).toBe(200);
});
it("sends only the bounded query and locale to the fixed provider, without caching or identity", async () => {
  const response = await POST(request("Sam Johnson Park", "es"));
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect((await response.json()).results[0].lat).toBe(44.2733078);
  const [url, options] = fetcher.mock.calls[0];
  expect(url.origin).toBe("https://photon.komoot.io");
  expect(url.searchParams.get("q")).toBe("Sam Johnson Park");
  expect(url.searchParams.get("lang")).toBe("es");
  expect(url.searchParams.get("bbox")).toBe("-121.35,44.18,-121.08,44.4");
  expect(url.toString()).not.toMatch(/member-id|private|email/);
  expect(options.cache).toBe("no-store");
  expect(options.headers).toBeUndefined();
});
it("rejects malformed/oversized bodies and throttled requests before external access", async () => {
  for (const q of [null, 4, "ab", "x".repeat(201)])
    expect((await POST(request(q))).status).toBe(400);
  const oversized = new Request("http://localhost/api/neighborhood-address", {
    method: "POST",
    body: JSON.stringify({ q: "park", extra: "x".repeat(1100) }),
  });
  expect((await POST(oversized)).status).toBe(400);
  const malformed = new Request("http://localhost/api/neighborhood-address", {
    method: "POST",
    body: "{",
  });
  expect((await POST(malformed)).status).toBe(400);
  m.limit.mockReturnValue(true);
  expect((await POST(request())).status).toBe(429);
  expect(fetcher).not.toHaveBeenCalled();
});
it("fails closed when Photon is offline or returns an error", async () => {
  fetcher.mockRejectedValueOnce(new Error("offline"));
  expect((await POST(request())).status).toBe(503);
  fetcher.mockResolvedValueOnce({ ok: false });
  expect((await (await POST(request())).json()).unavailable).toBe(true);
});
it("validates coordinates and retains an outside-map result without pretending it has a boundary match", () => {
  const found = photonAddresses({
    features: [
      null,
      feature([-121.26, 44.27]),
      feature([-121.26, 44.27]),
      feature([NaN, 44.27]),
      feature([-122, 44.27]),
      feature(["-121", 44.27]),
    ],
  });
  expect(found).toHaveLength(1);
  expect(coveredByNeighborhoodMap(found[0])).toBe(false);
  expect(
    coveredByNeighborhoodMap(
      photonAddresses({ features: [feature([-121.1854115, 44.2733078])] })[0],
    ),
  ).toBe(true);
});
it("accounts for every source label in both the map and migration, preserving retained choices", async () => {
  const catalog = JSON.parse(
    readFileSync("scripts/maps/source-labels.json", "utf8"),
  ) as { name: string; slug: string; printed: string }[];
  const map = JSON.parse(
    readFileSync("public/maps/redmond-2019/map.json", "utf8"),
  );
  const migration = readFileSync(
    "../migrations/0040_redmond_map_neighborhoods.sql",
    "utf8",
  );
  const schema = readFileSync("../schema.sql", "utf8");
  expect(catalog).toHaveLength(263);
  expect(new Set(catalog.map((row) => row.slug)).size).toBe(263);
  expect(Object.keys(map.anchors).sort()).toEqual(
    catalog.map((row) => row.name).sort(),
  );
  for (const row of catalog) {
    const pair = `('${row.slug}', '${row.name.replaceAll("'", "''")}')`;
    expect(migration).toContain(pair);
    expect(schema).toContain(pair);
    expect(
      coveredByNeighborhoodMap({
        label: row.name,
        lat: map.anchors[row.name][0],
        lng: map.anchors[row.name][1],
      }),
    ).toBe(true);
  }
  for (const slug of [
    "cinder-butte-village",
    "eagle-crest",
    "rimrock-west-estate",
    "village-at-ridgeview",
  ])
    expect(schema).toContain(`('${slug}',`);
  expect(migration).toContain("on conflict (slug) do nothing");
  expect(migration).not.toMatch(/\b(?:update|delete|truncate|alter)\b/i);
});
