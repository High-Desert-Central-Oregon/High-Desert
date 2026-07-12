import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { VerifiedGate } from "@/components/verified-gate";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { PostForm } from "./post-form";

export const metadata = {
  title: "New post · Steppe",
};

async function NewPostContent() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();

  if (!profile.verified) {
    return (
      <VerifiedGate
        title={dict.exchange.gateTitle}
        body={dict.exchange.gateBody}
        ctaLabel={dict.exchange.gateCta}
        locale={locale}
      />
    );
  }

  // The neighborhood picker (optional field; empty = "All of Redmond").
  const supabase = await createClient();
  const { data: neighborhoods } = await supabase
    .from("neighborhoods")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<{ id: string; name: string }[]>();

  return (
    <div lang={locale} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/protected/exchange"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {dict.exchange.backToBoard}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.exchange.newTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.exchange.newIntro}</p>
      </div>

      <PostForm neighborhoods={neighborhoods ?? []} dict={dict} />
    </div>
  );
}

export default function NewPostPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewPostContent />
    </Suspense>
  );
}
