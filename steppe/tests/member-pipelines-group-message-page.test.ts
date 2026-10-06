import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement, ReactNode } from "react";
import { en } from "@/lib/i18n/dictionaries/en";

const s = vi.hoisted(() => ({
  uid: "00000000-0000-0000-0000-000000000002" as string | null,
  recipient: "00000000-0000-0000-0000-000000000001",
  groupVisible: true,
  contactEligible: true,
  lookupError: false,
  threads: [] as {
    id: string;
    member_a: string;
    member_b: string;
    request_status: string;
  }[],
  filters: {} as Record<string, unknown>,
  contactsRead: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getMyProfile: async () => s.uid ? { id: s.uid, verified: true } : null,
}));
vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: async () => ({ locale: "en", dict: en }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
  notFound: () => { throw new Error("not-found"); },
}));
vi.mock("@/app/protected/messages/actions", () => ({
  startGroupThread: vi.fn(),
  startGroupThreadDraft: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async () => {
      s.contactsRead();
      return {
        data: s.contactEligible
          ? [{ member_id: s.recipient, display_name: "Synthetic neighbor" }]
          : [],
      };
    },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        maybeSingle: async () => {
          if (table === "groups") return {
            data: s.groupVisible ? { id: "group", name: "Synthetic group" } : null,
          };
          s.filters = filters;
          return {
            data: s.threads.find(thread =>
              thread.member_a === filters.member_a &&
              thread.member_b === filters.member_b
            ) ?? null,
            error: s.lookupError ? { message: "Synthetic read failure" } : null,
          };
        },
      };
      return query;
    },
  }),
}));

import Page from "@/app/protected/groups/[slug]/message/[member]/page";

async function render() {
  const shell = Page({
    params: Promise.resolve({ slug: "synthetic-group", member: s.recipient }),
    searchParams: Promise.resolve({}),
  }) as ReactElement<{ children: ReactElement }>;
  const content = shell.props.children as ReactElement<Record<string, unknown>>;
  return renderToStaticMarkup(await (
    content.type as (props: Record<string, unknown>) => Promise<ReactNode>
  )(content.props));
}

beforeEach(() => {
  Object.assign(s, {
    uid: "00000000-0000-0000-0000-000000000002",
    groupVisible: true,
    contactEligible: true,
    lookupError: false,
    threads: [],
    filters: {},
  });
  s.contactsRead.mockClear();
});

describe("group contact conversation reuse", () => {
  it.each(["pending", "accepted", "declined"])(
    "reopens a %s pair even when group contact is off",
    async request_status => {
      s.contactEligible = false;
      s.threads = [{
        id: "existing-thread",
        member_a: s.recipient,
        member_b: s.uid!,
        request_status,
      }];
      await expect(render()).rejects.toThrow("redirect:/protected/messages/existing-thread");
      expect(s.contactsRead).not.toHaveBeenCalled();
      expect(s.filters).toEqual({ member_a: s.recipient, member_b: s.uid });
    },
  );

  it("renders a first-request form only for an eligible new pair", async () => {
    const html = await render();
    expect(html).toContain('id="group-message"');
    expect(html).toContain("Synthetic neighbor");
    expect(s.contactsRead).toHaveBeenCalledOnce();
  });

  it("does not use a conversation with a different member", async () => {
    s.threads = [{
      id: "unrelated-thread",
      member_a: s.recipient,
      member_b: "00000000-0000-0000-0000-000000000003",
      request_status: "accepted",
    }];
    expect(await render()).toContain('id="group-message"');
    expect(s.filters).toEqual({ member_a: s.recipient, member_b: s.uid });
  });

  it("keeps new contact unavailable without current consent", async () => {
    s.contactEligible = false;
    await expect(render()).rejects.toThrow("not-found");
  });

  it("does not offer a fresh composer when the existing-pair read fails", async () => {
    s.lookupError = true;
    await expect(render()).rejects.toThrow("Unable to load existing conversation");
    expect(s.contactsRead).not.toHaveBeenCalled();
  });

  it("still requires sign-in", async () => {
    s.uid = null;
    await expect(render()).rejects.toThrow("redirect:/auth/login");
    expect(s.filters).toEqual({});
  });

  it("still requires a visible group", async () => {
    s.groupVisible = false;
    await expect(render()).rejects.toThrow("not-found");
    expect(s.filters).toEqual({});
  });
});
