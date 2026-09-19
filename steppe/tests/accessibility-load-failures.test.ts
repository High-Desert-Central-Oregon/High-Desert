/**
 * Steppe — collection failure and retry regressions.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "@/lib/i18n/dictionaries/en";

const state = vi.hoisted(() => ({ fail: "", eventReads: 0 }));
vi.mock("@/lib/auth", () => ({
  getMyProfile: async () => ({ id: "synthetic", verified: true }),
}));
vi.mock("@/lib/i18n/server", () => ({
  getServerDictionary: async () => ({ locale: "en", dict: en }),
}));
vi.mock("@/app/protected/groups/actions", () => ({
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
}));
vi.mock("@/app/protected/account/calendar/actions", () => ({
  mintPersonalFeed: vi.fn(),
  removeFeed: vi.fn(),
  rotateFeed: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      const eventIndex = table === "events" ? ++state.eventReads : 0;
      const failed =
        state.fail === table || state.fail === `${table}:${eventIndex}`;
      const rows: Record<string, object[]> = {
        group_members: [
          { group_id: "sample", role: "member", status: "active" },
        ],
        event_rsvps: [{ event_id: "sample", status: "going" }],
        calendar_feeds:
          state.fail === "groups_directory"
            ? [{ id: "synthetic", group_id: "sample", token: "synthetic" }]
            : [],
      };
      const result = {
        data: failed ? null : (rows[table] ?? []),
        error: failed ? { message: "Synthetic unavailable" } : null,
      };
      const query = {
        select: () => query,
        is: () => query,
        order: () => query,
        eq: () => query,
        ilike: () => query,
        gte: () => query,
        lt: () => query,
        limit: () => query,
        in: () => query,
        returns: async () => result,
        then: (resolve: (value: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      };
      return query;
    },
  }),
}));

// Await the async server child of the page's Suspense boundary, then render the
// real result. No server action is invoked and no hosted configuration is read.
async function renderPage(kind: "groups" | "calendar") {
  const Page =
    kind === "groups"
      ? (await import("@/app/protected/groups/page")).default
      : (await import("@/app/protected/account/calendar/page")).default;
  const searchParams = Promise.resolve(
    kind === "groups"
      ? { q: "seed swap", category: "sample", s: "1" }
      : { v: "month", m: "2026-09", d: "2026-09-20" },
  );
  const shell = Page({ searchParams }) as ReactElement<{
    children: ReactElement;
  }>;
  const child = shell.props.children as ReactElement<Record<string, unknown>>;
  const content = await (
    child.type as (props: Record<string, unknown>) => Promise<ReactNode>
  )(child.props);
  return renderToStaticMarkup(content);
}

beforeEach(() => {
  state.fail = "";
  state.eventReads = 0;
});
describe("groups read failures", () => {
  it.each(["groups_directory", "group_members", "categories"])(
    "shows an error for %s without a false empty state",
    async (table) => {
      state.fail = table;
      const html = await renderPage("groups");
      expect(html).toContain('role="alert"');
      expect(html).toContain(en.common.loadFailed);
      expect(html).not.toContain(en.groups.empty);
      expect(html).not.toContain('href="/protected/groups/new"');
      expect(html).toContain(
        "/protected/groups?q=seed+swap&amp;category=sample&amp;s=1",
      );
    },
  );
  it("keeps a successful empty result distinct from an error", async () => {
    const html = await renderPage("groups");
    expect(html).toContain(en.groups.empty);
    expect(html).not.toContain(en.common.loadFailed);
  });
});
describe("calendar read failures", () => {
  it.each([
    "group_members",
    "event_rsvps",
    "events:1",
    "events:2",
    "content_moderation",
    "calendar_feeds",
    "groups_directory",
  ])("rejects incomplete results when %s fails", async (table) => {
    state.fail = table;
    const html = await renderPage("calendar");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain(en.calendar.emptyTitle);
    expect(html).not.toContain(en.calendar.createLink);
    expect(html).toContain(
      "/protected/account/calendar?v=month&amp;m=2026-09&amp;d=2026-09-20",
    );
  });
  it("renders a successful month even with no events", async () => {
    const html = await renderPage("calendar");
    expect(html).toContain("September 2026");
    expect(html).not.toContain(en.common.loadFailed);
  });
});
