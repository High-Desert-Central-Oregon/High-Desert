import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { Masthead } from "@/components/broadsheet/masthead";
import { Monogram, initialsFor } from "@/components/broadsheet/post-row";
import { QuietEmpty } from "@/components/broadsheet/quiet-empty";
import { VerifiedGate } from "@/components/verified-gate";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { t } from "@/lib/i18n";

export const metadata = { title: "Messages · Steppe" };

type Thread = {
  id: string;
  member_a: string;
  member_b: string;
  about_post_id: string | null;
};
type State = {
  thread_id: string;
  last_read_at: string | null;
  muted_at: string | null;
  left_at: string | null;
};
type Msg = { thread_id: string; sender_id: string; body: string; created_at: string };

/**
 * The inbox (messages-m1-spec §1.2): a privacy strip (the msgInside line, on
 * screen before any content), then one row per conversation — monogram,
 * counterpart name (bold when unread), when, the rust "Re: <post>" context,
 * the last message preview, and a 9px rust unread dot (never a count). All
 * RLS-scoped: a non-participant sees nothing. Chronological, newest thread
 * first (invariant 7).
 */
async function InboxContent() {
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
  const [{ data: threads }, { data: states }, { data: msgs }] = await Promise.all([
    supabase.from("threads").select("id, member_a, member_b, about_post_id").returns<Thread[]>(),
    supabase
      .from("thread_state")
      .select("thread_id, last_read_at, muted_at, left_at")
      .returns<State[]>(),
    supabase
      .from("messages")
      .select("thread_id, sender_id, body, created_at")
      .order("created_at", { ascending: false })
      .limit(400)
      .returns<Msg[]>(),
  ]);

  // Newest message per thread (desc order → first seen).
  const last = new Map<string, Msg>();
  for (const m of msgs ?? []) if (!last.has(m.thread_id)) last.set(m.thread_id, m);
  const state = new Map((states ?? []).map((s) => [s.thread_id, s]));

  // Resolve counterpart names + anchor titles.
  const others = (threads ?? []).map((th) => (th.member_a === me ? th.member_b : th.member_a));
  const postIds = (threads ?? []).flatMap((th) => (th.about_post_id ? [th.about_post_id] : []));
  const [{ data: people }, { data: posts }] = await Promise.all([
    others.length
      ? supabase.from("public_profiles").select("id, display_name").in("id", others)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    postIds.length
      ? supabase.from("posts").select("id, title").in("id", postIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.display_name]));
  const titles = new Map((posts ?? []).map((p) => [p.id, p.title]));

  // Build rows: hide archived threads with no activity since I left; newest
  // conversation first.
  const rows = (threads ?? [])
    .map((th) => {
      const lm = last.get(th.id);
      const st = state.get(th.id);
      return { th, lm, st };
    })
    .filter(({ lm, st }) => {
      if (!lm) return false;
      if (st?.left_at && Date.parse(lm.created_at) <= Date.parse(st.left_at)) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.lm!.created_at) - Date.parse(a.lm!.created_at));

  const unread = (lm: Msg, st?: State) =>
    !!lm &&
    lm.sender_id !== me &&
    !st?.muted_at &&
    (!st?.last_read_at || Date.parse(lm.created_at) > Date.parse(st.last_read_at));

  return (
    <div lang={locale} className="flex flex-col gap-0">
      <Masthead
        title={dict.messages.title}
        kicker={dict.messages.dateline}
        voice={dict.messages.voice}
        flush
      />
      {/* Privacy strip — the msgInside line on screen before any content. */}
      <p className="mt-4 flex items-center gap-[7px] border-b pb-3 font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <span
          aria-hidden="true"
          className="inline-block size-[6px] rounded-full bg-[color:var(--marker-sage)]"
        />
        {dict.messages.msgInside}
      </p>

      {rows.length === 0 ? (
        <QuietEmpty title={dict.messages.emptyTitle} sub={dict.messages.emptySub} />
      ) : (
        <ul className="flex flex-col">
          {rows.map(({ th, lm, st }) => {
            const name = names.get(th.member_a === me ? th.member_b : th.member_a) ?? dict.messages.formerMember;
            const isUnread = unread(lm!, st);
            const ctx = th.about_post_id
              ? titles.has(th.about_post_id)
                ? t(dict.messages.reAbout, { title: titles.get(th.about_post_id)! })
                : dict.messages.reGone
              : null;
            return (
              <li key={th.id}>
                <Link
                  href={`/protected/messages/${th.id}`}
                  className="flex items-center gap-[13px] border-b py-4 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <Monogram initials={initialsFor(name)} size={44} />
                  <span className="min-w-0 flex-1">
                    {/* Unread as TEXT for AT (not color/weight alone; WCAG
                        1.4.1) — the dot below stays decorative. */}
                    {isUnread && <span className="sr-only">{dict.messages.unread}. </span>}
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-[15px] text-foreground ${isUnread ? "font-bold" : "font-semibold"}`}
                      >
                        {name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
                        {formatRedmondDateTime(lm!.created_at, locale)}
                      </span>
                    </span>
                    {ctx && (
                      <span className="mt-1 block truncate font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-accent">
                        {ctx}
                      </span>
                    )}
                    <span className="mt-1 flex items-center gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] ${isUnread ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {lm!.body}
                      </span>
                      {isUnread && (
                        <span
                          aria-hidden="true"
                          className="size-[9px] shrink-0 rounded-full bg-accent"
                        />
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}
