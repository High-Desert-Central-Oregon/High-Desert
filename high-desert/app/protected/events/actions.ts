"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";

export type EventFormState = { error: string } | null;

/**
 * Create a neighborhood gathering. Verified members only — checked here for a
 * friendly error, and enforced for real by RLS (ev_insert: is_verified() and
 * creator_id = auth.uid()). The client never sets trust; creator_id is pinned to
 * the signed-in member here, and RLS rejects anything else.
 *
 * On success we redirect to the new event's page. There is deliberately no
 * comment field — events are for coordination, not a discussion feed (P12).
 */
export async function createEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) return { error: "forbidden" };

  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const neighborhoodRaw = String(formData.get("neighborhood_id") ?? "").trim();

  if (!title) return { error: "title-required" };
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    return { error: "when-required" };
  }

  const capacity = Number.parseInt(capacityRaw, 10);
  const neighborhoodId =
    neighborhoodRaw && neighborhoodRaw !== "all" ? neighborhoodRaw : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      creator_id: profile.id,
      neighborhood_id: neighborhoodId,
      title,
      body: body.length > 0 ? body : null,
      starts_at: new Date(startsAt).toISOString(),
      location: location.length > 0 ? location : null,
      capacity: Number.isInteger(capacity) && capacity > 0 ? capacity : null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { error: "create-failed" };

  revalidatePath("/protected/events");
  redirect(`/protected/events/${data.id}`);
}
