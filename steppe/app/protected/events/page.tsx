import { Suspense } from "react";
import Image from "next/image";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { Masthead } from "@/components/broadsheet/masthead";
import { SectionLabel, SectionRow } from "@/components/broadsheet/section-row";
import { Fab } from "@/components/broadsheet/fab";
import { VerifiedGate } from "@/components/verified-gate";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { getHiddenIds } from "@/lib/moderation";
import type { Dictionary } from "@/lib/i18n";

export const metadata = {
  title: "Neighborhood events · Steppe",
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
    <ul className="flex flex-col border-t">
      {events.map((ev) => {
        const hood = ev.neighborhood_id
          ? neighborhoodNames.get(ev.neighborhood_id) ?? dict.events.allRedmond
          : dict.events.allRedmond;
        return (
          <li key={ev.id}>
            {/* Preview row anatomy: mono kicker (when · where-in-town), Besley
                title, quiet location sub, rust chevron. */}
            <SectionRow
              href={`/protected/events/${ev.id}`}
              kicker={`${formatRedmondDateTime(ev.starts_at, locale)} · ${hood}`}
              title={ev.title}
              sub={ev.location ?? undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}

async function EventsContent() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();

  // Verified-only: the DB blocks the read anyway (ev_read), but show the
  // plain-language reason rather than an empty page.
  if (!profile.verified)
    return (
      <VerifiedGate
        title={dict.events.gateTitle}
        body={dict.events.gateBody}
        ctaLabel={dict.events.gateCta}
        locale={locale}
      />
    );

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
      {/* Preview masthead grammar; the create action is the floating chip. */}
      <Masthead
        title={dict.nav.eventsLink}
        kicker={dict.events.dateline}
        voice={dict.events.voice}
        flush
      />
      <Fab href="/protected/events/new" label={dict.events.create} />

      {all.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
          {/* ISoMiMo warms the empty state (floor 120px). */}
          <Image
            src="/brand/steppe-isomimo-512.png"
            alt={dict.common.isomimoAlt}
            width={150}
            height={150}
          />
          <p className="text-sm text-muted-foreground">{dict.events.empty}</p>
        </div>
      ) : home && mine.length > 0 ? (
        <>
          <section className="flex flex-col gap-1">
            <SectionLabel>{dict.events.inYourNeighborhood}</SectionLabel>
            <EventList
              events={mine}
              neighborhoodNames={neighborhoodNames}
              locale={locale}
              dict={dict}
            />
          </section>
          {rest.length > 0 && (
            <section className="flex flex-col gap-1">
              <SectionLabel>{dict.events.acrossRedmond}</SectionLabel>
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
        <section className="flex flex-col gap-1">
          <SectionLabel>{dict.events.upcomingTitle}</SectionLabel>
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
    <Suspense fallback={<PageSkeleton />}>
      <EventsContent />
    </Suspense>
  );
}
