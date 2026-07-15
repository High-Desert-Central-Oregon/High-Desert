import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { Masthead } from "@/components/broadsheet/masthead";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { ProfileForm } from "./profile-form";

/**
 * Profile editor (Y1) — the net-new "edit your name + choose what's visible"
 * surface, filed under You. Loads the member's OWN profile (own row, so every
 * field is readable to them) and the neighborhood NAME the visibility toggle
 * governs. The write paths (name, per-field visibility) live in
 * account/actions.ts and go through pf_update (own row only).
 */
async function ProfileEditor() {
  // LOAD-BEARING — required for the profile-visibility privacy invariant. Do NOT
  // remove this line, and do NOT wrap the profile read below in `"use cache"`.
  //
  // It forces this segment to render PER-REQUEST so `getMyProfile()` reflects the
  // COMMITTED row. Under cacheComponents the dynamic hole can otherwise be served
  // from the prerendered render on the immediate post-action re-render (after
  // setFieldVisibility → revalidatePath); the remounted VisibilityControl would
  // then re-seed `selected` from the PRE-write value, so the chip would snap back
  // while the DB (correctly) holds the new value — displayed state disagreeing
  // with enforced state on a privacy control, in the false-private direction.
  // With connection() the read runs against the committed row every time, so
  // displayed state == enforced state after a toggle. (Regression traced to the
  // stale-render finding; see the profile-visibility guards.)
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  if (!profile) redirect("/protected");

  // The neighborhood name is what "Hidden / Visible to members" governs; show it
  // for context. Own row, so reading the label is fine.
  let neighborhoodName: string | null = null;
  if (profile.neighborhood_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("neighborhoods")
      .select("name")
      .eq("id", profile.neighborhood_id)
      .maybeSingle();
    neighborhoodName = data?.name ?? null;
  }

  return (
    <div lang={locale} className="flex flex-col gap-8">
      <Masthead
        title={dict.account.profileTitle}
        voice={dict.account.profileIntro}
        flush
      />
      <ProfileForm
        displayName={profile.display_name}
        fields={[
          {
            field: "neighborhood_visibility",
            label: dict.account.fieldNeighborhood,
            value: neighborhoodName,
            visibility: profile.neighborhood_visibility,
          },
        ]}
        dict={dict}
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileEditor />
    </Suspense>
  );
}
