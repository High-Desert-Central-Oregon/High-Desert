import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { PageSkeleton } from "@/components/page-skeleton";
import { EventForm } from "../../new/event-form";
import type { EventRow } from "@/lib/types/db";

export const metadata = { title: "Edit event · Steppe" };
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) notFound();
  const db = await createClient();
  const { data: event } = await db
    .from("events")
    .select("id,title,body,starts_at,ends_at,location,capacity,neighborhood_id")
    .eq("id", id)
    .eq("creator_id", profile.id)
    .maybeSingle<EventRow>();
  if (!event) notFound();
  const { data: neighborhoods } = await db
    .from("neighborhoods")
    .select("id,name")
    .order("name");
  const { locale, dict } = await getServerDictionary();
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <Link
        href={`/protected/events/${id}`}
        className="min-h-11 inline-flex items-center self-start underline focus-ring"
      >
        {dict.events.backToEvent}
      </Link>
      <h1 className="text-2xl font-semibold">{dict.events.edit}</h1>
      <EventForm
        initial={event}
        neighborhoods={neighborhoods ?? []}
        defaultNeighborhoodId={event.neighborhood_id}
        dict={dict}
      />
    </div>
  );
}
export default function EditEventPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Edit {...props} />
    </Suspense>
  );
}
