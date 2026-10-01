import { photonLocations } from "./event-locations";
import map from "../public/maps/redmond-2019/map.json";

export type AddressPoint = {
  label: string;
  lat: number;
  lng: number;
  source?: "county" | "photon";
};
// Search the Redmond area; results beyond the historical map are marked as such.
export const REDMOND_SEARCH_BOX = [-121.35, 44.18, -121.08, 44.4] as const;
const COUNTY_ADDRESS_QUERY =
  "https://maps.deschutes.org/server/rest/services/Hosted/E911_Address_Points/FeatureServer/0/query";

// The county stores abbreviated, uppercase street addresses. Normalize common
// typing variants without guessing a house number or interpolating a location.
export function countyAddressUrl(query: string): URL | undefined {
  if (!/^\d/.test(query) || /[^\p{L}\p{N}\s.,'#-]/u.test(query)) return;
  const directions: Record<string, string> = {
    NORTHWEST: "NW",
    NORTHEAST: "NE",
    SOUTHWEST: "SW",
    SOUTHEAST: "SE",
    NORTH: "N",
    SOUTH: "S",
    EAST: "E",
    WEST: "W",
  };
  const suffixes: Record<string, string> = {
    STREET: "ST",
    AVENUE: "AVE",
    DRIVE: "DR",
    ROAD: "RD",
    COURT: "CT",
    PLACE: "PL",
    LANE: "LN",
    BOULEVARD: "BLVD",
  };
  const address = query
    .toUpperCase()
    .replace(/[,\s]+REDMOND\b.*$/, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /^(\d+[A-Z]?\s+)([A-Z]+)\b/,
      (_, number, word) => number + (directions[word] ?? word),
    )
    .replace(/\b[A-Z]+$/, (word) => suffixes[word] ?? word);
  if (address.length < 3) return;
  const url = new URL(COUNTY_ADDRESS_QUERY);
  // Fixed fields/extent; double quotes in SQL string literals are not used.
  // Wildcards from the caller are rejected above, apostrophes are escaped here.
  url.search = new URLSearchParams({
    f: "json",
    where: `postal_community = 'REDMOND' AND address LIKE '${address.replaceAll("'", "''")}%'`,
    outFields: "address,postal_community,state,zipcode",
    returnGeometry: "true",
    outSR: "4326",
    geometry: REDMOND_SEARCH_BOX.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    resultRecordCount: "6",
    orderByFields: "address",
  }).toString();
  return url;
}

export function countyAddresses(data: unknown): AddressPoint[] {
  const features = (data as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const [west, south, east, north] = REDMOND_SEARCH_BOX;
  const results: AddressPoint[] = [];
  for (const feature of features.slice(0, 6)) {
    const point = feature as {
      attributes?: Record<string, unknown>;
      geometry?: { x?: unknown; y?: unknown };
    } | null;
    const a = point?.attributes;
    const lng = point?.geometry?.x,
      lat = point?.geometry?.y;
    if (
      !a ||
      typeof a.address !== "string" ||
      !/^\d/.test(a.address) ||
      a.postal_community !== "REDMOND" ||
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lng < west ||
      lng > east ||
      lat < south ||
      lat > north
    )
      continue;
    const label = [
      a.address,
      "Redmond",
      "OR",
      typeof a.zipcode === "string" ? a.zipcode : "",
    ]
      .filter(Boolean)
      .join(", ")
      .slice(0, 300);
    if (!results.some((result) => result.label === label))
      results.push({ label, lat, lng, source: "county" });
  }
  return results;
}
export function coveredByNeighborhoodMap(point: AddressPoint) {
  const [[south, west], [north, east]] = map.bounds;
  return (
    point.lat >= south &&
    point.lat <= north &&
    point.lng >= west &&
    point.lng <= east
  );
}
export function photonAddresses(data: unknown, query = ""): AddressPoint[] {
  const features = (data as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const [west, south, east, north] = REDMOND_SEARCH_BOX;
  const results: AddressPoint[] = [];
  for (const feature of features.slice(0, 6)) {
    const properties = (
      feature as {
        properties?: {
          type?: unknown;
          osm_key?: unknown;
          housenumber?: unknown;
        };
      } | null
    )?.properties;
    // A street's center does not locate a home. Keep actual addresses and places.
    if (properties?.type === "street" || properties?.osm_key === "highway")
      continue;
    const houseNumber = query.match(/^\d+\b/)?.[0];
    if (houseNumber && properties?.housenumber !== houseNumber) continue;
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
      results.push({ label: suggestion.value, lat, lng, source: "photon" });
  }
  return results;
}
