import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { createClient } from "@/lib/supabase/server";
import { isSupportOperator } from "@/lib/bug-reports/server";
import { bugCopy, type BugStatus } from "@/lib/bug-reports/copy";
import { getLocale } from "@/lib/i18n/server";
import { formatRedmondDateTime } from "@/lib/time";
export const metadata = { title: "Bug reports · Steppe" };
async function Queue({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await isSupportOperator())) redirect("/protected/account");
  const locale = await getLocale();
  const t = bugCopy[locale];
  const rawPage = Number((await searchParams).page ?? 0);
  const page = Number.isInteger(rawPage)
    ? Math.max(0, Math.min(200, rawPage))
    : 0;
  const db = await createClient();
  const { data, error } = await db
    .from("bug_reports")
    .select(
      "id,description,page,status,created_at,notification_state,notification_attempts",
    )
    .order("created_at", { ascending: false })
    .order("id")
    .range(page * 25, page * 25 + 24);
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-3xl">{t.queue}</h1>
        <p className="mt-2 text-sm">{t.queueIntro}</p>
      </header>
      {error ? (
        <p role="alert">{t.unavailable}</p>
      ) : !data?.length ? (
        <p>{t.noReports}</p>
      ) : (
        <ul className="divide-y border-y">
          {data.map((row) => (
            <li key={row.id} className="py-4">
              <Link
                href={`/protected/support/${row.id}`}
                className="block font-semibold underline underline-offset-4"
              >
                {row.description.slice(0, 120)}
              </Link>
              <p className="mt-1 text-sm">
                {row.id.slice(0, 8)} · {t.statuses[row.status as BugStatus]} ·{" "}
                {formatRedmondDateTime(row.created_at, locale)}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.page} ·{" "}
                {row.notification_state === "sent" ? t.sent : t.pending} (
                {t.attempts}: {row.notification_attempts})
              </p>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex gap-5">
        {page > 0 && (
          <Link href={`/protected/support?page=${page - 1}`}>{t.back}</Link>
        )}
        {data?.length === 25 && (
          <Link href={`/protected/support?page=${page + 1}`}>{t.next}</Link>
        )}
      </nav>
    </div>
  );
}
export default function SupportPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Queue {...props} />
    </Suspense>
  );
}
