/**
 * Redmond-time utilities — the single source of truth for date/time handling.
 *
 * Steppe serves one place: Redmond, Oregon. Every event and governance time
 * is Redmond local time, ALWAYS, regardless of where the member who entered it
 * happened to be sitting. We never trust the browser clock for this. A wall-clock
 * value typed into a form (e.g. "2026-07-01T18:00") is interpreted as
 * America/Los_Angeles — DST-correct — and converted to a precise UTC instant for
 * storage; stored instants are formatted back in America/Los_Angeles for display.
 *
 * This matters most for governance: a wrong close time changes who is still
 * allowed to vote. So the conversion lives here, server-side, once.
 *
 * No timezone library is needed: the platform's IANA database, reached through
 * Intl, is DST-aware, and we derive the offset from it.
 */
export const REDMOND_TZ = "America/Los_Angeles";

/**
 * The offset (in ms) America/Los_Angeles had at a given UTC instant, computed as
 * (that instant's LA wall-clock read as if it were UTC) − (the instant itself).
 * DST-correct because Intl consults the tz database. Negative for LA (behind UTC).
 */
function redmondOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REDMOND_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value);
  // Some ICU builds render midnight as hour "24"; normalize to 0.
  const hour = map.hour === 24 ? 0 : map.hour;
  const asIfUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    hour,
    map.minute,
    map.second,
  );
  return asIfUtc - utcMs;
}

/**
 * Interpret a wall-clock "YYYY-MM-DDTHH:mm" (an <input type="datetime-local">
 * value) as Redmond local time and return the UTC instant as an ISO string, or
 * null if it isn't a real date/time. A second pass resolves the offset correctly
 * for instants near a DST boundary.
 */
export function redmondWallTimeToUtcISO(wall: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    wall.trim(),
  );
  if (!m) return null;

  const year = +m[1];
  const month = +m[2];
  const day = +m[3];
  const hour = +m[4];
  const minute = +m[5];
  const second = m[6] ? +m[6] : 0;

  // Reject out-of-range and rolled-over dates (e.g. Feb 31 → Mar 3).
  if (hour > 23 || minute > 59 || second > 59) return null;
  const rollCheck = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    rollCheck.getUTCFullYear() !== year ||
    rollCheck.getUTCMonth() !== month - 1 ||
    rollCheck.getUTCDate() !== day
  ) {
    return null;
  }

  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  // wall = utc + offset  ⇒  utc = (wall read as UTC) − offset
  let utc = guess - redmondOffsetMs(guess);
  const refined = guess - redmondOffsetMs(utc);
  if (refined !== utc) utc = refined;

  return new Date(utc).toISOString();
}

/**
 * Format a stored instant as "YYYY-MM-DDTHH:mm" in Redmond time — the shape an
 * <input type="datetime-local"> expects, for prefilling a default or an edit.
 */
export function redmondInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REDMOND_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}

/** A full, unambiguous Redmond-local time, e.g. "Wed, Jul 1, 6:00 PM PDT". */
export function formatRedmondDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: REDMOND_TZ,
    timeZoneName: "short",
  }).format(new Date(iso));
}

/**
 * A Redmond-local calendar date, e.g. "Jul 1, 2026" — for "submitted on" /
 * "joined on" style displays where the time of day doesn't matter. Still routed
 * through Redmond time so the calendar day is correct near midnight regardless of
 * the server's timezone (never the raw browser/runtime clock).
 */
export function formatRedmondDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: REDMOND_TZ,
  }).format(new Date(iso));
}
