import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { t, type Dictionary } from "@/lib/i18n";
import { Masthead } from "@/components/broadsheet/masthead";
import { GovSegments } from "../gov-segments";

// The public Record — moderation + appeal outcomes — filed INSIDE Govern per
// preview-nav-spec §4 (moved here from /protected/transparency, which now 307s).
export const metadata = {
  title: "Transparency · Steppe",
};

type AuditRow = {
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: { reason?: string } | null;
  actor_id: string | null;
  created_at: string;
};

/** Plain-language label for an audit entry — what happened, in member terms. */
function label(row: AuditRow, dict: Dictionary): string {
  switch (row.action) {
    case "moderation.remove":
      return row.entity === "event"
        ? dict.transparency.actionRemoveEvent
        : row.entity === "proposal"
          ? dict.transparency.actionRemoveProposal
          : dict.transparency.actionRemoveGeneric;
    case "moderation.restore":
      return row.entity === "event"
        ? dict.transparency.actionRestoreEvent
        : row.entity === "proposal"
          ? dict.transparency.actionRestoreProposal
          : dict.transparency.actionRestoreGeneric;
    case "appeal.upheld":
      return dict.transparency.appealUpheld;
    case "appeal.overturned":
      return dict.transparency.appealOverturned;
    default:
      return row.action;
  }
}

/** Link to the affected content for moderation entries (the detail page shows
 *  its own removed/visible state). Appeal entries reference an appeal id, not
 *  content, so they carry no link. */
function contentHref(row: AuditRow): string | null {
  if (!row.entity_id) return null;
  if (row.entity === "event") return `/protected/events/${row.entity_id}`;
  if (row.entity === "proposal")
    return `/protected/governance/${row.entity_id}`;
  if (row.entity === "post") return `/protected/exchange/${row.entity_id}`;
  return null;
}

async function RecordContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();
  const supabase = await createClient();

  // Moderation + appeal entries from the append-only audit log, newest first.
  // audit_log is readable by every member (al_read); it holds no private data.
  const { data: entries } = await supabase
    .from("audit_log")
    .select("action, entity, entity_id, metadata, actor_id, created_at")
    .or("action.like.moderation.*,action.like.appeal.*")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<AuditRow[]>();

  const rows = entries ?? [];

  // Acting moderators are named (accountability runs toward power); the affected
  // member is never named here (see DECISIONS.md 2026-06-09).
  const names = new Map<string, string>();
  const actorIds = [
    ...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x)),
  ];
  if (actorIds.length > 0) {
    const { data: people } = await supabase
      .from("public_profiles") // public columns only; tenure_start stays private
      .select("id, display_name")
      .in("id", actorIds);
    for (const p of people ?? []) names.set(p.id, p.display_name);
  }

  return (
    <div lang={locale} className="flex flex-col gap-6">
      {/* FOUNDER OVERRIDE (2026-07-12): masthead band above the segments —
          same order as the proposals page and every other tab root. */}
      <Masthead
        title={dict.transparency.title}
        voice={dict.transparency.intro}
        flush
      />
      <GovSegments active="record" dict={dict} />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {dict.transparency.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row, i) => {
            const href = contentHref(row);
            const reason = row.metadata?.reason;
            return (
              <li
                key={`${row.created_at}-${i}`}
                className="flex flex-col gap-1 rounded-lg border bg-card p-4 text-sm"
              >
                <div className="flex items-start gap-2.5">
                  <ScrollText
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="font-medium">{label(row, dict)}</p>
                    {reason && (
                      <p>
                        <span className="text-muted-foreground">
                          {dict.transparency.reason}:{" "}
                        </span>
                        {reason}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      {row.actor_id && names.has(row.actor_id)
                        ? t(dict.transparency.byModerator, {
                            name: names.get(row.actor_id)!,
                          })
                        : dict.transparency.byModeratorUnknown}{" "}
                      · {formatRedmondDateTime(row.created_at, locale)}
                    </p>
                    {href && (
                      <Link
                        href={href}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {dict.transparency.viewContent}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function GovernRecordPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RecordContent />
    </Suspense>
  );
}
