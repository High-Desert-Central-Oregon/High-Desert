import { Suspense } from "react";
import Image from "next/image";
import { PageSkeleton } from "@/components/page-skeleton";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Masthead } from "@/components/broadsheet/masthead";
import { SectionRow } from "@/components/broadsheet/section-row";
import { Fab } from "@/components/broadsheet/fab";
import { MarkerChip } from "@/components/broadsheet/chips";
import { ActionLink } from "@/components/broadsheet/action-link";
import { Input } from "@/components/ui/input";
import { VerifiedGate } from "@/components/verified-gate";
import { MembershipControl } from "./membership-control";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { groupControl } from "@/lib/groups";
import { categoryMarker, visibilityMarker } from "@/lib/markers";
import { plural } from "@/lib/i18n";
import type {
  Category,
  GroupDirectoryRow,
  GroupMemberRow,
} from "@/lib/types/db";

export const metadata = {
  title: "Groups · Steppe",
};

type SearchParams = { q?: string; category?: string; s?: string };

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
  // The search bar opens via the header slot (?s=1) and stays open server-side
  // whenever a filter is active — no JavaScript required.
  const searchOpen = sp.s === "1" || q !== "" || categoryId !== "";

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
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div lang={locale} className="flex flex-col gap-8">
      {/* Preview masthead grammar (dateline + voice are the bundle's own).
          The search slot lives in the shell header now (AppNav) — same ?s=1
          link, global on member routes. */}
      <Masthead
        title={dict.groups.title}
        kicker={dict.groups.dateline}
        voice={dict.groups.voice}
      />
      <Fab href="/protected/groups/new" label={dict.groups.create} />

      {/* Browse/search — a plain GET form (JS-optional), revealed by the header
          slot; the category filter lives INSIDE it, not stacked on the root. */}
      {searchOpen && (
      <form
        method="GET"
        className="flex flex-col gap-3 border bg-muted/40 p-4 sm:flex-row sm:items-end"
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
        <div className="flex items-center gap-4">
          <Button type="submit" variant="outline">
            {dict.groups.searchSubmit}
          </Button>
          <ActionLink href="/protected/groups" label={dict.common.cancel} />
        </div>
      </form>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
          {/* ISoMiMo warms the empty state (floor 120px). */}
          <Image
            src="/brand/steppe-isomimo-512.png"
            alt={dict.common.isomimoAlt}
            width={150}
            height={150}
          />
          <p className="text-sm text-muted-foreground">{dict.groups.empty}</p>
        </div>
      ) : (
        <ul className="flex flex-col border-t">
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
            const cat = g.category_id ? catById.get(g.category_id) : undefined;
            return (
              <li key={g.id}>
                {/* Preview row anatomy: marker kicker (category + visibility
                    chips — colored square, always labeled), linked Besley
                    title, quiet description, mono member meta; the membership
                    control keeps the right slot. */}
                <SectionRow
                  titleHref={`/protected/groups/${g.slug}`}
                  kicker={
                    <>
                      {cat && (
                        <MarkerChip
                          label={cat.name}
                          color={categoryMarker(cat.slug)}
                        />
                      )}
                      <MarkerChip
                        label={
                          isPublic
                            ? dict.groups.visibilityPublic
                            : dict.groups.visibilityMembersOnly
                        }
                        color={visibilityMarker(g.visibility)}
                      />
                    </>
                  }
                  title={g.name}
                  sub={isPublic && g.description ? g.description : undefined}
                  meta={
                    showCount
                      ? plural(locale, g.member_count, dict.groups.memberCount)
                      : undefined
                  }
                  right={
                    <div className="shrink-0">
                      <MembershipControl
                        control={control}
                        groupId={g.id}
                        slug={g.slug}
                        dict={dict}
                      />
                    </div>
                  }
                />
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
