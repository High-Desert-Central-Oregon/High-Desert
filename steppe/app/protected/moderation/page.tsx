import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { AppealResolver } from "./appeal-resolver";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";

export const metadata = {
  title: "Appeals · Steppe",
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

async function AppealsContent() {
  // Moderator-only flow gate; the RPCs are the hard gate.
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (profile.role !== "moderator" && profile.role !== "admin") {
    redirect("/protected");
  }

  const { locale, dict } = await getServerDictionary();
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
      supabase.from("profiles").select("id, display_name").in("id", userIds),
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

export default function AppealsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AppealsContent />
    </Suspense>
  );
}
