/**
 * RFC 5545 (iCalendar) primitives — one builder shared by the client
 * Add-to-calendar button and the C1 subscription-feed route
 * (docs/spec/calendar-c1-spec-v1.md §3).
 *
 * The two rules the previous inline builder skipped, which member-written
 * text hits immediately:
 *   - TEXT values must escape backslash, semicolon, comma, and newlines
 *     (RFC 5545 §3.3.11) — an unescaped comma in a title splits the value in
 *     strict parsers; a newline breaks the whole document.
 *   - Content lines longer than 75 octets SHOULD be folded with CRLF + one
 *     space (§3.1). Octets, not characters — folding is byte-aware and never
 *     splits a UTF-8 sequence (we fold at code-point boundaries).
 *
 * Pure TS, isomorphic (TextEncoder exists in browsers and Node ≥18): safe in
 * client components and route handlers alike. Timestamps render as UTC basic
 * format ("Z") — calendar apps localize; no VTIMEZONE needed.
 */

export type IcsEvent = {
  /** Stable identity, e.g. `${eventId}@steppe.community`. */
  uid: string;
  /** ISO instants; rendered as UTC basic format. */
  dtstamp: string;
  dtstart: string;
  /** Optional end (events.ends_at is nullable) — omitted when absent. */
  dtend?: string | null;
  summary: string;
  location?: string | null;
  description?: string;
  url?: string;
  /** Emits STATUS:CANCELLED so subscribed apps update instead of dropping. */
  cancelled?: boolean;
};

/** RFC 5545 §3.3.11 TEXT escaping. Backslash first — order matters. */
export function icsEscapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|[\r\n]/g, "\\n");
}

/** ISO instant → UTC basic format, e.g. 20260723T170000Z. */
export function icsUtcStamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Fold one content line at 75 octets (§3.1). Continuation lines carry a
 * leading space that counts toward their 75, so their content budget is 74.
 */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let budget = 75;
  for (const ch of line) {
    // for..of iterates code points — a multi-byte character moves whole.
    const b = enc.encode(ch).length;
    if (bytes + b > budget) {
      parts.push(current);
      current = ch;
      bytes = b;
      budget = 74;
    } else {
      current += ch;
      bytes += b;
    }
  }
  if (current) parts.push(current);
  return parts.map((p, i) => (i === 0 ? p : " " + p)).join("\r\n");
}

export function buildIcs({
  events,
  prodId = "-//Steppe//Calendar//EN",
  calName,
  refreshTtl,
}: {
  events: IcsEvent[];
  prodId?: string;
  /** X-WR-CALNAME — subscription feeds name themselves; downloads omit it. */
  calName?: string;
  /** ISO-8601 duration (e.g. "PT1H") — feeds advertise a poll hint. */
  refreshTtl?: string;
}): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (calName) lines.push(`X-WR-CALNAME:${icsEscapeText(calName)}`);
  if (refreshTtl) {
    lines.push(`REFRESH-INTERVAL;VALUE=DURATION:${refreshTtl}`);
    lines.push(`X-PUBLISHED-TTL:${refreshTtl}`);
  }
  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${icsUtcStamp(ev.dtstamp)}`);
    lines.push(`DTSTART:${icsUtcStamp(ev.dtstart)}`);
    if (ev.dtend) lines.push(`DTEND:${icsUtcStamp(ev.dtend)}`);
    lines.push(`SUMMARY:${icsEscapeText(ev.summary)}`);
    if (ev.location) lines.push(`LOCATION:${icsEscapeText(ev.location)}`);
    if (ev.cancelled) lines.push("STATUS:CANCELLED");
    if (ev.url) lines.push(`URL:${ev.url}`);
    if (ev.description)
      lines.push(`DESCRIPTION:${icsEscapeText(ev.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n");
}
