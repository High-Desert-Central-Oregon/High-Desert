import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const actor = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const m = vi.hoisted(() => ({
  profile: vi.fn(),
  client: vi.fn(),
  revalidate: vi.fn(),
  locale: "en",
  blocks: [] as { blocked_id: string }[],
  people: [] as { id: string; display_name: string }[],
  readError: null as object | null,
  deleteError: null as object | null,
  calls: [] as unknown[][],
}));
vi.mock("@/lib/auth", () => ({ getMyProfile: m.profile }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: async () => ({ locale: m.locale }),
}));
import Page from "@/app/protected/account/blocked/page";
import { unblockMember } from "@/app/protected/account/blocked/actions";
import { blocksCopy } from "@/lib/messages/blocks-copy";
function form() {
  const f = new FormData();
  f.set("blocked_id", other);
  f.set("confirm", "1");
  return f;
}
async function render(saved?: string) {
  const shell = Page({
    searchParams: Promise.resolve({ saved }),
  }) as ReactElement<{ children: ReactElement<Record<string, unknown>> }>;
  const child = shell.props.children;
  return renderToStaticMarkup(
    await (child.type as (p: Record<string, unknown>) => Promise<ReactNode>)(
      child.props,
    ),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(m, {
    locale: "en",
    blocks: [],
    people: [],
    readError: null,
    deleteError: null,
    calls: [],
  });
  m.profile.mockResolvedValue({ id: actor, verified: true });
  m.client.mockResolvedValue({
    from(table: string) {
      m.calls.push(["from", table]);
      let deleting = false;
      const q = {
        select: (v: string) => {
          m.calls.push(["select", table, v]);
          return q;
        },
        delete: () => {
          deleting = true;
          m.calls.push(["delete", table]);
          return q;
        },
        eq: (k: string, v: string) => {
          m.calls.push(["eq", table, k, v]);
          return q;
        },
        in: (k: string, v: string[]) => {
          m.calls.push(["in", table, k, v]);
          return q;
        },
        order: () => q,
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve(
            resolve(
              deleting
                ? { error: m.deleteError }
                : {
                    data: table === "member_blocks" ? m.blocks : m.people,
                    error: table === "member_blocks" ? m.readError : null,
                  },
            ),
          );
        },
      };
      return q;
    },
  });
});
describe("blocked member list and own-block removal", () => {
  it.each(["en", "es"])(
    "renders private own list and deliberate confirmation in %s",
    async (locale) => {
      m.locale = locale;
      m.blocks = [{ blocked_id: other }];
      m.people = [{ id: other, display_name: "Sample Neighbor" }];
      const html = await render(),
        c = blocksCopy[locale as "en" | "es"];
      expect(html).toContain(c.title);
      expect(html).toContain("Sample Neighbor");
      expect(html).toContain(c.closed);
      expect(html).toContain('name="confirm"');
      expect(html).toContain('type="checkbox"');
      expect(html).not.toContain('open=""');
      expect(m.calls).toContainEqual([
        "eq",
        "member_blocks",
        "blocker_id",
        actor,
      ]);
      expect(m.calls).toContainEqual([
        "select",
        "public_profiles",
        "id,display_name",
      ]);
    },
  );
  it("distinguishes empty, unavailable, and unnamed members", async () => {
    expect(await render()).toContain(blocksCopy.en.empty);
    m.readError = { message: "Private" };
    const failed = await render();
    expect(failed).toContain(blocksCopy.en.unavailable);
    expect(failed).not.toContain(blocksCopy.en.empty);
    expect(failed).not.toContain("Private");
    m.readError = null;
    m.blocks = [{ blocked_id: other }];
    expect(await render()).toContain("name unavailable");
    expect(await render("1")).toContain(blocksCopy.en.saved);
  });
  it("allows signed-in unverified members to manage their own support blocks", async () => {
    m.profile.mockResolvedValue({ id: actor, verified: false });
    expect(await render()).toContain(blocksCopy.en.empty);
    await expect(unblockMember(null, form())).rejects.toMatchObject({
      digest: expect.stringContaining("blocked?saved=1"),
    });
  });
  it("requires sign-in for both list and action", async () => {
    m.profile.mockResolvedValue(null);
    await expect(render()).rejects.toMatchObject({
      digest: expect.stringContaining("/auth/login"),
    });
    await expect(unblockMember(null, form())).rejects.toMatchObject({
      digest: expect.stringContaining("/auth/login"),
    });
    expect(m.client).not.toHaveBeenCalled();
  });
  it.each([
    ["blocked_id", "invalid"],
    ["blocked_id", actor],
    ["confirm", ""],
    ["confirm", "on"],
  ])("rejects invalid %s without writes", async (key, value) => {
    const f = form();
    f.set(key, value);
    expect(await unblockMember(null, f)).toEqual({ error: "send-failed" });
    expect(m.client).not.toHaveBeenCalled();
  });
  it("pins blocker to the acting member and only removes that outgoing block", async () => {
    const f = form();
    f.set("blocker_id", other);
    await expect(unblockMember(null, f)).rejects.toMatchObject({
      digest: expect.stringContaining("blocked?saved=1"),
    });
    expect(m.calls).toEqual([
      ["from", "member_blocks"],
      ["delete", "member_blocks"],
      ["eq", "member_blocks", "blocker_id", actor],
      ["eq", "member_blocks", "blocked_id", other],
    ]);
    expect(m.revalidate).toHaveBeenCalledWith("/protected/messages", "layout");
  });
  it("does not claim success for refused or interrupted writes", async () => {
    m.deleteError = { message: "Private rejection" };
    expect(await unblockMember(null, form())).toEqual({ error: "send-failed" });
    expect(m.revalidate).not.toHaveBeenCalled();
    m.client.mockRejectedValue(new Error("Private transport"));
    expect(await unblockMember(null, form())).toEqual({ error: "send-failed" });
  });
});
