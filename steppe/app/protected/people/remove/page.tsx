import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { canRemoveAccounts } from "@/lib/member-pipelines/removal";
import { rc } from "@/lib/member-pipelines/removal-copy";
import { RemovalControls, RetryRemoval } from "./controls";

async function Removal() {
  if (!(await canRemoveAccounts())) redirect("/protected/people");
  const locale = await getLocale();
  const db = await createClient();
  const { data, error } = await db
    .from("account_removals")
    .select("id,pending_email")
    .is("completed_at", null)
    .order("created_at")
    .limit(50);
  return (
    <div lang={locale} className="flex max-w-2xl flex-col gap-6">
      <Link href="/protected/people" className="underline">
        {rc(locale, "back")}
      </Link>
      <header>
        <h1 className="font-serif text-3xl">{rc(locale, "title")}</h1>
        <p className="mt-2">{rc(locale, "intro")}</p>
      </header>
      <RemovalControls locale={locale} />
      {error && <p role="alert">{rc(locale, "failed")}</p>}
      {!!data?.length && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            {rc(locale, "pendingTitle")}
          </h2>
          <ul className="divide-y">
            {data.map((job) => (
              <li key={job.id} className="flex flex-col gap-3 py-4">
                <p className="break-all">{job.pending_email}</p>
                <RetryRemoval id={job.id} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
export default function RemovalPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Removal />
    </Suspense>
  );
}
