import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { isSupportOperator } from "@/lib/bug-reports/server";
import {
  canManageOnboarding,
  pipelinesEnabled,
} from "@/lib/member-pipelines/server";
import { pc } from "@/lib/member-pipelines/copy";
import { formatRedmondDateTime } from "@/lib/time";
import { NoticeRetry } from "./notice-retry";
async function Work() {
  if (!pipelinesEnabled()) redirect("/protected/account");
  const [owner, reviewer, support, locale] = await Promise.all([
    canManageOnboarding(),
    isModerator(),
    isSupportOperator(),
    getLocale(),
  ]);
  if (!owner && !reviewer && !support) redirect("/protected/account");
  const db = await createClient();
  const { data, error } = await db
    .from("member_notices")
    .select("id,kind,invitation_id,verification_id,state,attempts,created_at")
    .eq("state", "pending")
    .order("created_at")
    .limit(50);
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-3xl">{pc(locale, "work")}</h1>
        <p>{pc(locale, "workIntro")}</p>
      </header>
      <nav className="flex flex-col divide-y border-y">
        {owner && (
          <Link className="py-4 underline" href="/protected/people">
            {pc(locale, "people")} · {pc(locale, "interest")}
          </Link>
        )}
        {reviewer && (
          <Link className="py-4 underline" href="/protected/review">
            {pc(locale, "reviews")}
          </Link>
        )}
        {reviewer && (
          <Link className="py-4 underline" href="/protected/moderation">
            {locale === "es"
              ? "Moderación y apelaciones"
              : "Moderation and appeals"}
          </Link>
        )}
        {support && (
          <Link className="py-4 underline" href="/protected/support">
            {pc(locale, "bugs")}
          </Link>
        )}
      </nav>
      <section>
        <h2 className="text-lg font-semibold">{pc(locale, "notices")}</h2>
        <p className="text-sm">{pc(locale, "noticeIntro")}</p>
        {error ? (
          <p role="alert">{pc(locale, "loadFailed")}</p>
        ) : !data?.length ? (
          <p className="mt-3">{pc(locale, "empty")}</p>
        ) : (
          <ul className="divide-y">
            {data.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 py-3">
                <Link
                  className="underline"
                  href={
                    row.invitation_id
                      ? "/protected/people?source=invited"
                      : `/protected/review/${row.verification_id}`
                  }
                >
                  {row.invitation_id
                    ? pc(locale, "invited")
                    : pc(locale, "reviews")}{" "}
                  · {row.id.slice(0, 8)}
                </Link>
                <p className="text-sm">
                  {pc(
                    locale,
                    row.attempts >= 8 ? "deliveryStopped" : "pending",
                  )}{" "}
                  · {formatRedmondDateTime(row.created_at, locale)}
                </p>
                {!row.invitation_id && (
                  <NoticeRetry id={row.id} locale={locale} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
export default function WorkPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Work />
    </Suspense>
  );
}
