import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { Masthead } from "@/components/broadsheet/masthead";
import { SectionLabel } from "@/components/broadsheet/section-row";
import { DateTileRow } from "@/components/broadsheet/date-tile-row";
import { QuietEmpty } from "@/components/broadsheet/quiet-empty";
import { ViewToggle } from "@/components/broadsheet/view-toggle";
import {
  MonthView,
  dayFromParam,
  monthBoundsUtc,
  monthFromParam,
} from "@/components/broadsheet/month-view";
import { VerifiedGate } from "@/components/verified-gate";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { getHiddenIds } from "@/lib/moderation";

export const metadata = {
  title: "My calendar · Steppe",
};

/**
 * MY CALENDAR (calendar-c1-spec §1.1) — the member's own agenda, filed under
 * You: everything they RSVP'd to ∪ their groups' events. Zero new schema —
 * joining a group IS the calendar subscription (group_members), the RSVP IS
 * the save (event_rsvps); v2's calendar_subscriptions/event_saves were cut
 * (spec §0.1). Because Everyone-membership is implicit and never materialized
 * (0013), the group_members join excludes the community-wide board by
 * construction — Everyone events appear here only when the member RSVPs, so
 * this surface never duplicates the Exchange's Upcoming.
 *
 * RLS remains the gate: ev_read scopes both queries, so a member who left a
 * group silently loses its rows — including events they'd RSVP'd to inside
 * it. My Calendar never shows what the member can no longer read.
 */

type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
};

type SearchParams = { v?: string; m?: string; d?: string };

const BASE = "/protected/account/calendar";

async function MyCalendarContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const { locale, dict } = await getServerDictionary();

  if (!profile.verified)
    return (
      <VerifiedGate
        title={dict.calendar.gateTitle}
        body={dict.calendar.gateBody}
        ctaLabel={dict.calendar.gateCta}
        locale={locale}
      />
    );

  const sp = await searchParams;
  const isMonth = sp.v === "month";
  const ref = monthFromParam(sp.m);
  const selected = dayFromParam(sp.d, ref);

  const supabase = await createClient();

  // Agenda looks forward from now; the month view covers the shown month
  // (spec §4.2) — including its already-past days.
  const bounds = isMonth
    ? monthBoundsUtc(ref)
    : { startIso: new Date().toISOString(), endIso: null };

  // The two membership sources (own rows only; both indexed lookups).
  const [{ data: memberships }, { data: rsvps }] = await Promise.all([
    supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", profile.id)
      .eq("status", "active"),
    supabase
      .from("event_rsvps")
      .select("event_id, status")
      .eq("user_id", profile.id),
  ]);
  const groupIds = (memberships ?? []).map((m) => m.group_id as string);
  const rsvpStatus = new Map(
    (rsvps ?? []).map((r) => [r.event_id as string, r.status as string]),
  );

  // One window, two scopes: the same bounded query filtered to my groups or
  // to my RSVP'd event ids.
  const eventCols = "id, title, starts_at, location";
  const windowedScope = (kind: "group" | "rsvp") => {
    let q = supabase
      .from("events")
      .select(eventCols)
      .eq("status", "active")
      .gte("starts_at", bounds.startIso)
      .order("starts_at", { ascending: true })
      .limit(isMonth ? 500 : 200);
    if (bounds.endIso) q = q.lt("starts_at", bounds.endIso);
    q =
      kind === "group"
        ? q.in("group_id", groupIds)
        : q.in("id", [...rsvpStatus.keys()]);
    return q.returns<CalendarEvent[]>().then((r) => r.data ?? []);
  };

  const [groupEvents, rsvpEvents, hidden] = await Promise.all([
    groupIds.length
      ? windowedScope("group")
      : Promise.resolve([] as CalendarEvent[]),
    rsvpStatus.size
      ? windowedScope("rsvp")
      : Promise.resolve([] as CalendarEvent[]),
    getHiddenIds(supabase, "event"),
  ]);

  // Merge, dedupe (an RSVP'd event in one of my groups appears once), sort on
  // the one shared clock, bound. Chronology is the only order (invariant 7).
  const byId = new Map<string, CalendarEvent>();
  for (const e of [...groupEvents, ...rsvpEvents]) {
    if (!hidden.has(e.id)) byId.set(e.id, e);
  }
  const events = [...byId.values()]
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .slice(0, isMonth ? 500 : 200);

  // Group under mono month heads (Redmond's calendar, not the browser's).
  const monthOf = new Intl.DateTimeFormat(locale, {
    timeZone: "America/Los_Angeles",
    month: "long",
    year: "numeric",
  });
  const months: { month: string; items: CalendarEvent[] }[] = [];
  for (const e of events) {
    const m = monthOf.format(new Date(e.starts_at));
    const last = months[months.length - 1];
    if (last && last.month === m) last.items.push(e);
    else months.push({ month: m, items: [e] });
  }

  // The when-line: time · place, plus the honest "· Maybe" tag on rows the
  // member answered maybe (spec §1.1; the mono line renders uppercase).
  const whenLine = (e: CalendarEvent) =>
    [
      formatRedmondDateTime(e.starts_at, locale),
      e.location,
      rsvpStatus.get(e.id) === "maybe" ? dict.calendar.maybeTag : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div lang={locale} className="flex flex-col gap-5">
      <Masthead
        title={dict.calendar.title}
        kicker={dict.calendar.dateline}
        voice={dict.calendar.voice}
        flush
      />
      <ViewToggle
        active={isMonth ? "month" : "agenda"}
        agendaHref={BASE}
        monthHref={`${BASE}?v=month`}
        dict={dict}
        className="-mt-1"
      />

      {isMonth ? (
        <MonthView
          events={events.map((e) => ({
            ...e,
            tag:
              rsvpStatus.get(e.id) === "maybe" ? dict.calendar.maybeTag : null,
          }))}
          locale={locale}
          dict={dict}
          basePath={BASE}
          month={ref}
          selectedDay={selected}
        />
      ) : events.length === 0 ? (
        <QuietEmpty
          title={dict.calendar.emptyTitle}
          sub={dict.calendar.emptySub}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {months.map((g) => (
            <section key={g.month} className="flex flex-col gap-1">
              <SectionLabel>{g.month}</SectionLabel>
              <ul className="flex flex-col border-t">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <DateTileRow
                      href={`/protected/events/${e.id}`}
                      iso={e.starts_at}
                      locale={locale}
                      title={e.title}
                      when={whenLine(e)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyCalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyCalendarContent searchParams={searchParams} />
    </Suspense>
  );
}
