"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyProfile } from "@/lib/auth";
import { redmondWallTimeToUtcISO } from "@/lib/time";

export type EventFormState = { error: string } | null;
export type RsvpState = { ok: true } | { error: string } | null;

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
  // The form sends a wall-clock value; interpret it as Redmond time, not the
  // browser's or server's timezone (lib/time.ts).
  const startsAtIso = redmondWallTimeToUtcISO(startsAt);
  if (!startsAtIso) return { error: "when-required" };

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
      starts_at: startsAtIso,
      location: location.length > 0 ? location : null,
      capacity: Number.isInteger(capacity) && capacity > 0 ? capacity : null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { error: "create-failed" };

  revalidatePath("/protected/events");
  redirect(`/protected/events/${data.id}`);
}

/**
 * RSVP to an event (going / maybe), optionally noting what you're bringing. One
 * row per member per event (DB unique constraint), so this is an upsert keyed on
 * (event_id, user_id). Verified-only — checked here and enforced by RLS
 * (rs_insert / rs_update both pin the row to auth.uid()). The bringing field is
 * light coordination only, never a discussion thread (P12).
 */
export async function setRsvp(
  _prev: RsvpState,
  formData: FormData,
): Promise<RsvpState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) return { error: "forbidden" };

  const eventId = String(formData.get("event_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const bringing = String(formData.get("bringing") ?? "").trim();

  if (!eventId) return { error: "bad-event" };
  if (status !== "going" && status !== "maybe") return { error: "bad-status" };

  const supabase = await createClient();
  const { error } = await supabase.from("event_rsvps").upsert(
    {
      event_id: eventId,
      user_id: profile.id,
      status,
      bringing: bringing.length > 0 ? bringing : null,
    },
    { onConflict: "event_id,user_id" },
  );

  if (error) return { error: "rsvp-failed" };

  revalidatePath(`/protected/events/${eventId}`);
  return { ok: true };
}

/**
 * Withdraw an RSVP. Deletes the member's own row (rs_delete: user_id =
 * auth.uid()) — changing your mind is a routine, effortless action (invariant 10).
 */
export async function cancelRsvp(
  _prev: RsvpState,
  formData: FormData,
): Promise<RsvpState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const eventId = String(formData.get("event_id") ?? "").trim();
  if (!eventId) return { error: "bad-event" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_rsvps")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id);

  if (error) return { error: "cancel-failed" };

  revalidatePath(`/protected/events/${eventId}`);
  return { ok: true };
}
