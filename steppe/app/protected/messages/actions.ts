"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Messaging server actions (messages-m1-spec §5–§6). The database is the gate
 * at every step: start_thread() (verified, post-anchored, no-oracle, rate-
 * capped) and can_send (RLS) enforce the rules; these actions only carry
 * navigation and pin identity. No-oracle refusals surface as one generic
 * notice — never "you're blocked" / "they left".
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = "/protected/messages";

async function requireSession() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return user;
}

/** Post-anchored start: the "Message {FirstName}" composer on post detail. */
export async function startThread(formData: FormData) {
  await requireSession();
  const withId = String(formData.get("with_id") ?? "");
  const aboutPost = String(formData.get("about_post") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const back = String(formData.get("back") ?? "");
  const safeBack = back.startsWith("/protected") ? back : "/protected/exchange";
  if (!UUID.test(withId) || !UUID.test(aboutPost) || !body) {
    redirect(`${safeBack}?msgErr=1`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_thread", {
    p_with: withId,
    p_body: body.slice(0, 4000),
    p_about_post: aboutPost,
  });
  if (error || !data) redirect(`${safeBack}?msgErr=1`);
  revalidatePath(BASE);
  redirect(`${BASE}/${data}`);
}

/** Reply into an existing thread — a plain RLS insert (msg_insert/can_send). */
export async function sendReply(formData: FormData) {
  const user = await requireSession();
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!UUID.test(threadId) || !body) redirect(`${BASE}/${threadId}?msgErr=1`);

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    body: body.slice(0, 4000),
  });
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${threadId}`);
  redirect(`${BASE}/${threadId}${error ? "?msgErr=1" : ""}`);
}

/** Mute / unmute — own-row thread_state (dot suppression). */
export async function toggleMute(formData: FormData) {
  const user = await requireSession();
  const threadId = String(formData.get("thread_id") ?? "");
  const muted = String(formData.get("muted") ?? "") === "1";
  if (!UUID.test(threadId)) redirect(`${BASE}/${threadId}`);
  const supabase = await createClient();
  await supabase
    .from("thread_state")
    .update({ muted_at: muted ? null : new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("member_id", user.id);
  revalidatePath(`${BASE}/${threadId}`);
  redirect(`${BASE}/${threadId}`);
}

/** Leave = archive (own-row left_at). Back to the inbox; a new message
 *  resurfaces the thread — no re-entry ceremony. */
export async function leaveThread(formData: FormData) {
  const user = await requireSession();
  const threadId = String(formData.get("thread_id") ?? "");
  if (!UUID.test(threadId)) redirect(BASE);
  const supabase = await createClient();
  await supabase
    .from("thread_state")
    .update({ left_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("member_id", user.id);
  revalidatePath(BASE);
  redirect(BASE);
}

/** Block a neighbor — SILENT (M-G3): no notification, freezes the pair's
 *  thread both ways. Back to the inbox. */
export async function blockNeighbor(formData: FormData) {
  const user = await requireSession();
  const blockedId = String(formData.get("blocked_id") ?? "");
  if (!UUID.test(blockedId)) redirect(BASE);
  const supabase = await createClient();
  await supabase
    .from("member_blocks")
    .insert({ blocker_id: user.id, blocked_id: blockedId });
  revalidatePath(BASE);
  redirect(BASE);
}

/**
 * Report a conversation (the consent-based disclosure, §6.4): the reporter
 * attaches their OWN quoted view of the thread; moderators read the excerpt,
 * never the thread. rp_insert requires the reporter be a participant.
 */
export async function reportThread(formData: FormData) {
  const user = await requireSession();
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "");
  if (!UUID.test(threadId) || !body) redirect(`${BASE}/${threadId}?msgErr=1`);
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: "message_thread",
    target_id: threadId,
    body: body.slice(0, 2000),
    quoted_excerpt: excerpt.slice(0, 4000),
  });
  revalidatePath(`${BASE}/${threadId}`);
  redirect(`${BASE}/${threadId}?${error ? "msgErr" : "reported"}=1`);
}
