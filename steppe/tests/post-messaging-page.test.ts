import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";

const state = vi.hoisted(() => ({
  role: "member", allowed: false, owner: false, verified: true, hidden: false,
  locale: "en" as "en" | "es",
  thread: null as { id: string; member_a: string; member_b: string; request_status: string } | null,
  lookupError: false,
  filters: {} as Record<string, unknown>,
}));
vi.mock("@/lib/auth", () => ({
  getMyProfile: async () => ({ id: state.owner ? "author" : "reader", verified: state.verified, role: state.role }),
}));
vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: async () => ({ locale: state.locale, dict: state.locale === "es" ? es : en }),
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
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters[key] = value; return query; },
        maybeSingle: async () => {
          if (table !== "threads") return { data: rows[table] ?? null, error: null };
          state.filters = filters;
          return {
            data: state.thread?.member_a === filters.member_a && state.thread?.member_b === filters.member_b
              ? state.thread : null,
            error: state.lookupError ? { message: "Synthetic read failure" } : null,
          };
        },
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
  Object.assign(state, { role: "member", allowed: false, owner: false, verified: true, hidden: false,
    locale: "en", thread: null, lookupError: false, filters: {} });
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
  it.each(["pending", "accepted", "declined"])("opens an existing %s conversation with either post permission", async (request_status) => {
    state.thread = { id: "existing-thread", member_a: "author", member_b: "reader", request_status };
    for (const allowed of [false, true]) {
      state.allowed = allowed;
      const html = await renderPage();
      expect(html).toContain('href="/protected/messages/existing-thread"');
      expect(html).toContain(en.messages.openConversation);
      expect(html).not.toContain('name="about_post"');
      expect(state.filters).toEqual({ member_a: "author", member_b: "reader" });
    }
  });
  it("does not reuse another pair's conversation", async () => {
    state.allowed = true;
    state.thread = { id: "other-thread", member_a: "author", member_b: "someone-else", request_status: "accepted" };
    const html = await renderPage();
    expect(html).not.toContain('/protected/messages/other-thread');
    expect(html).toContain('name="about_post"');
  });
  it("does not offer a fresh composer after an existing-pair read failure", async () => {
    state.allowed = true;
    state.lookupError = true;
    await expect(renderPage()).rejects.toThrow("Unable to load existing conversation");
  });
  it("labels the existing conversation in Spanish", async () => {
    state.locale = "es";
    state.thread = { id: "existing-thread", member_a: "author", member_b: "reader", request_status: "declined" };
    expect(await renderPage()).toContain(es.messages.openConversation);
  });
});
