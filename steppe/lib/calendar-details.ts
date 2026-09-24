import { REDMOND_TZ } from "./time";

/** Copyable prose; imported calendar files continue to use exact UTC instants. */
export function calendarDetails(
  event: {
    title: string;
    startsAt: string;
    endsAt?: string | null;
    location: string | null;
    body?: string | null;
  },
  locale: string,
) {
  const es = locale.startsWith("es");
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: REDMOND_TZ,
      timeZoneName: "short",
    }).format(new Date(iso));
  return [
    event.title,
    `${es ? "Inicio" : "Starts"}: ${date(event.startsAt)}`,
    event.endsAt ? `${es ? "Fin" : "Ends"}: ${date(event.endsAt)}` : null,
    es
      ? "Zona horaria: Pacífico (America/Los_Angeles)"
      : "Time zone: Pacific (America/Los_Angeles)",
    event.location ? `${es ? "Lugar" : "Location"}: ${event.location}` : null,
    event.body,
    es ? "Confirma tu asistencia en Steppe." : "RSVP in Steppe.",
  ]
    .filter(Boolean)
    .join("\n");
}
