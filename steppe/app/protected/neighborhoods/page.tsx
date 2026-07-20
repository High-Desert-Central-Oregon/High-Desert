import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { NeighborhoodForm } from "./neighborhood-form";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata = {
  title: "Your neighborhood · Steppe",
};

type NeighborhoodRow = { id: string; name: string };

async function NeighborhoodContent() {
  // LOAD-BEARING — keeps the picker's shown selection in sync with the committed
  // row. Do NOT remove this line, and do NOT wrap the profile read below in
  // `"use cache"`.
  //
  // It forces this segment to render PER-REQUEST so the `neighborhood_id` read
  // reflects the COMMITTED row. Under cacheComponents the dynamic hole can
  // otherwise be served from the prerendered render on the immediate post-action
  // re-render (after setNeighborhood → revalidatePath); the remounted
  // NeighborhoodForm would then re-seed `selected` from the PRE-write `currentId`,
  // so the radio would snap back to the prior neighborhood while the DB (correctly)
  // holds the new one — displayed state disagreeing with the saved value. With
  // connection() the read runs against the committed row every time, so the shown
  // selection matches what persisted. (Same stale-render class as the
  // profile-visibility guards; see account/profile/page.tsx.)
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();
  const supabase = await createClient();

  // All seeded neighborhoods, alphabetical — chronological + alpha is the only
  // allowed ordering (invariant 7; no ranking or scoring).
  const { data: neighborhoods } = await supabase
    .from("neighborhoods")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<NeighborhoodRow[]>();

  // The member's current neighborhood selection (may be null).
  const { data: profile } = await supabase
    .from("profiles")
    .select("neighborhood_id")
    .eq("id", user.id)
    .maybeSingle<{ neighborhood_id: string | null }>();

  // Does the member have an open "none fits" help request awaiting follow-up?
  // (RLS lets a member read their own requests.)
  const { data: openRequest } = await supabase
    .from("neighborhood_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "open")
    .maybeSingle<{ id: string }>();

  return (
    <div lang={locale} className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.neighborhoods.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dict.neighborhoods.intro}
        </p>
      </header>

      {openRequest && (
        <p
          role="status"
          className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          {dict.neighborhoods.openRequestNotice}
        </p>
      )}

      <NeighborhoodForm
        neighborhoods={neighborhoods ?? []}
        currentId={profile?.neighborhood_id ?? null}
        dict={dict}
      />
    </div>
  );
}

export default function NeighborhoodPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NeighborhoodContent />
    </Suspense>
  );
}
