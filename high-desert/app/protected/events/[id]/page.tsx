import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VerifiedNotice } from "../verified-notice";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatEventDateTime } from "@/lib/events";
import { t } from "@/lib/i18n";
import type { EventRow } from "@/lib/types/db";

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
      .from("profiles")
      .select("display_name")
      .eq("id", event.creator_id)
      .maybeSingle<{ display_name: string }>(),
  ]);

  const neighborhoodLabel = nb?.name ?? dict.events.allRedmond;

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
              {formatEventDateTime(event.starts_at, locale)}
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
                {t(dict.events.capacityValue, { count: event.capacity })}
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
