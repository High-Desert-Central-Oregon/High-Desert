import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/supabase/server", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return { createClient: async () => createClient("https://synthetic.supabase.co", "synthetic-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: m.fetch },
  }) };
});
import { getInboxSubstrate, getUnreadState } from "@/lib/messages";
import { MessagesSlot } from "@/app/protected/messages-slot";
const uid = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const at = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString();
const message = (thread: string, sender: string, time: number) => ({ thread_id: thread, sender_id: sender, body: "synthetic", created_at: at(time) });
const thread = (id: string, latest = [message(id, other, 10)], incoming = latest) => ({ id, member_a: uid, member_b: other, about_post_id: null, about_group_id: null, request_status: "accepted", started_by: uid, latest, incoming });
const state = (id: string) => ({ thread_id: id, last_read_at: at(0), muted_at: null as string | null, left_at: null as string | null });
let threads: ReturnType<typeof thread>[];
let states: ReturnType<typeof state>[];
let fail: string | undefined;
let urls: URL[];
beforeEach(() => {
  threads = [thread("quiet")]; states = [state("quiet")]; fail = undefined; urls = [];
  m.fetch.mockReset();
  m.fetch.mockImplementation(async (input: string) => {
    const url = new URL(input); urls.push(url);
    const table = url.pathname.split("/").pop();
    if (fail === table) return new Response(JSON.stringify({ message: "private provider detail", code: "42501" }), { status: 403 });
    const key = table === "threads" ? "id" : "thread_id";
    const cursor = url.searchParams.get(key)?.replace(/^gt\./, "") || "";
    const rows = table === "threads" ? threads : states;
    const page = rows.filter((row) => (key === "id" ? (row as ReturnType<typeof thread>).id : (row as ReturnType<typeof state>).thread_id) > cursor).slice(0, Number(url.searchParams.get("limit")));
    return new Response(JSON.stringify(page), { headers: { "Content-Type": "application/json" } });
  });
});
describe("message reads through the real Supabase query builder", () => {
  it.each(["threads", "thread_state"])("keeps %s failure distinct from emptiness without exposing provider details", async (table) => {
    fail = table;
    await expect(getInboxSubstrate(uid)).rejects.toThrow("Messages temporarily unavailable");
    expect(await getUnreadState(uid)).toBeNull();
  });
  it("returns known false for a successful empty inbox", async () => {
    threads = []; states = [];
    expect(await getUnreadState(uid)).toBe(false);
    expect((await getInboxSubstrate(uid)).threads).toEqual([]);
  });
  it("requests independent per-thread summaries so 400 newer busy messages cannot evict a quiet thread", async () => {
    const busy = Array.from({ length: 400 }, (_, n) => message("busy", uid, n + 11));
    threads.push(thread("busy", [busy[399]], [])); states.push(state("busy"));
    const result = await getInboxSubstrate(uid);
    expect(result.messages.map((row) => row.thread_id)).toContain("quiet");
    expect(await getUnreadState(uid)).toBe(true);
    const query = urls.find((url) => url.pathname.endsWith("/threads"))!;
    expect(query.searchParams.get("latest.limit")).toBe("1");
    expect(query.searchParams.get("incoming.limit")).toBe("1");
    expect(query.searchParams.get("incoming.sender_id")).toBe(`neq.${uid}`);
    expect(query.searchParams.get("latest.order")).toBe("created_at.desc,id.desc");
    expect(query.searchParams.get("select")).toContain("latest:messages(");
    expect(urls.some((url) => url.pathname.endsWith("/messages"))).toBe(false);
  });
  it("keeps an incoming unread reply visible after a newer self-send", async () => {
    threads = [thread("quiet", [message("quiet", uid, 20)], [message("quiet", other, 10)])];
    expect(await getUnreadState(uid)).toBe(true);
    states[0].last_read_at = at(11);
    expect(await getUnreadState(uid)).toBe(false);
  });
  it("preserves muted and archived thread behavior", async () => {
    states[0].muted_at = at(5); expect(await getUnreadState(uid)).toBe(false);
    states[0].muted_at = null; states[0].left_at = at(11); expect(await getUnreadState(uid)).toBe(false);
    threads[0].incoming = [message("quiet", other, 12)]; expect(await getUnreadState(uid)).toBe(true);
  });
  it("paginates both thread and state rows beyond the first page", async () => {
    const ids = Array.from({ length: 201 }, (_, n) => `thread-${String(n).padStart(4, "0")}`);
    threads = ids.map((id) => thread(id)); states = ids.map(state);
    expect((await getInboxSubstrate(uid)).threads).toHaveLength(201);
    expect(urls.some((url) => url.searchParams.get("id") === "gt.thread-0199")).toBe(true);
    expect(urls.some((url) => url.searchParams.get("thread_id") === "gt.thread-0199")).toBe(true);
  });
  it("renders an accessible unknown state instead of a false unread status", () => {
    const html = renderToStaticMarkup(createElement(MessagesSlot, { label: "Messages", unreadLabel: "Unread", unavailableLabel: "Temporarily unavailable", hasUnread: null }));
    expect(html).toContain('aria-label="Messages. Temporarily unavailable"');
    expect(html).toContain('title="Temporarily unavailable"');
    expect(html).toContain("?</span>");
  });
});
