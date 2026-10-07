import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement, ReactNode } from "react";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import { groupArchiveCopy } from "@/lib/group-archive-copy";
const id = "11111111-1111-4111-8111-111111111111";
const m = vi.hoisted(() => ({
  profile: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
  locale: "en",
  archived: true,
  system: false,
  maintainer: true,
  tables: [] as string[],
}));
vi.mock("@/lib/auth", () => ({ getMyProfile: m.profile }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: async () => ({
    locale: m.locale,
    dict: m.locale === "es" ? es : en,
  }),
}));
import Detail from "@/app/protected/groups/[slug]/page";
import Manage from "@/app/protected/groups/[slug]/manage/page";
import { archiveGroup } from "@/app/protected/groups/[slug]/manage/actions";
const props = {
  params: Promise.resolve({ slug: "synthetic" }),
  searchParams: Promise.resolve({}),
};
async function render(Page: typeof Detail | typeof Manage) {
  const shell = Page(props) as ReactElement<{
    children: ReactElement<Record<string, unknown>>;
  }>;
  const child = shell.props.children;
  return renderToStaticMarkup(
    await (child.type as (p: Record<string, unknown>) => Promise<ReactNode>)(
      child.props,
    ),
  );
}
function form() {
  const f = new FormData();
  f.set("group_id", id);
  f.set("confirm", "1");
  return f;
}
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(m, {
    locale: "en",
    archived: true,
    system: false,
    maintainer: true,
    tables: [],
  });
  m.profile.mockResolvedValue({ id, verified: true });
  m.rpc.mockResolvedValue({ error: null });
  m.client.mockResolvedValue({
    rpc: m.rpc,
    from(table: string) {
      m.tables.push(table);
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        in: () => q,
        returns: () => Promise.resolve({ data: [] }),
        maybeSingle: async () => ({
          data:
            table === "group_members"
              ? {
                  role: m.maintainer ? "maintainer" : "member",
                  status: "active",
                }
              : {
                  id,
                  slug: "synthetic",
                  name: "Synthetic group",
                  is_system: m.system,
                  archived_at: m.archived ? "2026-01-01" : null,
                },
        }),
      };
      return q;
    },
  });
});
describe("group archival routes and action", () => {
  it.each(["en", "es"])(
    "renders safe archived notices on both old routes in %s",
    async (locale) => {
      m.locale = locale;
      for (const Page of [Detail, Manage]) {
        m.tables = [];
        const html = await render(Page);
        expect(html).toContain(
          groupArchiveCopy[locale as "en" | "es"].archived,
        );
        expect(html).toContain("/protected/account/calendar");
        expect(html).not.toContain("<form");
        expect(m.tables).toEqual(["groups_directory"]);
      }
    },
  );
  it("offers confirmed archival only to maintainers of non-system active groups", async () => {
    m.archived = false;
    expect(await render(Manage)).toContain('name="confirm"');
    m.system = true;
    expect(await render(Manage)).not.toContain('name="confirm"');
    m.system = false;
    m.maintainer = false;
    await expect(render(Manage)).rejects.toMatchObject({
      digest: expect.stringContaining("/protected/groups/synthetic"),
    });
  });
  it("requires sign-in and verification", async () => {
    m.profile.mockResolvedValue(null);
    await expect(archiveGroup(null, form())).rejects.toMatchObject({
      digest: expect.stringContaining("/auth/login"),
    });
    m.profile.mockResolvedValue({ id, verified: false });
    expect(await archiveGroup(null, form())).toEqual({ error: "forbidden" });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["group_id", "bad"],
    ["confirm", ""],
    ["confirm", "on"],
  ])("rejects invalid %s", async (k, v) => {
    const f = form();
    f.set(k, v);
    expect(await archiveGroup(null, f)).toEqual({ error: "action-failed" });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("uses only the session RPC and revalidates dependent views on success", async () => {
    const f = form();
    f.set("slug", "//untrusted");
    f.set("actor_id", "forged");
    await expect(archiveGroup(null, f)).rejects.toMatchObject({
      digest: expect.stringContaining("/protected/groups?archived=1"),
    });
    expect(m.rpc).toHaveBeenCalledWith("archive_group", { p_group: id });
    expect(m.revalidate).toHaveBeenCalledWith("/protected/groups", "layout");
    expect(m.revalidate).toHaveBeenCalledWith("/protected/account/calendar");
  });
  it("sanitizes database and transport failures without claiming success", async () => {
    m.rpc.mockResolvedValue({ error: { message: "Private refusal" } });
    expect(await archiveGroup(null, form())).toEqual({
      error: "action-failed",
    });
    m.rpc.mockRejectedValue(new Error("Private transport"));
    expect(await archiveGroup(null, form())).toEqual({
      error: "action-failed",
    });
    expect(m.revalidate).not.toHaveBeenCalled();
  });
});
