import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Messaging read helpers (messages-m1-spec §3.4). Everything is RLS-scoped to
 * the acting member — these run under the member's own session client, so a
 * non-participant (moderator included) sees nothing. Poll-on-nav: the unread
 * dot recomputes on each server navigation; no realtime, no client state.
 */

type StateRow = {
  thread_id: string;
  last_read_at: string | null;
  muted_at: string | null;
  left_at: string | null;
};

type MsgRow = {
  thread_id: string;
  sender_id: string;
  created_at: string;
};

/**
 * True iff any unmuted thread has a message newer than my read cursor that
 * isn't mine. Two RLS-scoped reads + a JS pass — cheap at cohort scale, and
 * the dot is a boolean (never a count; :1518).
 */
export async function getUnreadState(
  supabase: SupabaseClient,
  uid: string,
): Promise<boolean> {
  const [{ data: states }, { data: msgs }] = await Promise.all([
    supabase
      .from("thread_state")
      .select("thread_id, last_read_at, muted_at, left_at")
      .returns<StateRow[]>(),
    supabase
      .from("messages")
      .select("thread_id, sender_id, created_at")
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<MsgRow[]>(),
  ]);

  const state = new Map((states ?? []).map((s) => [s.thread_id, s]));
  const seen = new Set<string>();
  for (const m of msgs ?? []) {
    // The newest message per thread decides that thread (desc order → first
    // seen is newest); later (older) rows for the same thread don't matter.
    if (seen.has(m.thread_id)) continue;
    seen.add(m.thread_id);
    const s = state.get(m.thread_id);
    if (!s || s.muted_at) continue;
    if (m.sender_id === uid) continue;
    if (!s.last_read_at || Date.parse(m.created_at) > Date.parse(s.last_read_at)) {
      return true;
    }
  }
  return false;
}
