import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { getMyProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServerDictionary } from "@/lib/i18n/server";
import {
  consentCopy,
  type GroupMessagePreference,
} from "@/lib/messages/consent-copy";
import { GroupContactForm } from "./consent-forms";
export const metadata = { title: "Messaging preferences · Steppe" };
async function Content() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const { locale } = await getServerDictionary();
  const copy = consentCopy[locale];
  const db = await createClient();
  const [{ data: members }, { data: preferences }] = await Promise.all([
    db
      .from("group_members")
      .select("group_id")
      .eq("user_id", profile.id)
      .eq("status", "active"),
    db
      .from("group_message_preferences")
      .select("group_id,acknowledged_version,allow_requests")
      .returns<GroupMessagePreference[]>(),
  ]);
  const ids = (members ?? []).map((m) => m.group_id);
  const { data: groups } =
    profile.verified && ids.length
      ? await db
          .from("groups")
          .select("id,slug,name,messaging_rules,messaging_rules_version")
          .in("id", ids)
          .eq("is_system", false)
          .is("archived_at", null)
          .order("name")
      : { data: [] };
  const prefs = new Map((preferences ?? []).map((p) => [p.group_id, p]));
  return (
    <div lang={locale} className="flex flex-col gap-6">
      <Link
        href="/protected/account"
        className="self-start underline focus-ring"
      >
        {locale === "es" ? "Volver a Tú" : "Back to You"}
      </Link>
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.sub}</p>
      {!(groups ?? []).length && <p>{copy.empty}</p>}
      {(groups ?? []).map((g) => (
        <section key={g.id} className="flex flex-col gap-4 border bg-card p-4">
          <h2 className="text-lg font-semibold">
            <Link
              href={`/protected/groups/${g.slug}`}
              className="underline focus-ring"
            >
              {g.name}
            </Link>
          </h2>
          <GroupContactForm
            key={`${g.id}-${g.messaging_rules_version}`}
            groupId={g.id}
            rules={g.messaging_rules}
            version={g.messaging_rules_version}
            acknowledgedVersion={prefs.get(g.id)?.acknowledged_version ?? null}
            allow={prefs.get(g.id)?.allow_requests ?? false}
            locale={locale}
          />
        </section>
      ))}
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
