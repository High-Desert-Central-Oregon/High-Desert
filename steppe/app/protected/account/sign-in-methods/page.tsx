import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { ProviderButtons } from "@/components/member-pipelines/provider-buttons";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { pipelinesEnabled } from "@/lib/member-pipelines/server";
import { pc } from "@/lib/member-pipelines/copy";
async function Methods() {
  if (!pipelinesEnabled()) redirect("/protected/account");
  const locale = await getLocale();
  const db = await createClient();
  const { data, error } = await db.auth.getUserIdentities();
  return (
    <div lang={locale} className="flex flex-col gap-5">
      <h1 className="font-serif text-3xl">{pc(locale, "signInMethods")}</h1>
      <p>{pc(locale, "methodsIntro")}</p>
      <h2 className="font-semibold">{pc(locale, "connected")}</h2>
      {error ? (
        <p role="alert">{pc(locale, "loadFailed")}</p>
      ) : (
        <ul>
          {data?.identities.map((identity) => (
            <li className="border-b py-2 capitalize" key={identity.id}>
              {identity.provider}
            </li>
          ))}
        </ul>
      )}
      <ProviderButtons
        locale={locale}
        connect
        connected={data?.identities.map((identity) => identity.provider) ?? []}
      />
    </div>
  );
}
export default function MethodsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Methods />
    </Suspense>
  );
}
