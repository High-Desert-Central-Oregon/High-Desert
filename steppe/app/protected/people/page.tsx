import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { canManageOnboarding } from "@/lib/member-pipelines/server";
import { pc, type PipelineKey } from "@/lib/member-pipelines/copy";
import { formatRedmondDateTime } from "@/lib/time";
import { InvitationControls } from "./invitation-controls";
type Person = {
  id: string;
  email: string;
  first_name: string | null;
  neighborhood: string | null;
  consent: boolean;
  created_at: string;
  invitation_id: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  delivery: PipelineKey;
  progress: PipelineKey;
};
async function People({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; page?: string }>;
}) {
  if (!(await canManageOnboarding())) redirect("/protected/account");
  const locale = await getLocale();
  const search = await searchParams;
  const source = search.source === "invited" ? "invited" : "interest";
  const page = Math.min(
    10000,
    Math.max(0, Number.parseInt(search.page ?? "0", 10) || 0),
  );
  const db = await createClient();
  const { data, error } = await db.rpc("onboarding_people", {
    p_source: source,
    p_page: page,
  });
  const rows = (data ?? []) as Person[];
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <Link href="/protected/work" className="underline">
        {pc(locale, "work")}
      </Link>
      <header>
        <h1 className="font-serif text-3xl">{pc(locale, "people")}</h1>
        <p className="mt-2 text-sm">{pc(locale, "inviteIntro")}</p>
      </header>
      <InvitationControls locale={locale} />
      <nav className="flex flex-wrap gap-4">
        <Link
          aria-current={source === "interest" ? "page" : undefined}
          className="underline"
          href="/protected/people"
        >
          {pc(locale, "interest")}
        </Link>
        <Link
          aria-current={source === "invited" ? "page" : undefined}
          className="underline"
          href="/protected/people?source=invited"
        >
          {pc(locale, "invited")}
        </Link>
        <Link className="underline" href="/protected/invites">
          {pc(locale, "batches")}
        </Link>
      </nav>
      {error ? (
        <p role="alert">{pc(locale, "loadFailed")}</p>
      ) : rows.length === 0 ? (
        <p>{pc(locale, "empty")}</p>
      ) : (
        <ul className="divide-y border-y">
          {rows.map((row) => {
            const active =
              !!row.invitation_id &&
              !row.revoked_at &&
              !!row.expires_at &&
              Date.parse(row.expires_at) > Date.now();
            return (
              <li className="flex flex-col gap-2 py-4" key={row.id}>
                <h2 className="break-all font-semibold">
                  {row.first_name ? `${row.first_name} · ` : ""}
                  {row.email}
                </h2>
                {row.neighborhood && (
                  <p className="break-words text-sm">{row.neighborhood}</p>
                )}
                <p className="text-sm">
                  {pc(locale, row.progress)} ·{" "}
                  {row.revoked_at
                    ? pc(locale, "revoked")
                    : row.invitation_id && !active
                      ? pc(locale, "expired")
                      : pc(locale, row.delivery)}
                </p>
                {row.expires_at && (
                  <p className="text-xs">
                    {pc(locale, "expires")}:{" "}
                    {formatRedmondDateTime(row.expires_at, locale)}
                  </p>
                )}
                {!row.consent ? (
                  <p>{pc(locale, "noConsent")}</p>
                ) : (
                  row.progress === "not_joined" && (
                    <InvitationControls
                      locale={locale}
                      email={row.email}
                      interestId={source === "interest" ? row.id : undefined}
                      invitationId={row.invitation_id ?? undefined}
                      active={active}
                    />
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
      <nav className="flex gap-4">
        {page > 0 && (
          <Link href={`/protected/people?source=${source}&page=${page - 1}`}>
            {pc(locale, "newer")}
          </Link>
        )}
        {rows.length === 25 && (
          <Link href={`/protected/people?source=${source}&page=${page + 1}`}>
            {pc(locale, "older")}
          </Link>
        )}
      </nav>
    </div>
  );
}
export default function PeoplePage(props: {
  searchParams: Promise<{ source?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <People {...props} />
    </Suspense>
  );
}
