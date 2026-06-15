import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { VerifiedGate } from "@/components/verified-gate";
import { SettingsForm } from "./settings-form";
import { MemberManagement } from "./member-management";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import type {
  Category,
  GroupDirectoryRow,
  GroupRow,
  GroupMemberRow,
} from "@/lib/types/db";

export const metadata = {
  title: "Manage group · Steppe",
};

type RosterRow = Pick<GroupMemberRow, "user_id" | "role" | "status">;

async function ManageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();

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

  // Resolve the group (directory view always returns it for a verified member).
  const { data: dir } = await supabase
    .from("groups_directory")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle<Pick<GroupDirectoryRow, "id" | "slug" | "name">>();
  if (!dir) notFound();

  // Maintainer gate (friendly; the RPCs re-check is_group_maintainer). A
  // non-maintainer is sent back to the group page.
  const { data: me } = await supabase
    .from("group_members")
    .select("role, status")
    .eq("group_id", dir.id)
    .eq("user_id", profile.id)
    .maybeSingle<Pick<GroupMemberRow, "role" | "status">>();
  if (!(me?.role === "maintainer" && me.status === "active"))
    redirect(`/protected/groups/${slug}`);

  // Full settings row (maintainer is an active member, so grp_read allows it).
  const { data: group } = await supabase
    .from("groups")
    .select("id, description, category_id, visibility, join_policy")
    .eq("id", dir.id)
    .maybeSingle<
      Pick<GroupRow, "id" | "description" | "category_id" | "visibility" | "join_policy">
    >();
  if (!group) notFound();

  // Roster (gm_read returns all rows to an active member) + names.
  const { data: roster } = await supabase
    .from("group_members")
    .select("user_id, role, status")
    .eq("group_id", dir.id)
    .returns<RosterRow[]>();
  const rosterRows = roster ?? [];
  const memberIds = new Set(rosterRows.map((r) => r.user_id));

  // Verified members not already in the group → candidates for "add member"
  // (the locked/invite path). public_profiles is readable by any verified member.
  const { data: verifiedPeople } = await supabase
    .from("public_profiles")
    .select("id, display_name, verified")
    .eq("verified", true)
    .returns<{ id: string; display_name: string; verified: boolean }[]>();

  const nameById = new Map(
    (verifiedPeople ?? []).map((p) => [p.id, p.display_name]),
  );

  const pending = rosterRows
    .filter((r) => r.status === "pending" || r.status === "invited")
    .map((r) => ({ userId: r.user_id, name: nameById.get(r.user_id) ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const active = rosterRows
    .filter((r) => r.status === "active")
    .map((r) => ({
      userId: r.user_id,
      name: nameById.get(r.user_id) ?? "—",
      role: r.role,
    }))
    .sort(
      (a, b) =>
        (a.role === "maintainer" ? 0 : 1) - (b.role === "maintainer" ? 0 : 1) ||
        a.name.localeCompare(b.name),
    );

  const candidates = (verifiedPeople ?? [])
    .filter((p) => !memberIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.display_name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: cats } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<Pick<Category, "id" | "name">[]>();

  return (
    <div lang={locale} className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link
          href={`/protected/groups/${slug}`}
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {dict.groups.backToGroup}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.groups.manageTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{dict.groups.manageIntro}</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{dict.groups.settingsTitle}</h2>
        <SettingsForm
          groupId={group.id}
          slug={slug}
          name={dir.name}
          description={group.description}
          categoryId={group.category_id}
          visibility={group.visibility}
          joinPolicy={group.join_policy}
          categories={cats ?? []}
          dict={dict}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{dict.groups.membersTitle}</h2>
        <MemberManagement
          groupId={group.id}
          slug={slug}
          pending={pending}
          active={active}
          candidates={candidates}
          myUserId={profile.id}
          dict={dict}
        />
      </section>
    </div>
  );
}

export default function ManageGroupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ManageContent params={params} />
    </Suspense>
  );
}
