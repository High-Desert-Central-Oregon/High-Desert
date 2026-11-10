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
  about_group_id: string | null;
  request_status: "pending" | "accepted" | "declined";
  started_by: string;
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

type ThreadSummary = InboxThread & { latest: InboxMessage[]; incoming: InboxMessage[] };
const PAGE_SIZE = 200;

/** Read every RLS-visible thread page, with a per-thread message limit. The
 * database caps embedded messages independently, so a busy thread cannot hide
 * a quiet one. Incoming summaries preserve unread replies after a self-send.
 */
export const getInboxSubstrate = cache(async function getInboxSubstrate(uid: string): Promise<{
  threads: InboxThread[];
  states: InboxState[];
  messages: InboxMessage[];
  incomingMessages: InboxMessage[];
}> {
  const supabase = await createClient();
  const summaries: ThreadSummary[] = [];
  const states: InboxState[] = [];
  // Keyset pagination avoids the platform's default row cap. No member content
  // or raw provider errors are copied into an exception or monitoring payload.
  await Promise.all([
    (async () => {
      let cursor: string | undefined;
      while (true) {
        let query = supabase.from("threads")
          .select("id, member_a, member_b, about_post_id, about_group_id, request_status, started_by, latest:messages(thread_id, sender_id, body, created_at), incoming:messages(thread_id, sender_id, body, created_at)")
          .order("id")
          .order("created_at", { referencedTable: "latest", ascending: false })
          .order("id", { referencedTable: "latest", ascending: false })
          .limit(1, { referencedTable: "latest" })
          .neq("incoming.sender_id", uid)
          .order("created_at", { referencedTable: "incoming", ascending: false })
          .order("id", { referencedTable: "incoming", ascending: false })
          .limit(1, { referencedTable: "incoming" })
          .limit(PAGE_SIZE);
        if (cursor) query = query.gt("id", cursor);
        const { data, error } = await query.returns<ThreadSummary[]>();
        if (error || !data) throw new Error("Messages temporarily unavailable");
        summaries.push(...data);
        if (data.length < PAGE_SIZE) break;
        cursor = data[data.length - 1].id;
      }
    })(),
    (async () => {
      let cursor: string | undefined;
      while (true) {
        let query = supabase.from("thread_state")
          .select("thread_id, last_read_at, muted_at, left_at")
          .order("thread_id").limit(PAGE_SIZE);
        if (cursor) query = query.gt("thread_id", cursor);
        const { data, error } = await query.returns<InboxState[]>();
        if (error || !data) throw new Error("Messages temporarily unavailable");
        states.push(...data);
        if (data.length < PAGE_SIZE) break;
        cursor = data[data.length - 1].thread_id;
      }
    })(),
  ]);
  return {
    threads: summaries.map(({ latest, incoming, ...thread }) => { void latest; void incoming; return thread; }),
    states,
    messages: summaries.flatMap((thread) => thread.latest),
    incomingMessages: summaries.flatMap((thread) => thread.incoming),
  };
});

/** Null means unavailable, never a claim that the inbox has no unread mail. */
export async function getUnreadState(uid: string): Promise<boolean | null> {
  try {
    const { states, incomingMessages } = await getInboxSubstrate(uid);
    const state = new Map(states.map((s) => [s.thread_id, s]));
    return incomingMessages.some((m) => {
      const s = state.get(m.thread_id);
      return !!s && !s.muted_at && m.sender_id !== uid &&
        (!s.left_at || Date.parse(m.created_at) > Date.parse(s.left_at)) &&
        (!s.last_read_at || Date.parse(m.created_at) > Date.parse(s.last_read_at));
    });
  } catch {
    return null;
  }
}
