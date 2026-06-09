/**
 * Small event-domain helpers shared by the event pages.
 *
 * High Desert serves one place — Redmond, Oregon — so every event time is shown
 * in Redmond's local clock, regardless of the viewer's device timezone. That
 * keeps "6:00 PM" meaning the same thing for everyone and removes a whole class
 * of "what time is it really?" confusion (Ousterhout: define errors out of
 * existence).
 */
export const REDMOND_TZ = "America/Los_Angeles";

/** A full, unambiguous local time, e.g. "Wed, Jul 1, 6:00 PM PDT". */
export function formatEventDateTime(iso: string, locale: string): string {
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
