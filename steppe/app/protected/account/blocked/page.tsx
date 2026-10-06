import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { getMyProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServerDictionary } from "@/lib/i18n/server";
import { blocksCopy } from "@/lib/messages/blocks-copy";
import { UnblockForm } from "./unblock-form";
export const metadata = { title: "Blocked members · Steppe" };
async function Content({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const [{ locale }, params] = await Promise.all([
    getServerDictionary(),
    searchParams,
  ]);
  const copy = blocksCopy[locale];
  const db = await createClient();
  const { data: blocks, error } = await db
    .from("member_blocks")
    .select("blocked_id")
    .eq("blocker_id", profile.id)
    .order("created_at", { ascending: false });
  const ids = (blocks ?? []).map((b) => b.blocked_id as string);
  const { data: people } =
    !error && ids.length
      ? await db.from("public_profiles").select("id,display_name").in("id", ids)
      : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.display_name]));
  return (
    <div lang={locale} className="flex min-w-0 flex-col gap-6">
      <Link
        href="/protected/account"
        className="focus-ring self-start underline"
      >
        {copy.back}
      </Link>
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.sub}</p>
      {params.saved === "1" && (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      )}
      {error ? (
        <p role="alert">{copy.unavailable}</p>
      ) : ids.length ? (
        <ul className="flex min-w-0 flex-col gap-4">
          {ids.map((id) => (
            <li key={id} className="min-w-0">
              <UnblockForm
                blockedId={id}
                name={names.get(id) || copy.neighbor}
                locale={locale}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p>{copy.empty}</p>
      )}
      <Link
        href="/protected/messages"
        className="focus-ring self-start underline"
      >
        {copy.messages}
      </Link>
    </div>
  );
}
export default function Page(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
