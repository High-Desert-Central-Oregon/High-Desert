import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isModerator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { VerificationMethod } from "@/lib/verification";
import { getServerDictionary } from "@/lib/i18n/server";
import { pipelinesEnabled } from "@/lib/member-pipelines/server";
import { pc } from "@/lib/member-pipelines/copy";
import { UUID } from "@/lib/bug-reports/shared";
import { PageSkeleton } from "@/components/page-skeleton";
import { formatRedmondDateTime } from "@/lib/time";
import { ReviewControls } from "./review-controls";
async function Case({ params }: { params: Promise<{ id: string }> }) {
  if (!pipelinesEnabled() || !(await isModerator()))
    redirect("/protected/account");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { locale, dict } = await getServerDictionary();
  const db = await createClient();
  const { data: row, error } = await db
    .from("verifications")
    .select(
      "id,user_id,method,status,evidence_path,review_state,review_question,member_reply,review_updated_at,decision_approve,decision_message",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return <p role="alert">{pc(locale, "loadFailed")}</p>;
  if (!row) notFound();
  const person = await db
    .from("public_profiles")
    .select("display_name")
    .eq("id", row.user_id)
    .maybeSingle();
  return (
    <div lang={locale} className="flex flex-col gap-5">
      <Link className="underline" href="/protected/review">
        {pc(locale, "reviews")}
      </Link>
      <h1 className="font-serif text-3xl">
        {pc(locale, "case")} · {id.slice(0, 8)}
      </h1>
      <p>
        {person.data?.display_name ?? "·"} ·{" "}
        {dict.verify.methods[row.method as VerificationMethod]}
      </p>
      <p className="text-sm">
        {pc(locale, "updated")}:{" "}
        {formatRedmondDateTime(row.review_updated_at, locale)}
      </p>
      {row.review_question && (
        <section>
          <h2 className="font-semibold">{pc(locale, "question")}</h2>
          <p className="whitespace-pre-wrap">{row.review_question}</p>
        </section>
      )}
      {row.member_reply && (
        <section>
          <h2 className="font-semibold">{pc(locale, "applicantReply")}</h2>
          <p className="whitespace-pre-wrap">{row.member_reply}</p>
        </section>
      )}
      {row.status === "pending" ? (
        <ReviewControls
          id={id}
          locale={locale}
          hasEvidence={!!row.evidence_path}
          finalizing={row.review_state === "finalizing"}
          recordedApprove={row.decision_approve}
          recordedMessage={row.decision_message}
        />
      ) : (
        <p>
          {pc(locale, row.status === "approved" ? "verified" : "reject")}
          {row.decision_message ? `: ${row.decision_message}` : ""}
        </p>
      )}
    </div>
  );
}
export default function ReviewCase(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Case {...props} />
    </Suspense>
  );
}
