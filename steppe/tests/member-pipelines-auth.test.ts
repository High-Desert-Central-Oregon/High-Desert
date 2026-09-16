import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  get: vi.fn(),
  delete: vi.fn(),
  exchange: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: m.get, delete: m.delete }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: m.exchange, signOut: m.signOut },
  }),
}));
import { GET } from "@/app/auth/callback/route";
const request = () =>
  new Request("https://steppe.example/auth/callback?code=fixture");
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MEMBER_PIPELINES_ENABLED", "true");
  m.get.mockReturnValue({
    value: JSON.stringify({
      returnTo: "/protected/account/sign-in-methods",
      expectedUser: "original-member",
    }),
  });
  m.exchange.mockResolvedValue({
    data: { user: { id: "original-member" } },
    error: null,
  });
});
describe("provider callback", () => {
  it("rejects callbacks without the initiating browser cookie", async () => {
    m.get.mockReturnValue(undefined);
    expect((await GET(request())).headers.get("location")).toContain(
      "issue=provider",
    );
    expect(m.exchange).not.toHaveBeenCalled();
  });
  it("rejects a different account during manual linking", async () => {
    m.exchange.mockResolvedValue({
      data: { user: { id: "different-member" } },
      error: null,
    });
    expect((await GET(request())).headers.get("location")).toContain(
      "issue=provider",
    );
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("returns the same linked member to their sign-in settings", async () => {
    expect((await GET(request())).headers.get("location")).toBe(
      "https://steppe.example/protected/account/sign-in-methods",
    );
    expect(m.delete).toHaveBeenCalledWith("steppe-auth-intent");
  });
  it("does not follow a supplied external return URL", async () => {
    m.get.mockReturnValue({
      value: JSON.stringify({ returnTo: "https://elsewhere.example" }),
    });
    expect((await GET(request())).headers.get("location")).toBe(
      "https://steppe.example/protected",
    );
  });
  it("rejects a malformed initiation cookie", async () => {
    m.get.mockReturnValue({ value: "null" });
    expect((await GET(request())).headers.get("location")).toContain(
      "issue=provider",
    );
    expect(m.exchange).not.toHaveBeenCalled();
  });
  it("keeps the disabled provider rollout closed", async () => {
    vi.stubEnv("MEMBER_PIPELINES_ENABLED", "false");
    await GET(request());
    expect(m.exchange).not.toHaveBeenCalled();
  });
});
