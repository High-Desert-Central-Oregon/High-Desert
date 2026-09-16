import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { pc } from "@/lib/member-pipelines/copy";
import { bugCopy, type BugStatus } from "@/lib/bug-reports/copy";
import { formatRedmondDateTime } from "@/lib/time";
import { PageSkeleton } from "@/components/page-skeleton";
async function Activity({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const search = await searchParams;
  const page = Math.min(
    10000,
    Math.max(0, parseInt(search.page ?? "0", 10) || 0),
  );
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const locale = await getLocale();
  const db = await createClient();
  const [posts, rsvps, reports] = await Promise.all([
    db
      .from("posts")
      .select("id,title,created_at")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24),
    db
      .from("event_rsvps")
      .select("event_id,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24),
    db
      .from("bug_reports")
      .select("id,description,status,created_at")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24),
  ]);
  const eventIds = rsvps.data?.map((row) => row.event_id) ?? [];
  const events = eventIds.length
    ? await db.from("events").select("id,title,starts_at").in("id", eventIds)
    : { data: [], error: null };
  const titles = new Map(events.data?.map((row) => [row.id, row.title]));
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl">{pc(locale, "myActivity")}</h1>
      <Link className="underline" href="/protected/exchange">
        {pc(locale, "exchange")}
      </Link>
      <section>
        <h2 className="text-lg font-semibold">{pc(locale, "myPosts")}</h2>
        {posts.error ? (
          <p role="alert">{pc(locale, "loadFailed")}</p>
        ) : posts.data?.length ? (
          <ul className="divide-y">
            {posts.data.map((row) => (
              <li className="py-3" key={row.id}>
                <Link
                  className="underline"
                  href={`/protected/exchange/${row.id}`}
                >
                  {row.title}
                </Link>
                <p className="text-xs">
                  {formatRedmondDateTime(row.created_at, locale)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>{pc(locale, "activityEmpty")}</p>
        )}
      </section>
      <section>
        <h2 className="text-lg font-semibold">{pc(locale, "myEvents")}</h2>
        {rsvps.error || events.error ? (
          <p role="alert">{pc(locale, "loadFailed")}</p>
        ) : rsvps.data?.length ? (
          <ul className="divide-y">
            {rsvps.data.map((row) => (
              <li className="py-3" key={row.event_id}>
                <Link
                  className="underline"
                  href={`/protected/events/${row.event_id}`}
                >
                  {titles.get(row.event_id) ?? pc(locale, "myEvents")}
                </Link>
                <p className="text-xs">
                  {row.status === "going"
                    ? locale === "es"
                      ? "Asistiré"
                      : "Going"
                    : locale === "es"
                      ? "Quizás"
                      : "Maybe"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>{pc(locale, "activityEmpty")}</p>
        )}
      </section>
      <section>
        <h2 className="text-lg font-semibold">{pc(locale, "myReports")}</h2>
        {reports.error ? (
          <p role="alert">{pc(locale, "loadFailed")}</p>
        ) : reports.data?.length ? (
          <ul className="divide-y">
            {reports.data.map((row) => (
              <li className="py-3" key={row.id}>
                <p className="break-words">{row.description}</p>
                <p className="text-xs">
                  {row.id.slice(0, 8)} ·{" "}
                  {bugCopy[locale].statuses[row.status as BugStatus]} ·{" "}
                  {formatRedmondDateTime(row.created_at, locale)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>{bugCopy[locale].noReports}</p>
        )}
      </section>
      <nav className="flex gap-4">
        {page > 0 && (
          <Link
            className="underline"
            href={`/protected/activity?page=${page - 1}`}
          >
            {pc(locale, "previous")}
          </Link>
        )}
        {[posts, rsvps, reports].some(
          (result) => result.data?.length === 25,
        ) && (
          <Link
            className="underline"
            href={`/protected/activity?page=${page + 1}`}
          >
            {pc(locale, "following")}
          </Link>
        )}
      </nav>
    </div>
  );
}
export default function ActivityPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Activity {...props} />
    </Suspense>
  );
}
