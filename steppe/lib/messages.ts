import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Messaging read helpers (messages-m1-spec §3.4). Everything is RLS-scoped to
 * the acting member — these run under the member's own session client, so a
 * non-participant (moderator included) sees nothing. Poll-on-nav: the unread
 * dot recomputes on each server navigation; no realtime, no client state.
 */

export type InboxThread = {
  id: string;
  member_a: string;
  member_b: string;
  about_post_id: string | null;
};
export type InboxState = {
  thread_id: string;
  last_read_at: string | null;
  muted_at: string | null;
  left_at: string | null;
};
export type InboxMessage = {
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

/**
 * The messaging substrate — my threads, my per-thread state, and the recent
 * messages in those threads — fetched ONCE per request. Both the every-
 * navigation unread dot (getUnreadState, in the layout) and the inbox page
 * derive from this, so landing on /messages no longer runs threads +
 * thread_state + messages twice (perf-audit-v1 finding #5): React `cache()`
 * keys on my uid, so the two callers in a single render share one set of reads.
 *
 * Messages are scoped to MY threads (`.in(thread_id, …)`) so they ride
 * `messages_thread_idx` instead of scanning the whole messages table — the cost
 * is O(my messages), not O(all platform messages) (finding #4). Threads are the
 * authoritative membership list; the unread pass below still ignores any thread
 * I hold no state row for, so the boolean is unchanged.
 */
export const getInboxSubstrate = cache(async function getInboxSubstrate(
  uid: string,
): Promise<{
  threads: InboxThread[];
  states: InboxState[];
  messages: InboxMessage[];
}> {
  const supabase = await createClient();
  const [{ data: threads }, { data: states }] = await Promise.all([
    supabase
      .from("threads")
      .select("id, member_a, member_b, about_post_id")
      .returns<InboxThread[]>(),
    supabase
      .from("thread_state")
      .select("thread_id, last_read_at, muted_at, left_at")
      .returns<InboxState[]>(),
  ]);
  const threadRows = threads ?? [];
  const threadIds = threadRows.map((t) => t.id);
  const { data: msgs } = threadIds.length
    ? await supabase
        .from("messages")
        .select("thread_id, sender_id, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(400)
        .returns<InboxMessage[]>()
    : { data: [] as InboxMessage[] };
  // `uid` is part of the cache key (and asserts the reads were RLS-scoped to the
  // caller we think they were); it is not otherwise used here.
  void uid;
  return { threads: threadRows, states: states ?? [], messages: msgs ?? [] };
});

/**
 * True iff any unmuted thread has a message newer than my read cursor that
 * isn't mine — the boolean the unread dot shows (never a count; :1518). Derived
 * from the shared substrate, so it costs nothing beyond the substrate's reads
 * (which the inbox reuses on /messages).
 */
export async function getUnreadState(uid: string): Promise<boolean> {
  const { states, messages } = await getInboxSubstrate(uid);
  const state = new Map(states.map((s) => [s.thread_id, s]));
  const seen = new Set<string>();
  for (const m of messages) {
    // The newest message per thread decides that thread (desc order → first
    // seen is newest); later (older) rows for the same thread don't matter.
    if (seen.has(m.thread_id)) continue;
    seen.add(m.thread_id);
    const s = state.get(m.thread_id);
    if (!s || s.muted_at) continue;
    // Left (archived) threads don't dot unless a NEW message arrived after I
    // left — mirrors the inbox filter, per spec §3.4's "unleft" clause.
    if (s.left_at && Date.parse(m.created_at) <= Date.parse(s.left_at)) continue;
    if (m.sender_id === uid) continue;
    if (!s.last_read_at || Date.parse(m.created_at) > Date.parse(s.last_read_at)) {
      return true;
    }
  }
  return false;
}
