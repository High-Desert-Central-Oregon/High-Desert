import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateGroupForm } from "./create-group-form";
import { VerifiedGate } from "@/components/verified-gate";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import type { Category } from "@/lib/types/db";

export const metadata = {
  title: "Create a group · Steppe",
};

async function NewGroupContent() {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();

  // Verified-only to create (enforced by create_group; friendly gate here).
  if (!profile.verified)
    return (
      <VerifiedGate
        title={dict.groups.gateTitle}
        body={dict.groups.gateBody}
        ctaLabel={dict.groups.gateCta}
        locale={locale}
      />
    );

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("categories")
    .select("id, slug, name")
    .order("name", { ascending: true })
    .returns<Pick<Category, "id" | "slug" | "name">[]>();

  return (
    <div lang={locale} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/protected/groups"
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {dict.groups.backToGroups}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.groups.newTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.groups.newIntro}</p>
      </div>

      <CreateGroupForm categories={cats ?? []} dict={dict} />
    </div>
  );
}

export default function NewGroupPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewGroupContent />
    </Suspense>
  );
}
