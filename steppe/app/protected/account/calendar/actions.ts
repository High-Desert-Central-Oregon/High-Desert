"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Calendar-feed actions (calendar-c1-spec §1.4): mint / rotate / remove.
 * The database is the gate — mint and rotate are SECURITY DEFINER RPCs
 * (0020) that generate the secret server-side and enforce standing; remove
 * is a plain RLS delete (cf_delete, owner-only). These actions add nothing
 * but navigation: failures land back on the page with a quiet notice
 * (?feedErr=1) instead of a dead end.
 */

const PAGE = "/protected/account/calendar";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireSession() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
}

export async function mintPersonalFeed() {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mint_calendar_feed");
  if (error) redirect(`${PAGE}?feedErr=1`);
  revalidatePath(PAGE);
  redirect(`${PAGE}#feed-${data?.[0]?.feed_id ?? ""}`);
}

/** Minted from a group page (hidden group_id field); lands on You where the
 *  URL renders — the secret displays in exactly one place (spec §1.4). */
export async function mintGroupFeed(formData: FormData) {
  await requireSession();
  const groupId = String(formData.get("group_id") ?? "");
  if (!UUID.test(groupId)) redirect(`${PAGE}?feedErr=1`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mint_calendar_feed", {
    p_group: groupId,
  });
  if (error) redirect(`${PAGE}?feedErr=1`);
  revalidatePath(PAGE);
  redirect(`${PAGE}#feed-${data?.[0]?.feed_id ?? ""}`);
}

export async function rotateFeed(formData: FormData) {
  await requireSession();
  const feedId = String(formData.get("feed_id") ?? "");
  if (!UUID.test(feedId)) redirect(`${PAGE}?feedErr=1`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_calendar_feed", {
    p_feed: feedId,
  });
  if (error) redirect(`${PAGE}?feedErr=1`);
  revalidatePath(PAGE);
  redirect(`${PAGE}#feed-${feedId}`);
}

export async function removeFeed(formData: FormData) {
  await requireSession();
  const feedId = String(formData.get("feed_id") ?? "");
  if (!UUID.test(feedId)) redirect(`${PAGE}?feedErr=1`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_feeds")
    .delete()
    .eq("id", feedId);
  if (error) redirect(`${PAGE}?feedErr=1`);
  revalidatePath(PAGE);
  redirect(PAGE);
}
