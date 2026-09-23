export type LocationSuggestion = {
  name: string;
  address: string;
  value: string;
  source: "steppe" | "public";
};
export function photonLocations(data: unknown): LocationSuggestion[] {
  const features = (
    data as { features?: { properties?: Record<string, unknown> }[] }
  )?.features;
  if (!Array.isArray(features)) return [];
  return features.slice(0, 6).flatMap((f) => {
    const p = f?.properties ?? {};
    const str = (key: string) =>
      typeof p[key] === "string" ? (p[key] as string).trim().slice(0, 200) : "";
    const street = [str("housenumber"), str("street")]
      .filter(Boolean)
      .join(" ");
    const name = str("name") || street;
    const address = [
      ...new Set(
        [
          street,
          str("city") || str("district"),
          str("state"),
          str("postcode"),
        ].filter(Boolean),
      ),
    ].join(", ");
    const value =
      name === street
        ? address
        : [...new Set([name, address].filter(Boolean))].join(", ");
    if (!name || value.length > 300) return [];
    return [{ name, address, value, source: "public" as const }];
  });
}
