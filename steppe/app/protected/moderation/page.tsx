import { Suspense } from "react";
import Link from "next/link";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { AppealResolver } from "./appeal-resolver";
import { resolveReport } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { t } from "@/lib/i18n";

export const metadata = {
  title: "Appeals · Steppe",
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  body: string;
  quoted_excerpt: string | null;
  created_at: string;
};

type AppealRow = {
  id: string;
  moderation_action_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ActionRow = {
  id: string;
  target_type: string;
  target_id: string;
  actor_id: string;
  reason: string | null;
};

async function AppealsContent({
  searchParams,
}: {
  searchParams: Promise<{ reportErr?: string }>;
}) {
  // Moderator-only flow gate; the RPCs are the hard gate.
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (profile.role !== "moderator" && profile.role !== "admin") {
    redirect("/protected");
  }

  const { locale, dict } = await getServerDictionary();
  const { reportErr } = await searchParams;
  const supabase = await createClient();

  // Open appeals, oldest first — chronological, never ranked (invariant 7).
  const { data: appealsData } = await supabase
    .from("appeals")
    .select("id, moderation_action_id, user_id, body, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .returns<AppealRow[]>();

  const appeals = appealsData ?? [];

  // The actions being appealed (what/why was removed, and by whom — needed to
  // enforce separation of duties in the UI).
  const actions = new Map<string, ActionRow>();
  if (appeals.length > 0) {
    const { data } = await supabase
      .from("moderation_actions")
      .select("id, target_type, target_id, actor_id, reason")
      .in("id", appeals.map((a) => a.moderation_action_id))
      .returns<ActionRow[]>();
    for (const a of data ?? []) actions.set(a.id, a);
  }

  // Names of appellants; titles of the removed content (context for the judge).
  const names = new Map<string, string>();
  const eventTitles = new Map<string, string>();
  const proposalTitles = new Map<string, string>();
  const postTitles = new Map<string, string>();
  if (appeals.length > 0) {
    const userIds = [...new Set(appeals.map((a) => a.user_id))];
    const eventIds = [...actions.values()].filter((a) => a.target_type === "event").map((a) => a.target_id);
    const proposalIds = [...actions.values()].filter((a) => a.target_type === "proposal").map((a) => a.target_id);
    const postIds = [...actions.values()].filter((a) => a.target_type === "post").map((a) => a.target_id);
    const [{ data: people }, { data: evs }, { data: props }, { data: pos }] = await Promise.all([
      // Cross-member name lookup goes through the owner-rights view: after 0023
      // the base profiles table is owner-only (pf_read), moderators included.
      supabase.from("public_profiles").select("id, display_name").in("id", userIds),
      eventIds.length
        ? supabase.from("events").select("id, title").in("id", eventIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      proposalIds.length
        ? supabase.from("proposals").select("id, title").in("id", proposalIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      postIds.length
        ? supabase.from("posts").select("id, title").in("id", postIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    for (const p of people ?? []) names.set(p.id, p.display_name);
    for (const e of evs ?? []) eventTitles.set(e.id, e.title);
    for (const p of props ?? []) proposalTitles.set(p.id, p.title);
    for (const po of pos ?? []) postTitles.set(po.id, po.title);
  }

  // Open member reports (0021), oldest first — same chronology-only rule.
  // Moderators see all open rows via rp_read; members never reach this page.
  const { data: reportsData } = await supabase
    .from("reports")
    .select("id, reporter_id, target_type, target_id, body, quoted_excerpt, created_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: true })
    .returns<ReportRow[]>();
  const reports = reportsData ?? [];

  const reporterNames = new Map<string, string>();
  const reportTargetTitles = new Map<string, string>();
  if (reports.length > 0) {
    const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
    const rPostIds = reports.filter((r) => r.target_type === "post").map((r) => r.target_id);
    const rEventIds = reports.filter((r) => r.target_type === "event").map((r) => r.target_id);
    const [{ data: rPeople }, { data: rPosts }, { data: rEvents }] = await Promise.all([
      // Reporter names via the owner-rights view (0023: base profiles owner-only).
      supabase.from("public_profiles").select("id, display_name").in("id", reporterIds),
      rPostIds.length
        ? supabase.from("posts").select("id, title").in("id", rPostIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      rEventIds.length
        ? supabase.from("events").select("id, title").in("id", rEventIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    for (const p of rPeople ?? []) reporterNames.set(p.id, p.display_name);
    for (const p of rPosts ?? []) reportTargetTitles.set(p.id, p.title);
    for (const e of rEvents ?? []) reportTargetTitles.set(e.id, e.title);
  }

  // Message-thread reports have no readable target (the zero-read pin — a
  // moderator never opens the thread); the quoted excerpt IS the evidence.
  const reportTargetHref = (r: ReportRow) =>
    r.target_type === "post"
      ? `/protected/exchange/${r.target_id}`
      : r.target_type === "event"
        ? `/protected/events/${r.target_id}`
        : null;
  const reportTargetLabel = (r: ReportRow) =>
    r.target_type === "message_thread"
      ? dict.moderation.reportOnThread
      : (reportTargetTitles.get(r.target_id) ?? dict.moderation.reportTargetGone);

  return (
    <div lang={locale} className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.moderation.appealsTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dict.moderation.appealsIntro}
        </p>
      </header>

      {/* ---- Member reports (0021) — read, act on the content via its own
              page, then resolve. Resolution is audited; content decisions
              stay in the remove/restore flow (invariant 5). A report on
              private-group content a platform moderator doesn't belong to
              shows the reporter's words + reportTargetGone (po_read/ev_read
              gate it); the moderator can still act via the target_id. The
              broader "should moderators read private-group content" question
              is the G-1 moderation-visibility policy, not this migration. ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{dict.moderation.reportsTitle}</h2>
        <p className="text-sm text-muted-foreground">
          {dict.moderation.reportsIntro}
        </p>
        {reportErr === "1" && (
          <p role="status" className="text-sm font-medium text-accent">
            {dict.moderation.reportError}
          </p>
        )}
        {reports.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {dict.moderation.reportsEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <div className="text-sm">
                  <p className="font-medium">
                    {reportTargetHref(r) ? (
                      <Link
                        href={reportTargetHref(r)!}
                        className="underline-offset-2 hover:underline"
                      >
                        {reportTargetLabel(r)}
                      </Link>
                    ) : (
                      <span>{reportTargetLabel(r)}</span>
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {t(dict.moderation.reportBy, {
                      name: reporterNames.get(r.reporter_id) ?? "—",
                      date: formatRedmondDateTime(r.created_at, locale),
                    })}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{r.body}</p>
                </div>
                {/* The consent-based excerpt (§6.4): the reporter's own quoted
                    view of the conversation — the only door message content
                    has into moderation. The moderator reads THIS, never the
                    thread. */}
                {r.target_type === "message_thread" && r.quoted_excerpt && (
                  <div className="rounded-md border-l-2 border-accent bg-muted/30 p-3 text-sm">
                    <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {dict.moderation.reportExcerptLabel}
                    </p>
                    <p className="whitespace-pre-wrap">{r.quoted_excerpt}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <form action={resolveReport}>
                    <input type="hidden" name="report_id" value={r.id} />
                    <input type="hidden" name="outcome" value="actioned" />
                    <button
                      type="submit"
                      className="inline-flex items-center border bg-card px-[14px] py-[9px] font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {dict.moderation.reportActioned}
                    </button>
                  </form>
                  <form action={resolveReport}>
                    <input type="hidden" name="report_id" value={r.id} />
                    <input type="hidden" name="outcome" value="dismissed" />
                    <button
                      type="submit"
                      className="inline-flex items-center border bg-card px-[14px] py-[9px] font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {dict.moderation.reportDismissed}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="text-lg font-semibold">{dict.moderation.appealsQueueTitle}</h2>
      {appeals.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {dict.moderation.appealsEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {appeals.map((appeal) => {
            const action = actions.get(appeal.moderation_action_id);
            const isEvent = action?.target_type === "event";
            const isPost = action?.target_type === "post";
            const title = action
              ? (isEvent
                  ? eventTitles
                  : isPost
                    ? postTitles
                    : proposalTitles
                ).get(action.target_id)
              : undefined;
            const ownAction = action?.actor_id === profile.id;

            return (
              <li
                key={appeal.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {isEvent
                      ? dict.moderation.appealOnEvent
                      : isPost
                        ? dict.moderation.appealOnPost
                        : dict.moderation.appealOnProposal}
                    {title ? ` — ${title}` : ""}
                  </p>
                  {action?.reason && (
                    <p className="mt-1 text-muted-foreground">
                      {dict.moderation.appealRemovalReason}: {action.reason}
                    </p>
                  )}
                </div>

                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <p className="font-medium">
                    {t(dict.moderation.appealBy, {
                      name: names.get(appeal.user_id) ?? "—",
                    })}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{appeal.body}</p>
                </div>

                {ownAction ? (
                  <p className="text-sm text-muted-foreground" role="note">
                    {dict.moderation.ownActionNote}
                  </p>
                ) : (
                  <AppealResolver appealId={appeal.id} dict={dict} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AppealsPage({
  searchParams,
}: {
  searchParams: Promise<{ reportErr?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AppealsContent searchParams={searchParams} />
    </Suspense>
  );
}
