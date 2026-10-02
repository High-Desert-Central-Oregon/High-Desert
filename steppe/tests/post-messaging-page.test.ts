import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "@/lib/i18n/dictionaries/en";

const state = vi.hoisted(() => ({ role: "member", allowed: false, owner: false, verified: true, hidden: false }));
vi.mock("@/lib/auth", () => ({
  getMyProfile: async () => ({ id: state.owner ? "author" : "reader", verified: state.verified, role: state.role }),
}));
vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: async () => ({ locale: "en", dict: en }),
}));
vi.mock("@/app/protected/exchange/actions", () => ({ deletePost: vi.fn() }));
vi.mock("@/app/protected/messages/actions", () => ({ startThread: vi.fn(), startThreadDraft: vi.fn() }));
vi.mock("@/app/protected/moderation/actions", () => ({ fileReport: vi.fn(), moderateContent: vi.fn() }));
// The async appeal lookup is outside this rendering test's messaging scope.
vi.mock("@/app/protected/moderation/appeal-area", () => ({ AppealArea: () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      const rows: Record<string, object | null> = {
        posts: {
          id: "post", author_id: "author", category: "offer", tags: ["offer"],
          title: "Synthetic tools", body: "Synthetic body", neighborhood_id: null,
          created_at: "2026-10-02T10:00:00Z", edited_at: null, allow_messages: state.allowed,
        },
        public_profiles: { display_name: "Synthetic Author" },
        content_moderation: state.hidden
          ? { action_id: "removal", action: "remove", reason: "Synthetic removal", created_at: "2026-10-02T11:00:00Z" }
          : null,
      };
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
      };
      return query;
    },
  }),
}));
import Page from "@/app/protected/exchange/[id]/page";
async function renderPage() {
  const shell = Page({ params: Promise.resolve({ id: "post" }), searchParams: Promise.resolve({}) }) as ReactElement<{ children: ReactElement }>;
  const child = shell.props.children as ReactElement<Record<string, unknown>>;
  const content = await (child.type as (props: Record<string, unknown>) => Promise<ReactNode>)(child.props);
  return renderToStaticMarkup(content);
}
beforeEach(() => {
  Object.assign(state, { role: "member", allowed: false, owner: false, verified: true, hidden: false });
});
describe("post messaging entry on the actual detail page", () => {
  it.each(["member", "admin", "moderator"])("shows a private composer to an eligible %s only with opt-in", async (role) => {
    state.role = role;
    let html = await renderPage();
    expect(html).toContain(en.exchange.messagesOff);
    expect(html).not.toContain('name="about_post"');
    state.allowed = true;
    html = await renderPage();
    expect(html).toContain(en.messages.messageAuthor.replace("{name}", "Synthetic"));
    expect(html).toContain('name="about_post" value="post"');
    expect(html).toContain('name="with_id" value="author"');
    expect(html).toContain(en.messages.composePrivacy);
  });
  it.each([false, true])("shows an owner their saved permission (%s) and edit link without a self-message composer", async (allowed) => {
    state.owner = true; state.allowed = allowed;
    const html = await renderPage();
    expect(html).toContain(allowed ? en.exchange.messagesOn : en.exchange.messagesOff);
    expect(html).toContain('href="/protected/exchange/post/edit"');
    expect(html).not.toContain('name="about_post"');
  });
  it("keeps hidden posts and unverified readers outside the composer", async () => {
    state.allowed = true; state.verified = false;
    let html = await renderPage();
    expect(html).toContain(en.exchange.gateTitle);
    expect(html).not.toContain('name="about_post"');
    state.verified = true; state.hidden = true; state.role = "moderator";
    html = await renderPage();
    expect(html).toContain("Synthetic removal");
    expect(html).not.toContain('name="about_post"');
  });
});
