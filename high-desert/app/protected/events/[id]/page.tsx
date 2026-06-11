import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VerifiedNotice } from "../verified-notice";
import { RsvpForm } from "./rsvp-form";
import { RemovedBanner } from "../../moderation/removed-banner";
import { ModerationControl } from "../../moderation/moderation-control";
import { AppealArea } from "../../moderation/appeal-area";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { getContentModeration } from "@/lib/moderation";
import { t, plural } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";
import type { EventRow, RsvpStatus } from "@/lib/types/db";

type RsvpRow = {
  user_id: string;
  status: RsvpStatus;
  bringing: string | null;
};

/** One status group of attendees, with what each is bringing (light coordination). */
function AttendeeList({
  heading,
  rows,
  names,
  dict,
}: {
  heading: string;
  rows: RsvpRow[];
  names: Map<string, string>;
  dict: Dictionary;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{heading}</h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.user_id} className="text-sm">
            <span className="font-medium">{names.get(r.user_id) ?? "—"}</span>
            {r.bringing && (
              <span className="text-muted-foreground">
                {" "}
                — {t(dict.rsvp.bringingTag, { item: r.bringing })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const metadata = {
  title: "Event · High Desert",
};

async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();
  if (!profile.verified) return <VerifiedNotice dict={dict} locale={locale} />;

  const supabase = await createClient();

  // RLS (ev_read) only returns rows to verified members; a missing row (gone or
  // never existed) is a clean 404.
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, creator_id, neighborhood_id, title, body, starts_at, location, capacity, status, created_at",
    )
    .eq("id", id)
    .maybeSingle<EventRow>();

  if (!event) notFound();

  const isMod = profile.role === "moderator" || profile.role === "admin";

  // If a moderator removed this event, show the legible removed state instead of
  // the content — never a silent disappearance (P7). The event isn't deleted;
  // the affected member can appeal (Part 3), and a moderator can restore it.
  const moderation = await getContentModeration(supabase, "event", event.id);
  if (moderation?.hidden) {
    const isOwner = event.creator_id === profile.id;
    return (
      <div lang={locale} className="flex flex-col gap-6">
        <Link
          href="/protected/events"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {dict.events.backToEvents}
        </Link>
        <RemovedBanner targetType="event" reason={moderation.reason} dict={dict}>
          <AppealArea
            actionId={moderation.actionId}
            targetType="event"
            targetId={event.id}
            isOwner={isOwner}
            dict={dict}
          />
        </RemovedBanner>
        {isMod && (
          <ModerationControl
            targetType="event"
            targetId={event.id}
            mode="restore"
            dict={dict}
          />
        )}
      </div>
    );
  }

  // Neighborhood name + host name, resolved in parallel.
  const [{ data: nb }, { data: host }] = await Promise.all([
    event.neighborhood_id
      ? supabase
          .from("neighborhoods")
          .select("name")
          .eq("id", event.neighborhood_id)
          .maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null }),
    supabase
      .from("public_profiles") // public columns only; tenure_start stays private
      .select("display_name")
      .eq("id", event.creator_id)
      .maybeSingle<{ display_name: string }>(),
  ]);

  const neighborhoodLabel = nb?.name ?? dict.events.allRedmond;

  // RSVPs for this event, oldest first (chronological — invariant 7). Verified
  // members can read them (rs_read); names are resolved in a second query.
  const { data: rsvpData } = await supabase
    .from("event_rsvps")
    .select("user_id, status, bringing")
    .eq("event_id", event.id)
    .order("created_at", { ascending: true })
    .returns<RsvpRow[]>();

  const rsvps = rsvpData ?? [];
  const rsvpNames = new Map<string, string>();
  const rsvpUserIds = [...new Set(rsvps.map((r) => r.user_id))];
  if (rsvpUserIds.length > 0) {
    const { data: people } = await supabase
      .from("public_profiles") // public columns only; tenure_start stays private
      .select("id, display_name")
      .in("id", rsvpUserIds);
    for (const p of people ?? []) rsvpNames.set(p.id, p.display_name);
  }

  const going = rsvps.filter((r) => r.status === "going");
  const maybe = rsvps.filter((r) => r.status === "maybe");
  const myRsvp = rsvps.find((r) => r.user_id === profile.id) ?? null;

  return (
    <article lang={locale} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/protected/events"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {dict.events.backToEvents}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {event.title}
          </h1>
          <Badge variant="secondary">{neighborhoodLabel}</Badge>
        </div>
        {host?.display_name && (
          <p className="text-sm text-muted-foreground">
            {t(dict.events.hostedBy, { name: host.display_name })}
          </p>
        )}
      </div>

      {/* Key facts */}
      <dl className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm">
        <div className="flex items-start gap-2.5">
          <CalendarDays
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <dt className="font-medium">{dict.events.whenLabel}</dt>
            <dd className="text-muted-foreground">
              {formatRedmondDateTime(event.starts_at, locale)}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <MapPin
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <dt className="font-medium">{dict.events.whereLabel}</dt>
            <dd className="text-muted-foreground">
              {event.location ?? dict.events.noLocation}
            </dd>
          </div>
        </div>

        {event.capacity != null && (
          <div className="flex items-start gap-2.5">
            <Users
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <dt className="font-medium">{dict.events.capacityLabel}</dt>
              <dd className="text-muted-foreground">
                {plural(locale, event.capacity, dict.events.capacityValue)}
              </dd>
            </div>
          </div>
        )}
      </dl>

      {/* Details — read-only prose, never a comment thread (P12). */}
      {event.body && (
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {event.body}
        </div>
      )}

      {/* Coordination: RSVP + who's coming. Light coordination, not a discussion
          surface — there is no reply or comment affordance (P12). */}
      <RsvpForm
        eventId={event.id}
        initialStatus={myRsvp?.status ?? null}
        initialBringing={myRsvp?.bringing ?? null}
        dict={dict}
      />

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium">{dict.rsvp.heading}</h2>
          {event.capacity != null && (
            <span className="text-sm text-muted-foreground">
              {plural(locale, event.capacity, dict.rsvp.spotsTaken, {
                going: going.length,
              })}
            </span>
          )}
        </div>

        {rsvps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.rsvp.noneYet}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <AttendeeList
              heading={t(dict.rsvp.goingCount, { count: going.length })}
              rows={going}
              names={rsvpNames}
              dict={dict}
            />
            <AttendeeList
              heading={t(dict.rsvp.maybeCount, { count: maybe.length })}
              rows={maybe}
              names={rsvpNames}
              dict={dict}
            />
          </div>
        )}
      </section>

      {isMod && (
        <ModerationControl
          targetType="event"
          targetId={event.id}
          mode="remove"
          dict={dict}
        />
      )}
    </article>
  );
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense>
      <EventDetail params={params} />
    </Suspense>
  );
}
