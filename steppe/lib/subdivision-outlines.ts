import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import data from "../public/maps/redmond-current/catalog.json";
import historical from "../public/maps/redmond-2019/map.json";
import type { AddressPoint } from "./neighborhood-address";

export type SubdivisionProperties = {
  sourceId: number;
  name: string;
  slug: string;
  platName: string;
  recorded: number | null;
};
export type SubdivisionOutlines = FeatureCollection<
  Polygon | MultiPolygon,
  SubdivisionProperties
>;
export const subdivisionCatalog = data;
export const pickerMapBounds: [[number, number], [number, number]] = [
  [
    Math.min(data.bounds[0][0], historical.bounds[0][0]),
    Math.min(data.bounds[0][1], historical.bounds[0][1]),
  ],
  [
    Math.max(data.bounds[1][0], historical.bounds[1][0]),
    Math.max(data.bounds[1][1], historical.bounds[1][1]),
  ],
];
export function coveredByPickerMap(point: AddressPoint) {
  const [[south, west], [north, east]] = pickerMapBounds;
  return (
    point.lat >= south &&
    point.lat <= north &&
    point.lng >= west &&
    point.lng <= east
  );
}

// GeoJSON uses longitude, latitude. Include points on an edge, respect holes,
// and return all overlapping named plats without deciding a member's home.
function inRing(point: AddressPoint, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    const cross = (point.lng - xi) * (yj - yi) - (point.lat - yi) * (xj - xi);
    if (
      Math.abs(cross) < 1e-12 &&
      point.lng >= Math.min(xi, xj) &&
      point.lng <= Math.max(xi, xj) &&
      point.lat >= Math.min(yi, yj) &&
      point.lat <= Math.max(yi, yj)
    )
      return true;
    if (
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function subdivisionsAtPoint(
  outlines: SubdivisionOutlines,
  point: AddressPoint,
): string[] {
  return [
    ...new Set(
      outlines.features
        .filter((feature) => {
          const polygons =
            feature.geometry.type === "Polygon"
              ? [feature.geometry.coordinates]
              : feature.geometry.coordinates;
          return polygons.some(
            (rings) =>
              inRing(point, rings[0]) &&
              !rings.slice(1).some((hole) => inRing(point, hole)),
          );
        })
        .map((feature) => feature.properties.name),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function validSubdivisionOutlines(
  value: unknown,
): value is SubdivisionOutlines {
  const data = value as SubdivisionOutlines | null;
  if (
    data?.type !== "FeatureCollection" ||
    !Array.isArray(data.features) ||
    data.features.length !== subdivisionCatalog.sourceFeatureCount
  )
    return false;
  const groups = new Map(
    subdivisionCatalog.neighborhoods.map((row) => [row.slug, row]),
  );
  const seen = new Set<number>();
  const [[south, west], [north, east]] = pickerMapBounds;
  return data.features.every((feature) => {
    if (feature?.type !== "Feature") return false;
    const p = feature.properties,
      g = feature.geometry;
    if (
      !p ||
      !g ||
      !["Polygon", "MultiPolygon"].includes(g.type) ||
      !Array.isArray(g.coordinates)
    )
      return false;
    const group = groups.get(p.slug);
    if (
      !group ||
      group.name !== p.name ||
      !group.sourceIds.includes(p.sourceId) ||
      !group.platNames.includes(p.platName) ||
      seen.has(p.sourceId)
    )
      return false;
    seen.add(p.sourceId);
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    return (
      polygons.length > 0 &&
      polygons.every(
        (rings) =>
          Array.isArray(rings) &&
          rings.length &&
          rings.every(
            (ring) =>
              Array.isArray(ring) &&
              ring.length >= 4 &&
              ring.every(
                (point) =>
                  Array.isArray(point) &&
                  point.length === 2 &&
                  point.every(Number.isFinite) &&
                  point[0] >= west &&
                  point[0] <= east &&
                  point[1] >= south &&
                  point[1] <= north,
              ) &&
              ring[0][0] === ring[ring.length - 1][0] &&
              ring[0][1] === ring[ring.length - 1][1],
          ),
      )
    );
  });
}
