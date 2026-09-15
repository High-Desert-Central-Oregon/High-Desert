import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { createClient } from "@/lib/supabase/server";
import { isSupportOperator } from "@/lib/bug-reports/server";
import { sanitizeDiagnostics, UUID } from "@/lib/bug-reports/shared";
import { bugCopy, type BugStatus } from "@/lib/bug-reports/copy";
import { getLocale } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
import { CaseControls } from "./case-controls";
async function Case({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isSupportOperator())) redirect("/protected/account");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const locale = await getLocale();
  const t = bugCopy[locale];
  const db = await createClient();
  const [report, history] = await Promise.all([
    db
      .from("bug_reports")
      .select(
        "id,description,expected,contact_email,page,locale,release,diagnostics,status,created_at,expires_at,notification_state,notification_attempts",
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("bug_report_history")
      .select("id,status,note,created_at")
      .eq("report_id", id)
      .order("created_at"),
  ]);
  if (report.error || history.error)
    return (
      <p lang={locale} role="alert">
        {t.unavailable}
      </p>
    );
  if (!report.data) notFound();
  const row = report.data;
  const diagnostics = sanitizeDiagnostics(row.diagnostics);
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <Link href="/protected/support" className="underline">
        {t.back}
      </Link>
      <header>
        <h1 className="font-serif text-3xl">
          {t.reference}: {row.id.slice(0, 8)}
        </h1>
        <p className="mt-2 text-sm">
          {formatRedmondDateTime(row.created_at, locale)} ·{" "}
          {t.statuses[row.status as BugStatus]}
        </p>
      </header>
      <section>
        <h2 className="font-semibold">{t.description}</h2>
        <p className="whitespace-pre-wrap break-words">{row.description}</p>
      </section>
      {row.expected && (
        <section>
          <h2 className="font-semibold">{t.expected}</h2>
          <p className="whitespace-pre-wrap break-words">{row.expected}</p>
        </section>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt>{t.page}</dt>
        <dd>{row.page}</dd>
        <dt>{t.release}</dt>
        <dd className="break-all">{row.release}</dd>
        <dt>{t.contactEmail}</dt>
        <dd className="break-all">{row.contact_email || t.noEmail}</dd>
        <dt>{t.expires}</dt>
        <dd>{formatRedmondDateTime(row.expires_at, locale)}</dd>
      </dl>
      <p>
        {row.notification_state === "sent" ? t.sent : t.pending} · {t.attempts}:{" "}
        {row.notification_attempts}
      </p>
      <a
        className="underline"
        href={`/protected/support/${id}/export`}
        download
      >
        {t.download}
      </a>
      <section>
        <h2 className="text-xl font-semibold">{t.timeline}</h2>
        <p className="my-2 text-xs">{t.technicalHint}</p>
        {diagnostics ? (
          <>
            <ol className="divide-y border-y">
              {diagnostics.events.map((event, i) => (
                <li key={i} className="py-2 text-sm">
                  <code>+{(event.atMs / 1000).toFixed(1)}s</code> · {event.name}{" "}
                  · {event.page}
                </li>
              ))}
            </ol>
            <h3 className="mt-4 font-semibold">{t.details}</h3>
            <pre className="overflow-auto whitespace-pre-wrap border p-3 text-xs">
              {JSON.stringify(diagnostics.environment, null, 2)}
            </pre>
          </>
        ) : (
          <p>{t.noDiagnostics}</p>
        )}
      </section>
      <CaseControls
        id={id}
        status={row.status as BugStatus}
        locale={locale}
        pendingEmail={row.notification_state !== "sent"}
      />
      <section>
        <h2 className="text-xl font-semibold">{t.history}</h2>
        <ol className="divide-y">
          {history.data?.map((item) => (
            <li className="py-3 text-sm" key={item.id}>
              <p>
                {formatRedmondDateTime(item.created_at, locale)} ·{" "}
                {t.statuses[item.status as BugStatus]}
              </p>
              {item.note && (
                <p className="whitespace-pre-wrap break-words">{item.note}</p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
export default function BugReportPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Case {...props} />
    </Suspense>
  );
}
