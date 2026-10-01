import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  coveredByNeighborhoodMap,
  photonAddresses,
  countyAddressUrl,
  countyAddresses,
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
const countyFeature = (
  address = "123 NW SAMPLE ST",
  coordinates = [-121.18, 44.27],
) => ({
  attributes: {
    address,
    postal_community: "REDMOND",
    state: "OR",
    zipcode: "97756",
  },
  geometry: { x: coordinates[0], y: coordinates[1] },
});
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
it("normalizes partial/full street addresses and constrains the county query without SQL wildcards from input", () => {
  const url = countyAddressUrl(
    "123 Northwest Sample Street, Redmond, OR 97756",
  )!;
  expect(url.searchParams.get("where")).toBe(
    "postal_community = 'REDMOND' AND address LIKE '123 NW SAMPLE ST%'",
  );
  expect(countyAddressUrl("123 NW Sam")!.searchParams.get("where")).toContain(
    "'123 NW SAM%'",
  );
  expect(
    countyAddressUrl("123 NW O'Brien St")!.searchParams.get("where"),
  ).toContain("O''BRIEN");
  expect(countyAddressUrl("123%' OR 1=1 --")).toBeUndefined();
  expect(countyAddressUrl("123_%")).toBeUndefined();
  expect(countyAddressUrl("Sam Johnson Park")).toBeUndefined();
  expect(
    countyAddressUrl("123 NW North Street")!.searchParams.get("where"),
  ).toContain("123 NW NORTH ST");
  expect(url.searchParams.get("outFields")).toBe(
    "address,postal_community,state,zipcode",
  );
  expect(url.searchParams.get("outSR")).toBe("4326");
  expect(url.searchParams.get("resultRecordCount")).toBe("6");
});
it("uses real county points first without identity, caching, or a second provider request", async () => {
  fetcher.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ features: [countyFeature()] }),
  });
  const response = await POST(request("123 NW Sample St"));
  expect((await response.json()).results).toEqual([
    {
      label: "123 NW SAMPLE ST, Redmond, OR, 97756",
      lat: 44.27,
      lng: -121.18,
      source: "county",
    },
  ]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url.origin).toBe("https://maps.deschutes.org");
  expect(url.toString()).not.toMatch(/member-id|private|email/);
  expect(options.headers).toBeUndefined();
  expect(options.cache).toBe("no-store");
});
it.each(["offline", "empty", "service-error"])(
  "falls back safely when county search is %s, rejecting wrong house numbers and street centers",
  async (failure) => {
    if (failure === "offline")
      fetcher.mockRejectedValueOnce(new Error("offline"));
    else
      fetcher.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          failure === "empty" ? { features: [] } : { error: { code: 500 } },
      });
    fetcher.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            ...feature([-121.18, 44.27]),
            properties: { type: "street", name: "NW Sample St" },
          },
          {
            ...feature([-121.18, 44.27]),
            properties: {
              housenumber: "124",
              street: "NW Sample St",
              city: "Redmond",
            },
          },
          {
            ...feature([-121.18, 44.27]),
            properties: {
              housenumber: "123",
              street: "NW Sample St",
              city: "Redmond",
            },
          },
        ],
      }),
    });
    const response = await POST(request("123 NW Sample St"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].label).toContain("123 NW Sample St");
    expect(body.results[0].source).toBe("photon");
  },
);
it("rejects invalid, duplicate, non-Redmond and outside-area county points", () => {
  expect(
    countyAddresses({
      features: [
        null,
        countyFeature(),
        countyFeature(),
        countyFeature("124 NW SAMPLE ST", [NaN, 44.27]),
        countyFeature("125 NW SAMPLE ST", [-122, 44.27]),
        {
          ...countyFeature(),
          attributes: { address: "123 SW SAMPLE ST", postal_community: "BEND" },
        },
      ],
    }),
  ).toHaveLength(1);
  expect(countyAddresses({ error: { code: 500 } })).toEqual([]);
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
