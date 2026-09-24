"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyProfile } from "@/lib/auth";
import { parseEventInput } from "@/lib/event-input";

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

  const parsed = parseEventInput(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      creator_id: profile.id,
      ...parsed.values,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { error: "create-failed" };

  revalidatePath("/protected/events");
  // The list surface events actually appear on is the Exchange board now.
  revalidatePath("/protected/exchange");
  redirect(`/protected/events/${data.id}`);
}

/** Invalidate every in-app projection; calendar feeds read current rows. */
function refreshEvent(id: string) {
  revalidatePath(`/protected/events/${id}`);
  revalidatePath(`/protected/events/${id}/edit`);
  revalidatePath("/protected/events");
  revalidatePath("/protected/exchange");
  revalidatePath("/protected/exchange/upcoming");
  revalidatePath("/protected/account/calendar");
  revalidatePath("/protected/groups", "layout");
}

/** The creator predicate applies even when the caller is a moderator. */
export async function updateEvent(
  id: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified) return { error: "forbidden" };
  const db = await createClient();
  const { data: existing, error: readError } = await db
    .from("events")
    .select("starts_at, ends_at")
    .eq("id", id)
    .eq("creator_id", profile.id)
    .maybeSingle<{ starts_at: string; ends_at: string | null }>();
  if (readError || !existing) return { error: "update-failed" };
  const parsed = parseEventInput(formData, existing);
  if ("error" in parsed) return parsed;
  const { data, error } = await db
    .from("events")
    .update(parsed.values)
    .eq("id", id)
    .eq("creator_id", profile.id)
    .select("id")
    .single();
  if (error || !data) return { error: "update-failed" };
  refreshEvent(id);
  redirect(`/protected/events/${id}?saved=1`);
}

/** Database cascade removes RSVPs; moderation/audit history stays append-only. */
export async function deleteEvent(
  id: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.verified || formData.get("confirm") !== "delete")
    return { error: "forbidden" };
  const db = await createClient();
  const { data, error } = await db
    .from("events")
    .delete()
    .eq("id", id)
    .eq("creator_id", profile.id)
    .select("id")
    .single();
  if (error || !data) return { error: "delete-failed" };
  refreshEvent(id);
  redirect("/protected/exchange?eventDeleted=1");
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

  if (bringing.length > 120) return { error: "too-long" };
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
  revalidatePath("/protected/exchange");
  revalidatePath("/protected/exchange/upcoming");
  revalidatePath("/protected/account/calendar");
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
  revalidatePath("/protected/exchange");
  revalidatePath("/protected/exchange/upcoming");
  revalidatePath("/protected/account/calendar");
  return { ok: true };
}
