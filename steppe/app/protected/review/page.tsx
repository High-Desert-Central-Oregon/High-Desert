import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { ReviewRow } from "./review-row";
import { NeighborhoodRequestRow } from "./neighborhood-request-row";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { t } from "@/lib/i18n";
import { formatRedmondDate } from "@/lib/time";
import type { VerificationMethod } from "@/lib/verification";

export const metadata = {
  title: "Verification reviews · Steppe",
};

type PendingRow = {
  id: string;
  user_id: string;
  method: VerificationMethod;
  evidence_path: string | null;
  created_at: string;
};

type OpenRequest = {
  id: string;
  user_id: string;
  note: string | null;
  created_at: string;
};

async function ReviewContent() {
  // Moderator-only. The page is a flow gate; the RPC and storage policies are
  // the hard gates, but we shouldn't render the queue to non-moderators at all.
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  if (profile.role !== "moderator" && profile.role !== "admin") {
    redirect("/protected");
  }

  const { locale, dict } = await getServerDictionary();
  const supabase = await createClient();

  // Pending verification checks, oldest first — chronological, never ranked (invariant 7).
  const { data: pending } = await supabase
    .from("verifications")
    .select("id, user_id, method, evidence_path, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<PendingRow[]>();

  const rows = pending ?? [];

  // Open neighborhood-help requests ("none of these fit"), oldest first —
  // chronological, never ranked (invariant 7). Members who simply haven't
  // chosen a neighborhood yet do NOT appear here; only an explicit flag does.
  const { data: requests } = await supabase
    .from("neighborhood_requests")
    .select("id, user_id, note, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .returns<OpenRequest[]>();

  const requestRows = requests ?? [];

  // Resolve display names for everyone shown, in one query, THROUGH the
  // public_profiles view — after migration 0023 the base profiles table is
  // owner-only (pf_read), so cross-member reads (moderators included) go via
  // the owner-rights view. Names are the only member-identifying thing here;
  // verification evidence stays behind on-demand signed URLs. Join dates aren't
  // exposed to moderators anymore (not a hideable field, just not in the view);
  // the neighborhood-request row instead shows when the request was opened.
  const namesById = new Map<string, string>();
  const userIds = [
    ...new Set([
      ...rows.map((r) => r.user_id),
      ...requestRows.map((r) => r.user_id),
    ]),
  ];
  if (userIds.length > 0) {
    const { data: people } = await supabase
      .from("public_profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of people ?? []) namesById.set(p.id, p.display_name);
  }

  return (
    <div lang={locale} className="flex flex-col gap-10">
      {/* ── Verification queue ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.review.title}
          </h1>
          <p className="text-sm text-muted-foreground">{dict.review.intro}</p>
        </header>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {dict.review.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id}>
                <ReviewRow
                  id={row.id}
                  applicantName={namesById.get(row.user_id) ?? "—"}
                  methodLabel={dict.verify.methods[row.method]}
                  hasEvidence={Boolean(row.evidence_path)}
                  submittedAt={formatRedmondDate(row.created_at, locale)}
                  dict={dict}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Open neighborhood-help requests ─────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            {dict.review.requestsTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dict.review.requestsIntro}
          </p>
        </header>

        {requestRows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            {dict.review.requestsEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requestRows.map((r) => {
              return (
                <li key={r.id}>
                  <NeighborhoodRequestRow
                    id={r.id}
                    memberName={namesById.get(r.user_id) ?? "—"}
                    note={r.note}
                    // Moderators no longer read another member's join date (0023);
                    // show when the help request was opened instead — the relevant,
                    // available date for triage.
                    memberSince={t(dict.review.requestedOn, {
                      date: formatRedmondDate(r.created_at, locale),
                    })}
                    dict={dict}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReviewContent />
    </Suspense>
  );
}
