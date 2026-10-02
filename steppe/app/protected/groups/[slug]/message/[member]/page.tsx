import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { getMyProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServerDictionary } from "@/lib/i18n/server";
import { consentCopy } from "@/lib/messages/consent-copy";
import { MessageForm } from "@/app/protected/messages/message-form";
import {
  startGroupThread,
  startGroupThreadDraft,
} from "@/app/protected/messages/actions";
async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; member: string }>;
  searchParams: Promise<{ msgErr?: string }>;
}) {
  const { slug, member } = await params;
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");
  const { locale, dict } = await getServerDictionary();
  const copy = consentCopy[locale];
  const db = await createClient();
  const { data: group } = await db
    .from("groups")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();
  if (!group) notFound();
  const { data: contacts } = await db.rpc("group_message_contacts", {
    p_group: group.id,
  });
  const recipient = (
    contacts as { member_id: string; display_name: string }[] | null
  )?.find((p) => p.member_id === member);
  if (!recipient) notFound();
  return (
    <div lang={locale} className="flex flex-col gap-4">
      <Link
        href={`/protected/groups/${slug}`}
        className="self-start underline focus-ring"
      >
        {copy.back}
      </Link>
      <h1 className="text-2xl font-semibold">
        {copy.message.replace("{name}", recipient.display_name)}
      </h1>
      <p className="text-sm">{group.name}</p>
      <p className="text-sm text-muted-foreground">{copy.requestHint}</p>
      {(await searchParams).msgErr === "1" && (
        <p role="alert">{dict.messages.draftError}</p>
      )}
      <MessageForm
        action={startGroupThreadDraft}
        fallbackAction={startGroupThread}
        className="flex flex-col gap-3"
        buttonClassName="self-start min-h-11 bg-primary px-4 py-2 font-semibold text-primary-foreground focus-ring"
        sendLabel={copy.sendRequest}
        sendingLabel={dict.messages.starting}
        errorMessage={dict.messages.draftError}
      >
        <input type="hidden" name="group_id" value={group.id} />
        <input type="hidden" name="with_id" value={member} />
        <input type="hidden" name="slug" value={slug} />
        <label htmlFor="group-message">{dict.messages.placeholder}</label>
        <textarea
          id="group-message"
          name="body"
          required
          maxLength={4000}
          rows={5}
          className="field-control focus-ring w-full border bg-card p-3 text-base"
        />
        <p className="text-sm text-muted-foreground">
          {dict.messages.composePrivacy}
        </p>
      </MessageForm>
    </div>
  );
}
export default function Page(props: {
  params: Promise<{ slug: string; member: string }>;
  searchParams: Promise<{ msgErr?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
