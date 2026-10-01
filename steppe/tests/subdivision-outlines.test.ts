import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  subdivisionCatalog,
  subdivisionsAtPoint,
  validSubdivisionOutlines,
  coveredByPickerMap,
  type SubdivisionOutlines,
} from "@/lib/subdivision-outlines";

const text = readFileSync(
  "public/maps/redmond-current/outlines.geojson",
  "utf8",
);
const actual = JSON.parse(text) as SubdivisionOutlines;
it("accounts for every county record with bounded geometry and provenance", () => {
  expect(validSubdivisionOutlines(actual)).toBe(true);
  expect(actual.features).toHaveLength(551);
  expect(subdivisionCatalog.neighborhoods).toHaveLength(319);
  expect(createHash("sha256").update(text).digest("hex")).toBe(
    subdivisionCatalog.geometrySha256,
  );
  expect(new Set(actual.features.map((f) => f.properties.sourceId)).size).toBe(
    551,
  );
  expect(
    subdivisionCatalog.neighborhoods.flatMap((r) => r.sourceIds),
  ).toHaveLength(551);
  expect(Buffer.byteLength(text)).toBeLessThan(500000);
  expect(
    Math.max(...actual.features.map((f) => f.properties.recorded ?? 0)),
  ).toBeGreaterThan(Date.UTC(2026, 0, 1));
});
it("includes every county name in the seed, adding only missing choices", () => {
  const schema = readFileSync("../schema.sql", "utf8");
  const migration = readFileSync(
    "../migrations/0041_current_subdivision_neighborhoods.sql",
    "utf8",
  );
  const historical = JSON.parse(
    readFileSync("scripts/maps/source-labels.json", "utf8"),
  ) as { slug: string; name: string }[];
  const oldSlugs = new Set([
    ...historical.map((r) => r.slug),
    "cinder-butte-village",
    "eagle-crest",
    "rimrock-west-estate",
    "village-at-ridgeview",
  ]);
  for (const row of [...subdivisionCatalog.neighborhoods, ...historical])
    expect(schema).toContain(
      `('${row.slug}', '${row.name.replaceAll("'", "''")}')`,
    );
  const additions = subdivisionCatalog.neighborhoods.filter(
    (r) => !oldSlugs.has(r.slug),
  );
  expect(additions).toHaveLength(67);
  for (const row of additions)
    expect(migration).toContain(
      `('${row.slug}', '${row.name.replaceAll("'", "''")}')`,
    );
  expect(migration).toContain("on conflict (slug) do nothing");
  expect(migration).not.toMatch(/\b(?:update|delete|truncate|alter|drop)\b/i);
  for (const name of [
    "121 West",
    "Feather Ridge",
    "Owen Ridge",
    "Vista Point",
    "Antler Meadows",
  ])
    expect(subdivisionCatalog.neighborhoods.some((r) => r.name === name)).toBe(
      true,
    );
});
const rectangle = (x: number, y: number, size: number) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];
const make = (name: string, rings: number[][][]) => ({
  type: "Feature" as const,
  properties: { sourceId: 1, name, slug: name, platName: name, recorded: null },
  geometry: { type: "Polygon" as const, coordinates: rings },
});
it("handles holes, edges, multipolygons and overlapping phases without assigning a profile", () => {
  const shapes: SubdivisionOutlines = {
    type: "FeatureCollection",
    features: [
      make("A", [rectangle(0, 0, 10), rectangle(4, 4, 2)]),
      make("A", [rectangle(1, 1, 2)]),
      make("B", [rectangle(0, 0, 10)]),
      {
        ...make("C", []),
        geometry: {
          type: "MultiPolygon",
          coordinates: [[rectangle(20, 20, 2)], [rectangle(30, 30, 2)]],
        },
      },
    ],
  };
  const point = (lng: number, lat: number) => ({
    label: "Synthetic point",
    lng,
    lat,
  });
  expect(subdivisionsAtPoint(shapes, point(2, 2))).toEqual(["A", "B"]);
  expect(subdivisionsAtPoint(shapes, point(5, 5))).toEqual(["B"]);
  expect(subdivisionsAtPoint(shapes, point(0, 0))).toEqual(["A", "B"]);
  expect(subdivisionsAtPoint(shapes, point(31, 31))).toEqual(["C"]);
  expect(subdivisionsAtPoint(shapes, point(15, 15))).toEqual([]);
});
it("rejects malformed, incomplete, mislabeled and empty geometry", () => {
  expect(validSubdivisionOutlines(null)).toBe(false);
  expect(
    validSubdivisionOutlines({ type: "FeatureCollection", features: [] }),
  ).toBe(false);
  const bad = structuredClone(actual);
  bad.features[0].properties.name = "<unexpected>";
  expect(validSubdivisionOutlines(bad)).toBe(false);
  const empty = structuredClone(actual);
  empty.features[0].geometry.coordinates = [];
  expect(validSubdivisionOutlines(empty)).toBe(false);
});
it("extends coverage beyond the historical image", () => {
  const [[south, west], [north, east]] = subdivisionCatalog.bounds;
  expect(
    coveredByPickerMap({
      label: "Synthetic extent point",
      lat: north,
      lng: east,
    }),
  ).toBe(true);
  expect(
    coveredByPickerMap({ label: "Outside map", lat: south - 1, lng: west }),
  ).toBe(false);
});
