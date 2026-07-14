import { Suspense } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { Monogram, initialsFor } from "@/components/broadsheet/post-row";
import { VerifiedGate } from "@/components/verified-gate";
import { ThreadMenu } from "./thread-menu";
import { sendReply } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";

export const metadata = { title: "Conversation · Steppe" };

type Thread = {
  id: string;
  member_a: string;
  member_b: string;
  about_post_id: string | null;
};
type Msg = { id: string; sender_id: string; body: string; created_at: string };
type SearchParams = { reported?: string; msgErr?: string };

/**
 * Thread view (messages-m1-spec §1.3): bone header (back · counterpart ·
 * "Re: <post>" · ⋯ menu), the msgInside watermark, juniper-deep bubbles for
 * me / bone for them, and the composer. Opening the thread clears my unread
 * dot (marks read). All RLS-scoped — only the two participants reach any of
 * this; a non-participant 404s.
 */
async function ThreadContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const { locale, dict } = await getServerDictionary();

  if (!profile.verified)
    return (
      <VerifiedGate
        title={dict.messages.title}
        body={dict.messages.voice}
        ctaLabel={dict.exchange.gateCta}
        locale={locale}
      />
    );

  const supabase = await createClient();
  const me = profile.id;

  // RLS (th_read) returns the row only to participants — a missing row 404s.
  const { data: thread } = await supabase
    .from("threads")
    .select("id, member_a, member_b, about_post_id")
    .eq("id", id)
    .maybeSingle<Thread>();
  if (!thread) notFound();

  const otherId = thread.member_a === me ? thread.member_b : thread.member_a;
  const [{ data: msgs }, { data: other }, post] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: true })
      .returns<Msg[]>(),
    supabase
      .from("public_profiles")
      .select("display_name")
      .eq("id", otherId)
      .maybeSingle<{ display_name: string }>(),
    thread.about_post_id
      ? supabase
          .from("posts")
          .select("id, title")
          .eq("id", thread.about_post_id)
          .maybeSingle<{ id: string; title: string }>()
      : Promise.resolve({ data: null }),
  ]);

  const name = other?.display_name ?? dict.messages.formerMember;
  const messages = msgs ?? [];

  // Mark read: stamp my cursor to the newest message (own-row update; the
  // dot recomputes on the next navigation). A read-triggered write on a
  // dynamic page — idempotent, never cached.
  if (messages.length > 0) {
    await supabase
      .from("thread_state")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", id)
      .eq("member_id", me);
  }
  const { data: myState } = await supabase
    .from("thread_state")
    .select("muted_at")
    .eq("thread_id", id)
    .eq("member_id", me)
    .maybeSingle<{ muted_at: string | null }>();

  const ctx = thread.about_post_id
    ? post?.data
      ? t(dict.messages.reAbout, { title: post.data.title })
      : dict.messages.reGone
    : null;

  // The reporter's own rendered view of the conversation (for a report's
  // consent-based excerpt — never a server read of the thread by a moderator).
  const excerpt = messages
    .map((m) => `${m.sender_id === me ? "•" : name}: ${m.body}`)
    .join("\n")
    .slice(0, 4000);

  const lastMine = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].sender_id === me) return messages[i].id;
    return null;
  })();

  return (
    <div lang={locale} className="-mx-[var(--pad-screen)] -my-[var(--row-rhythm)] flex min-h-[70svh] flex-col">
      {/* Header (bone). The context line links to the post it's about. */}
      <div className="relative flex items-center gap-[10px] border-b bg-muted px-[14px] py-[9px]">
        <Link
          href="/protected/messages"
          aria-label={dict.messages.backToMessages}
          className="shrink-0 text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#36563D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <Monogram initials={initialsFor(name)} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">{name}</p>
          {ctx &&
            (thread.about_post_id && post?.data ? (
              <Link
                href={`/protected/exchange/${thread.about_post_id}`}
                className="block truncate font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-accent hover:underline"
              >
                {ctx}
              </Link>
            ) : (
              <span className="block truncate font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {ctx}
              </span>
            ))}
        </div>
        <ThreadMenu
          threadId={thread.id}
          counterpartId={otherId}
          muted={!!myState?.muted_at}
          excerpt={excerpt}
          dict={dict}
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-0 overflow-y-auto px-[18px] py-4">
        <p className="mb-3 text-center font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {dict.messages.msgInside}
        </p>
        {sp.reported === "1" && (
          <p role="status" className="mb-2 text-center text-[13px] font-medium text-foreground">
            {dict.messages.reportThreadSent}
          </p>
        )}
        {sp.msgErr === "1" && (
          <p role="status" className="mb-2 text-center text-[13px] font-medium text-accent">
            {dict.messages.reachError}
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`my-[7px] flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] px-[13px] py-[10px] text-[14.5px] leading-[1.45] ${
                  mine
                    ? "rounded-[14px_14px_4px_14px] bg-primary text-primary-foreground"
                    : "rounded-[14px_14px_14px_4px] bg-muted text-foreground"
                }`}
              >
                {m.body}
                {mine && m.id === lastMine && (
                  <span className="mt-1 block text-right font-mono text-[8px] font-medium uppercase tracking-[0.1em] text-primary-foreground/70">
                    {dict.messages.sentTag}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer — a plain form (JS-optional); can_send is the gate. */}
      <form action={sendReply} className="flex items-center gap-[9px] border-t bg-muted px-[14px] py-[11px]">
        <input type="hidden" name="thread_id" value={thread.id} />
        <label htmlFor="reply" className="sr-only">
          {dict.messages.replyPlaceholder}
        </label>
        <input
          id="reply"
          name="body"
          required
          maxLength={4000}
          autoComplete="off"
          placeholder={dict.messages.replyPlaceholder}
          className="flex-1 border bg-card px-3 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
        />
        <button
          type="submit"
          aria-label={dict.messages.send}
          className="flex size-[42px] shrink-0 items-center justify-center bg-primary text-primary-foreground shadow-letterpress transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ThreadContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
