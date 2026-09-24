import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  set: vi.fn(),
  getUser: vi.fn(),
  oauth: vi.fn(),
  link: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: m.set }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: m.getUser,
      signInWithOAuth: m.oauth,
      linkIdentity: m.link,
    },
  }),
}));
import { startProvider } from "@/app/auth/provider/actions";
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MEMBER_PIPELINES_ENABLED", "true");
  vi.stubEnv("AUTH_GOOGLE_ENABLED", "true");
  vi.stubEnv("AUTH_APPLE_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://steppe.example");
  vi.stubEnv("VERCEL_ENV", "preview");
  m.getUser.mockResolvedValue({
    data: { user: { id: "existing-member" } },
    error: null,
  });
  m.link.mockResolvedValue({
    data: { url: "https://provider.example/authorize" },
    error: null,
  });
  m.oauth.mockResolvedValue({
    data: { url: "https://provider.example/authorize" },
    error: null,
  });
});
describe("provider initiation", () => {
  it.each([false, true])(
    "returns production sign-in/linking to Steppe when the site URL is missing (connect=%s)",
    async (connect) => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
      vi.stubEnv("VERCEL_URL", "high-desert-release.vercel.app");
      await expect(startProvider("google", connect)).rejects.toThrow(
        "redirect:https://provider.example/authorize",
      );
      expect(connect ? m.link : m.oauth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: "https://www.steppe.community/auth/callback" },
      });
    },
  );
  it("rejects an ephemeral production site URL but preserves an isolated preview callback", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://wrong-deployment.vercel.app");
    await expect(startProvider("google", true)).rejects.toThrow("redirect:");
    expect(m.link).toHaveBeenLastCalledWith({
      provider: "google",
      options: { redirectTo: "https://www.steppe.community/auth/callback" },
    });
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "isolated-preview.vercel.app");
    await expect(startProvider("google", false)).rejects.toThrow("redirect:");
    expect(m.oauth).toHaveBeenLastCalledWith({
      provider: "google",
      options: { redirectTo: "https://isolated-preview.vercel.app/auth/callback" },
    });
  });
  it("keeps unconfigured providers hidden at the server boundary", async () => {
    await expect(startProvider("apple", false)).rejects.toThrow(
      "issue=provider",
    );
    expect(m.oauth).not.toHaveBeenCalled();
  });
  it("uses OAuth and a fixed app callback for ordinary sign-in", async () => {
    await expect(startProvider("google", false)).rejects.toThrow(
      "redirect:https://provider.example/authorize",
    );
    expect(m.oauth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://steppe.example/auth/callback" },
    });
    expect(m.link).not.toHaveBeenCalled();
  });
  it("binds manual linking to an authenticated member", async () => {
    await expect(startProvider("google", true)).rejects.toThrow(
      "redirect:https://provider.example/authorize",
    );
    expect(m.link).toHaveBeenCalledOnce();
    expect(m.oauth).not.toHaveBeenCalled();
    expect(JSON.parse(m.set.mock.calls[0][1]).expectedUser).toBe(
      "existing-member",
    );
  });
  it("does not start linking when the session is missing", async () => {
    m.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(startProvider("google", true)).rejects.toThrow(
      "redirect:/auth/login",
    );
    expect(m.link).not.toHaveBeenCalled();
    expect(m.set).not.toHaveBeenCalled();
  });
});
