import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement, ReactNode } from "react";
import { en } from "@/lib/i18n/dictionaries/en";
import { consentCopy } from "@/lib/messages/consent-copy";
const s = vi.hoisted(() => ({
  uid: "recipient",
  status: "pending",
  allowed: false,
  support: false,
  visible: true,
  verified: true,
}));
vi.mock("@/lib/auth", () => ({
  getMyProfile: async () => ({ id: s.uid, verified: s.verified }),
}));
vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: async () => ({ locale: "en", dict: en }),
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/app/protected/messages/actions", () => ({
  sendReply: vi.fn(),
  sendReplyDraft: vi.fn(),
  respondToRequest: vi.fn(),
}));
vi.mock("@/app/protected/messages/[id]/thread-menu", () => ({
  ThreadMenu: () => null,
}));
vi.mock("@/lib/messages/contact", () => ({
  getSupportThreads: async () =>
    s.support
      ? [
          {
            thread_id: "thread",
            contact_id: "sender",
            counterpart_name: "Synthetic member",
          },
        ]
      : [],
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async () => ({ data: s.allowed, error: null }),
    from(table: string) {
      const rows: Record<string, unknown> = {
        threads: s.visible
          ? {
              id: "thread",
              member_a: "sender",
              member_b: "recipient",
              about_post_id: null,
              about_group_id: null,
              started_by: "sender",
              request_status: s.status,
            }
          : null,
        messages: [
          {
            id: "message",
            sender_id: "sender",
            body: "Synthetic request",
            created_at: "2026-10-02T12:00:00Z",
          },
        ],
        public_profiles: { display_name: "Synthetic neighbor" },
        thread_state: { muted_at: null },
      };
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        returns: async () => ({ data: rows[table], error: null }),
        maybeSingle: async () => ({ data: rows[table], error: null }),
      };
      return q;
    },
  }),
}));
import Page from "@/app/protected/messages/[id]/page";
async function render() {
  const shell = Page({
    params: Promise.resolve({ id: "thread" }),
    searchParams: Promise.resolve({}),
  }) as ReactElement<{ children: ReactElement }>;
  const c = shell.props.children as ReactElement<Record<string, unknown>>;
  return renderToStaticMarkup(
    await (c.type as (p: Record<string, unknown>) => Promise<ReactNode>)(
      c.props,
    ),
  );
}
beforeEach(() =>
  Object.assign(s, {
    uid: "recipient",
    status: "pending",
    allowed: false,
    support: false,
    visible: true,
    verified: true,
  }),
);
describe("actual message request thread page", () => {
  it("shows recipient Accept/Decline/Block without a reply composer", async () => {
    const html = await render();
    for (const response of ["accept", "decline", "block"])
      expect(html).toContain(`value="${response}"`);
    expect(html).not.toContain('id="reply"');
    expect(html).toContain("Synthetic request");
  });
  it("shows a sender their waiting status without decision controls or a reply composer", async () => {
    s.uid = "sender";
    const html = await render();
    expect(html).toContain(consentCopy.en.waiting);
    expect(html).not.toContain('name="response"');
    expect(html).not.toContain('id="reply"');
  });
  it("shows the reply form only when the database permits sends", async () => {
    s.status = "accepted";
    let html = await render();
    expect(html).not.toContain('id="reply"');
    s.allowed = true;
    html = await render();
    expect(html).toContain('id="reply"');
    expect(html).not.toContain('name="response"');
  });
  it("closes declined requests and retains readable history", async () => {
    s.status = "declined";
    const html = await render();
    expect(html).toContain(consentCopy.en.closed);
    expect(html).toContain("Synthetic request");
    expect(html).not.toContain('id="reply"');
  });
  it("keeps the pending-member Contact Steppe composer available", async () => {
    s.support = true;
    s.verified = false;
    s.allowed = true;
    const html = await render();
    expect(html).toContain('id="reply"');
    expect(html).not.toContain('name="response"');
  });
  it("cannot render another participant’s thread when RLS hides it", async () => {
    s.visible = false;
    await expect(render()).rejects.toThrow();
  });
});
