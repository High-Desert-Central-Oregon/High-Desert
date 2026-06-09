import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ReviewRow } from "./review-row";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import type { VerificationMethod } from "@/lib/verification";

export const metadata = {
  title: "Verification reviews · High Desert",
};

type PendingRow = {
  id: string;
  user_id: string;
  method: VerificationMethod;
  evidence_path: string | null;
  created_at: string;
};

type UnplacedMember = {
  id: string;
  display_name: string;
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

  // Resolve applicant display names in one query (the only member-identifying
  // thing shown — the evidence itself stays behind on-demand signed URLs).
  const names = new Map<string, string>();
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) names.set(p.id, p.display_name);
  }

  // Verified members who haven't been placed in a neighborhood — either they
  // explicitly said "none fits" or they skipped the step. Oldest first so the
  // longest-waiting gets attention first (chronological, never ranked).
  const { data: unplaced } = await supabase
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("verified", true)
    .is("neighborhood_id", null)
    .order("created_at", { ascending: true })
    .returns<UnplacedMember[]>();

  const unplacedRows = unplaced ?? [];

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
                  applicantName={names.get(row.user_id) ?? "—"}
                  methodLabel={dict.verify.methods[row.method]}
                  hasEvidence={Boolean(row.evidence_path)}
                  submittedAt={new Date(row.created_at).toLocaleDateString(locale)}
                  dict={dict}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Members without a neighborhood ──────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            {dict.review.noNeighborhoodTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dict.review.noNeighborhoodIntro}
          </p>
        </header>

        {unplacedRows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            {dict.review.noNeighborhoodEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unplacedRows.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border bg-card px-4 py-3 text-sm"
              >
                <p className="font-medium">{m.display_name}</p>
                <p className="text-muted-foreground">
                  {dict.home.statusVerified} ·{" "}
                  {new Date(m.created_at).toLocaleDateString(locale)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewContent />
    </Suspense>
  );
}
