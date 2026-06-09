import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VerifiedNotice } from "./verified-notice";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { getHiddenIds } from "@/lib/moderation";
import type { Dictionary } from "@/lib/i18n";

export const metadata = {
  title: "Neighborhood events · High Desert",
};

type EventListItem = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  neighborhood_id: string | null;
};

/** One section's worth of events as cards. Each list is already time-sorted. */
function EventList({
  events,
  neighborhoodNames,
  locale,
  dict,
}: {
  events: EventListItem[];
  neighborhoodNames: Map<string, string>;
  locale: string;
  dict: Dictionary;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {events.map((ev) => (
        <li key={ev.id}>
          <Link
            href={`/protected/events/${ev.id}`}
            className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-medium">{ev.title}</h3>
              <Badge variant="secondary">
                {ev.neighborhood_id
                  ? neighborhoodNames.get(ev.neighborhood_id) ??
                    dict.events.allRedmond
                  : dict.events.allRedmond}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatRedmondDateTime(ev.starts_at, locale)}
            </p>
            {ev.location && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                {ev.location}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function EventsContent() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();

  // Verified-only: the DB blocks the read anyway (ev_read), but show the
  // plain-language reason rather than an empty page.
  if (!profile.verified) return <VerifiedNotice dict={dict} locale={locale} />;

  const supabase = await createClient();

  // Upcoming, active events, strictly soonest-first. No ranking, popularity, or
  // engagement signal — time order only (invariant 7).
  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, location, neighborhood_id")
    .eq("status", "active")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .returns<EventListItem[]>();

  // Hidden (moderator-removed) events drop out of the listing; their detail page
  // still shows the legible removed state (P7 — not silent, not in the way).
  const hidden = await getHiddenIds(supabase, "event");
  const all = (events ?? []).filter((e) => !hidden.has(e.id));

  // Resolve neighborhood names for the badges, one query.
  const neighborhoodNames = new Map<string, string>();
  const nbIds = [
    ...new Set(all.map((e) => e.neighborhood_id).filter((x): x is string => !!x)),
  ];
  if (nbIds.length > 0) {
    const { data: nbs } = await supabase
      .from("neighborhoods")
      .select("id, name")
      .in("id", nbIds);
    for (const n of nbs ?? []) neighborhoodNames.set(n.id, n.name);
  }

  // Proximity: a member's own neighborhood comes first, then the rest of
  // Redmond. This is the only "ranking" — and it's fully member-visible (the
  // sections are labeled and based on the member's own stated neighborhood), not
  // an opaque score or engagement signal (invariant 7).
  const home = profile.neighborhood_id;
  const mine = home ? all.filter((e) => e.neighborhood_id === home) : [];
  const rest = home ? all.filter((e) => e.neighborhood_id !== home) : all;

  return (
    <div lang={locale} className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.events.listTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{dict.events.listIntro}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/protected/events/new">
            <CalendarPlus className="size-4" aria-hidden="true" />
            {dict.events.create}
          </Link>
        </Button>
      </header>

      {all.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {dict.events.empty}
        </p>
      ) : home && mine.length > 0 ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {dict.events.inYourNeighborhood}
            </h2>
            <EventList
              events={mine}
              neighborhoodNames={neighborhoodNames}
              locale={locale}
              dict={dict}
            />
          </section>
          {rest.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {dict.events.acrossRedmond}
              </h2>
              <EventList
                events={rest}
                neighborhoodNames={neighborhoodNames}
                locale={locale}
                dict={dict}
              />
            </section>
          )}
        </>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {dict.events.upcomingTitle}
          </h2>
          <EventList
            events={all}
            neighborhoodNames={neighborhoodNames}
            locale={locale}
            dict={dict}
          />
        </section>
      )}
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense>
      <EventsContent />
    </Suspense>
  );
}
