import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerifiedGate } from "@/components/verified-gate";
import { MembershipControl } from "../membership-control";
import { LeaveGroupButton } from "../leave-group-button";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { groupControl } from "@/lib/groups";
import { plural } from "@/lib/i18n";
import type {
  Category,
  GroupDirectoryRow,
  GroupRow,
  GroupMemberRow,
} from "@/lib/types/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups_directory")
    .select("name")
    .eq("slug", slug)
    .maybeSingle<{ name: string }>();
  return { title: data ? `${data.name} · Steppe` : "Group · Steppe" };
}

type RosterEntry = {
  user_id: string;
  role: GroupMemberRow["role"];
  status: GroupMemberRow["status"];
};

async function GroupContent({ params }: { params: Promise<{ slug: string }> }) {
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

  // Always-available header info from the directory view (name + category +
  // visibility + count for any verified member; description gated to null for
  // members_only). 404 if there's no such group.
  const { data: dir } = await supabase
    .from("groups_directory")
    .select(
      "id, slug, name, category_id, visibility, join_policy, is_system, description, member_count",
    )
    .eq("slug", slug)
    .maybeSingle<GroupDirectoryRow>();
  if (!dir) notFound();

  // The full base row — returns null for a members_only group you're not in
  // (grp_read). Its presence is what unlocks the description + member list.
  const { data: full } = await supabase
    .from("groups")
    .select("id, description")
    .eq("id", dir.id)
    .maybeSingle<Pick<GroupRow, "id" | "description">>();

  // My own membership (gm_read own-row read) → the control + content access.
  const { data: mem } = await supabase
    .from("group_members")
    .select("role, status")
    .eq("group_id", dir.id)
    .eq("user_id", profile.id)
    .maybeSingle<Pick<GroupMemberRow, "role" | "status">>();

  const control = groupControl({
    joinPolicy: dir.join_policy,
    isSystem: dir.is_system,
    myStatus: mem?.status ?? null,
    myRole: mem?.role ?? null,
  });

  // An active member (or any member of a public group, or the implicit Everyone
  // group) can see the description + roster. Mirrors the DB: if `full` came back,
  // you can read this group's content.
  const isActiveMember = mem?.status === "active";
  const canSeeContent = dir.visibility === "public" || isActiveMember || dir.is_system;
  const isPublic = dir.visibility === "public";

  // Roster — only meaningful when you can read it (gm_read returns the full set
  // only to active members). Active members shown here; pending requests live in
  // the maintainer console. Names via public_profiles (limited columns).
  let roster: { name: string; role: RosterEntry["role"] }[] = [];
  if (canSeeContent) {
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id, role, status")
      .eq("group_id", dir.id)
      .returns<RosterEntry[]>();
    const active = (members ?? []).filter((m) => m.status === "active");
    if (active.length > 0) {
      const { data: people } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in(
          "id",
          active.map((m) => m.user_id),
        );
      const nameById = new Map(
        (people ?? []).map((p) => [p.id, p.display_name]),
      );
      roster = active
        .map((m) => ({
          name: nameById.get(m.user_id) ?? "—",
          role: m.role,
        }))
        // Maintainers first, then alphabetical — legible, not ranked by activity.
        .sort(
          (a, b) =>
            (a.role === "maintainer" ? 0 : 1) - (b.role === "maintainer" ? 0 : 1) ||
            a.name.localeCompare(b.name),
        );
    }
  }

  const categoryName = dir.category_id
    ? (
        await supabase
          .from("categories")
          .select("name")
          .eq("id", dir.category_id)
          .maybeSingle<Pick<Category, "name">>()
      ).data?.name ?? null
    : null;

  const showCount = isPublic || isActiveMember;
  const description = full?.description ?? null;

  return (
    <div lang={locale} className="flex flex-col gap-8">
      <Link
        href="/protected/groups"
        className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {dict.groups.backToGroups}
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{dir.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {categoryName && <Badge variant="secondary">{categoryName}</Badge>}
            <Badge variant="outline">
              {isPublic
                ? dict.groups.visibilityPublic
                : dict.groups.visibilityMembersOnly}
            </Badge>
            {showCount && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5 shrink-0" aria-hidden="true" />
                {plural(locale, dir.member_count, dict.groups.memberCount)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isActiveMember ? (
            <>
              {mem?.role === "maintainer" && (
                <Button asChild variant="outline" size="default">
                  <Link href={`/protected/groups/${dir.slug}/manage`}>
                    {dict.groups.manage}
                  </Link>
                </Button>
              )}
              {/* No Leave on the Everyone group — membership there is implicit. */}
              {!dir.is_system && (
                <LeaveGroupButton
                  groupId={dir.id}
                  slug={dir.slug}
                  dict={dict}
                  size="default"
                />
              )}
            </>
          ) : (
            <MembershipControl
              control={control}
              groupId={dir.id}
              slug={dir.slug}
              dict={dict}
              size="default"
            />
          )}
        </div>
      </header>

      {/* About */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{dict.groups.aboutTitle}</h2>
        {canSeeContent ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {description || dict.groups.noDescription}
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {dict.groups.lockedAbout}
          </p>
        )}
      </section>

      {/* Members */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{dict.groups.membersTitle}</h2>
        {!canSeeContent ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {dict.groups.membersLockedNote}
          </p>
        ) : roster.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {dict.groups.membersEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {roster.map((m, i) => (
              <li
                key={`${m.name}-${i}`}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm"
              >
                <span className="font-medium">{m.name}</span>
                {m.role === "maintainer" && (
                  <Badge variant="secondary">{dict.groups.roleMaintainer}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Future phases add Posts · Events · Listings · Chat sections here; phase
          1b ships About + Members only — no placeholder tabs for unbuilt parts. */}
    </div>
  );
}

export default function GroupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GroupContent params={params} />
    </Suspense>
  );
}
