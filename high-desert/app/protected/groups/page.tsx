import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { VerifiedGate } from "@/components/verified-gate";
import { MembershipControl } from "./membership-control";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { groupControl } from "@/lib/groups";
import { plural } from "@/lib/i18n";
import type {
  Category,
  GroupDirectoryRow,
  GroupMemberRow,
} from "@/lib/types/db";

export const metadata = {
  title: "Groups · Steppe",
};

type SearchParams = { q?: string; category?: string };

async function DirectoryContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await getMyProfile();
  if (!profile) redirect("/auth/login");

  const { locale, dict } = await getServerDictionary();

  // Verified-only (RLS blocks the reads anyway; this is the friendly gate).
  if (!profile.verified)
    return (
      <VerifiedGate
        title={dict.groups.gateTitle}
        body={dict.groups.gateBody}
        ctaLabel={dict.groups.gateCta}
        locale={locale}
      />
    );

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const categoryId = (sp.category ?? "").trim();

  const supabase = await createClient();

  // The directory: every group by name + category, members_only ones with their
  // description gated to null (groups_directory view, G8). Chronological-neutral —
  // ordered by name, never ranked (invariant 7). Archived groups drop out.
  let query = supabase
    .from("groups_directory")
    .select(
      "id, slug, name, category_id, visibility, join_policy, is_system, description, member_count",
    )
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (categoryId) query = query.eq("category_id", categoryId);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: groups } = await query.returns<GroupDirectoryRow[]>();
  const rows = groups ?? [];

  // The viewer's own memberships (gm_read returns own rows at any status) → the
  // control on each card. We never read another member's status here.
  const { data: mine } = await supabase
    .from("group_members")
    .select("group_id, role, status")
    .eq("user_id", profile.id)
    .returns<Pick<GroupMemberRow, "group_id" | "role" | "status">[]>();
  const membership = new Map(mine?.map((m) => [m.group_id, m]) ?? []);

  // Categories for the filter + card labels.
  const { data: cats } = await supabase
    .from("categories")
    .select("id, slug, name")
    .order("name", { ascending: true })
    .returns<Pick<Category, "id" | "slug" | "name">[]>();
  const categories = cats ?? [];
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div lang={locale} className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.groups.title}
          </h1>
          <p className="text-sm text-muted-foreground">{dict.groups.intro}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/protected/groups/new">
            <Plus className="size-4" aria-hidden="true" />
            {dict.groups.create}
          </Link>
        </Button>
      </header>

      {/* Browse/search — a plain GET form, so it works without JavaScript. */}
      <form
        method="GET"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        role="search"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            {dict.groups.searchLabel}
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder={dict.groups.searchPlaceholder}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            {dict.groups.categoryLabel}
          </label>
          <select
            id="category"
            name="category"
            defaultValue={categoryId}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-56"
          >
            <option value="">{dict.groups.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          {dict.groups.searchSubmit}
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {dict.groups.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((g) => {
            const mem = membership.get(g.id);
            const control = groupControl({
              joinPolicy: g.join_policy,
              isSystem: g.is_system,
              myStatus: mem?.status ?? null,
              myRole: mem?.role ?? null,
            });
            const isPublic = g.visibility === "public";
            const isActiveMember = mem?.status === "active";
            // Spec §1/§37: members_only groups are listed by name + category only;
            // member count + description show for public groups (or to a member).
            const showCount = isPublic || isActiveMember;
            return (
              <li
                key={g.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/protected/groups/${g.slug}`}
                      className="font-medium underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {g.name}
                    </Link>
                    {g.category_id && (
                      <Badge variant="secondary">
                        {catName.get(g.category_id) ?? ""}
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {isPublic
                        ? dict.groups.visibilityPublic
                        : dict.groups.visibilityMembersOnly}
                    </Badge>
                  </div>
                  {isPublic && g.description && (
                    <p className="text-sm text-muted-foreground">
                      {g.description}
                    </p>
                  )}
                  {showCount && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3.5 shrink-0" aria-hidden="true" />
                      {plural(locale, g.member_count, dict.groups.memberCount)}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  <MembershipControl
                    control={control}
                    groupId={g.id}
                    slug={g.slug}
                    dict={dict}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DirectoryContent searchParams={searchParams} />
    </Suspense>
  );
}
