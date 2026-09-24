import type { EventRow } from "./types/db";

import { redmondInputValue, redmondWallTimeToUtcISO } from "./time";

/** Only editable fields leave this parser; identity, status and board stay intact. */
export function parseEventInput(
  formData: FormData,
  existing?: { starts_at: string; ends_at: string | null },
):
  | { error: string }
  | {
      values: Pick<
        EventRow,
        | "title"
        | "body"
        | "location"
        | "starts_at"
        | "ends_at"
        | "capacity"
        | "neighborhood_id"
      >;
    } {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const title = text("title"),
    body = text("body"),
    location = text("location");
  if (title.length > 140 || body.length > 2000 || location.length > 300)
    return { error: "too-long" };
  if (!title) return { error: "title-required" };
  // Preserve unchanged instants, including seconds and the second fall-back hour.
  const instant = (wall: string, saved?: string | null) =>
    saved && wall === redmondInputValue(new Date(saved))
      ? new Date(saved).toISOString()
      : redmondWallTimeToUtcISO(wall);
  const starts_at = instant(text("starts_at"), existing?.starts_at);
  if (!starts_at) return { error: "when-required" };
  const end = text("ends_at");
  const ends_at = end ? instant(end, existing?.ends_at) : null;
  if (end && (!ends_at || ends_at <= starts_at))
    return { error: "when-required" };
  const rawCapacity = text("capacity"),
    capacity = Number(rawCapacity);
  if (
    rawCapacity &&
    (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)
  )
    return { error: "capacity-invalid" };
  const neighborhood = text("neighborhood_id");
  return {
    values: {
      title,
      body: body || null,
      location: location || null,
      starts_at,
      ends_at,
      capacity: rawCapacity ? capacity : null,
      neighborhood_id:
        neighborhood && neighborhood !== "all" ? neighborhood : null,
    },
  };
}
