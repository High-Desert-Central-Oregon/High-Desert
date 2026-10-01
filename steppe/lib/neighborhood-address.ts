import { photonLocations } from "./event-locations";
import map from "../public/maps/redmond-2019/map.json";

export type AddressPoint = { label: string; lat: number; lng: number };
// Search the Redmond area; results beyond the historical map are marked as such.
export const REDMOND_SEARCH_BOX = [-121.35, 44.18, -121.08, 44.4] as const;
export function coveredByNeighborhoodMap(point: AddressPoint) {
  const [[south, west], [north, east]] = map.bounds;
  return (
    point.lat >= south &&
    point.lat <= north &&
    point.lng >= west &&
    point.lng <= east
  );
}
export function photonAddresses(data: unknown): AddressPoint[] {
  const features = (data as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const [west, south, east, north] = REDMOND_SEARCH_BOX;
  const results: AddressPoint[] = [];
  for (const feature of features.slice(0, 6)) {
    const geometry = (
      feature as {
        geometry?: { type?: unknown; coordinates?: unknown[] };
      } | null
    )?.geometry;
    if (geometry?.type !== "Point" || !Array.isArray(geometry.coordinates))
      continue;
    const [lng, lat] = geometry.coordinates;
    if (
      typeof lng !== "number" ||
      typeof lat !== "number" ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lng < west ||
      lng > east ||
      lat < south ||
      lat > north
    )
      continue;
    const suggestion = photonLocations({ features: [feature] })[0];
    if (!suggestion) continue;
    if (
      !results.some(
        (r) => r.label === suggestion.value && r.lat === lat && r.lng === lng,
      )
    )
      results.push({ label: suggestion.value, lat, lng });
  }
  return results;
}
