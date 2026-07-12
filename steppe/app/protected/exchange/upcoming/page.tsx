import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { Masthead } from "@/components/broadsheet/masthead";
import { SectionLabel } from "@/components/broadsheet/section-row";
import { DateTileRow } from "@/components/broadsheet/date-tile-row";
import { VerifiedGate } from "@/components/verified-gate";
import { ExchangeSegments } from "../exchange-segments";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { getHiddenIds } from "@/lib/moderation";

export const metadata = {
  title: "Upcoming · Steppe",
};

/**
 * The Exchange's UPCOMING segment (spec §7.1) — the calendar as the bundle
 * draws calendars: an agenda of date-tile rows, soonest first, grouped under
 * mono month heads. No month grid (the bundle contains none; a grid is the
 * wrong shape for a slow phone). Chronology is the only order (invariant 7).
 * RLS scopes rows to boards the member belongs to (Everyone + their groups).
 */

type UpcomingEvent = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
};

async function UpcomingContent() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const { locale, dict } = await getServerDictionary();

  if (!profile.verified)
    return (
      <VerifiedGate
        title={dict.exchange.gateTitle}
        body={dict.exchange.gateBody}
        ctaLabel={dict.exchange.gateCta}
        locale={locale}
      />
    );

  const supabase = await createClient();
  const [{ data: rows }, hidden] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, location")
      .eq("status", "active")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(100)
      .returns<UpcomingEvent[]>(),
    getHiddenIds(supabase, "event"),
  ]);
  const events = (rows ?? []).filter((e) => !hidden.has(e.id));

  // Group under mono month heads (Redmond's calendar, not the browser's).
  const monthOf = new Intl.DateTimeFormat(locale, {
    timeZone: "America/Los_Angeles",
    month: "long",
    year: "numeric",
  });
  const groups: { month: string; items: UpcomingEvent[] }[] = [];
  for (const e of events) {
    const m = monthOf.format(new Date(e.starts_at));
    const last = groups[groups.length - 1];
    if (last && last.month === m) last.items.push(e);
    else groups.push({ month: m, items: [e] });
  }

  return (
    <div lang={locale} className="flex flex-col gap-5">
      <Masthead
        title={dict.exchange.title}
        kicker={dict.exchange.dateline}
        voice={dict.exchange.voice}
        flush
      />
      <ExchangeSegments active="upcoming" dict={dict} />

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {dict.exchange.upcomingEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
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
                      when={[
                        formatRedmondDateTime(e.starts_at, locale),
                        e.location,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
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

export default function UpcomingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UpcomingContent />
    </Suspense>
  );
}
