import { REDMOND_TZ } from "./time";

/** Display labels stay separate from values pasted into calendar fields. */
export function calendarDetailFields(
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
    { id: "title", label: es ? "Título" : "Title", value: event.title },
    {
      id: "starts",
      label: es ? "Inicio" : "Starts",
      value: date(event.startsAt),
    },
    ...(event.endsAt
      ? [{ id: "ends", label: es ? "Fin" : "Ends", value: date(event.endsAt) }]
      : []),
    {
      id: "timezone",
      label: es ? "Zona horaria" : "Time zone",
      value: `${es ? "Pacífico" : "Pacific"} (${REDMOND_TZ})`,
    },
    ...(event.location
      ? [
          {
            id: "location",
            label: es ? "Lugar" : "Location",
            value: event.location,
          },
        ]
      : []),
    ...(event.body
      ? [
          {
            id: "description",
            label: es ? "Descripción" : "Description",
            value: event.body,
          },
        ]
      : []),
    {
      id: "rsvp",
      label: es ? "Asistencia" : "RSVP",
      value: es ? "Confirma tu asistencia en Steppe." : "RSVP in Steppe.",
    },
  ];
}

/** Copyable prose; imported calendar files continue to use exact UTC instants. */
export function calendarDetails(
  event: Parameters<typeof calendarDetailFields>[0],
  locale: string,
) {
  return calendarDetailFields(event, locale)
    .map((field) =>
      ["title", "description", "rsvp"].includes(field.id)
        ? field.value
        : `${field.label}: ${field.value}`,
    )
    .join("\n");
}
