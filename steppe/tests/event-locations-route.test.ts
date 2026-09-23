import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  profile: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getMyProfile: m.profile }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: m.from }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimited: m.limit }));
import { POST } from "@/app/api/event-locations/route";
const request = (q: unknown) =>
  new Request("http://localhost/api/event-locations", {
    method: "POST",
    body: JSON.stringify({ q }),
  });
const fetcher = vi.fn();
let moderationFails = false;
beforeEach(() => {
  vi.clearAllMocks();
  moderationFails = false;
  m.profile.mockResolvedValue({ id: "member", verified: true });
  m.limit.mockReturnValue(false);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue({
    ok: true,
    json: async () => ({
      features: [
        {
          properties: {
            name: "Public Park",
            street: "Main Street",
            city: "Redmond",
          },
        },
      ],
    }),
  });
  m.from.mockImplementation((table) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "ilike", "eq", "order", "limit"])
      chain[method] = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) =>
      resolve(
        table === "events"
          ? {
              data: [
                { id: "visible", location: "Prior Park, 20 Main Street" },
                { id: "removed", location: "Hidden location" },
              ],
            }
          : {
              data: [{ target_id: "removed" }],
              error: moderationFails ? {} : null,
            },
      );
    return chain;
  });
});
afterEach(() => vi.unstubAllGlobals());
it("rejects unauthenticated and unverified queries before provider or database access", async () => {
  for (const profile of [null, { id: "member", verified: false }]) {
    m.profile.mockResolvedValue(profile);
    expect((await POST(request("park"))).status).toBe(403);
  }
  expect(fetcher).not.toHaveBeenCalled();
  expect(m.from).not.toHaveBeenCalled();
});
it("merges visible prior venues with named public locations and disables caching", async () => {
  const response = await POST(request("park"));
  const body = await response.json();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(body.suggestions.map((v: { name: string }) => v.name)).toEqual([
    "Prior Park, 20 Main Street",
    "Public Park",
  ]);
  const [url, options] = fetcher.mock.calls[0];
  expect(url.searchParams.get("q")).toBe("park");
  expect(url.toString()).not.toContain("member");
  expect(options.headers).toBeUndefined();
});
it("retains local suggestions when public search fails", async () => {
  fetcher.mockRejectedValue(new Error("offline"));
  const body = await (await POST(request("park"))).json();
  expect(body.unavailable).toBe(true);
  expect(body.suggestions).toHaveLength(1);
});
it("does not disclose prior venues if moderation lookup fails", async () => {
  moderationFails = true;
  const body = await (await POST(request("park"))).json();
  expect(
    body.suggestions.every((s: { source: string }) => s.source === "public"),
  ).toBe(true);
});
it("rejects invalid and rate-limited queries", async () => {
  for (const q of ["", "ab", "x".repeat(201), 42])
    expect((await POST(request(q))).status).toBe(400);
  m.limit.mockReturnValue(true);
  expect((await POST(request("park"))).status).toBe(429);
  expect(fetcher).not.toHaveBeenCalled();
});
