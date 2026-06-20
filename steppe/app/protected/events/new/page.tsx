import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EventForm } from "./event-form";
import { VerifiedGate } from "@/components/verified-gate";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata = {
  title: "Create an event · Steppe",
};

type NeighborhoodRow = { id: string; name: string };

async function NewEventContent() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();

  // Verified-only to create (enforced by RLS; this is the friendly gate).
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
  const { data: neighborhoods } = await supabase
    .from("neighborhoods")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<NeighborhoodRow[]>();

  return (
    <div lang={locale} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/protected/events"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {dict.events.backToEvents}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.events.newTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.events.newIntro}</p>
      </div>

      <EventForm
        neighborhoods={neighborhoods ?? []}
        defaultNeighborhoodId={profile.neighborhood_id}
        dict={dict}
      />
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewEventContent />
    </Suspense>
  );
}
