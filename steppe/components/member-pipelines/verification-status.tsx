import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pc } from "@/lib/member-pipelines/copy";
import { formatRedmondDateTime } from "@/lib/time";
import { VerificationReply } from "./verification-reply";
export async function VerificationStatus({
  locale,
  compact = false,
}: {
  locale: "en" | "es";
  compact?: boolean;
}) {
  const db = await createClient();
  const { data, error } = await db.rpc("my_verification_progress");
  if (error) return <p role="alert">{pc(locale, "loadFailed")}</p>;
  const row = data?.[0];
  if (compact)
    return (
      <section className="rounded border p-4">
        <h2 className="font-semibold">{pc(locale, "next")}</h2>
        <p className="my-2 text-sm">
          {pc(
            locale,
            row?.review_state === "needs_information"
              ? "question"
              : row?.status === "pending"
                ? "waiting"
                : "verifyNext",
          )}
        </p>
        <Link className="underline" href="/protected/verify">
          {pc(locale, row ? "viewStatus" : "verify")}
        </Link>
      </section>
    );
  if (!row) return null;
  return (
    <section lang={locale} className="flex flex-col gap-3 rounded border p-4">
      <h2 className="font-semibold">
        {pc(
          locale,
          row.status === "approved"
            ? "verified"
            : row.review_state === "needs_information"
              ? "question"
              : row.status === "rejected"
                ? "reject"
                : "waiting",
        )}
      </h2>
      <p className="text-xs">
        {pc(locale, "updated")}:{" "}
        {formatRedmondDateTime(row.review_updated_at, locale)}
      </p>
      {row.review_question && (
        <p className="whitespace-pre-wrap">{row.review_question}</p>
      )}
      {row.status === "pending" && row.review_state === "needs_information" && (
        <VerificationReply id={row.id} locale={locale} />
      )}{" "}
      {row.member_reply && (
        <p className="whitespace-pre-wrap text-sm">
          {pc(locale, "reply")}: {row.member_reply}
        </p>
      )}
      {row.status !== "pending" && row.decision_message && (
        <p>{row.decision_message}</p>
      )}
    </section>
  );
}
