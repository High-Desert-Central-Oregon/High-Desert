import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp: m.verify } }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { GET } from "@/app/auth/confirm/route";
import type { NextRequest } from "next/server";
beforeEach(() => { m.verify.mockReset(); m.verify.mockResolvedValue({ error: null }); });
const request = (next?: string) => {
  const url = new URL("https://steppe.community/auth/confirm?token_hash=synthetic&type=email");
  if (next !== undefined) url.searchParams.set("next", next);
  return new Request(url) as NextRequest;
};
describe("confirmation return path", () => {
  it.each(["/\\evil.example", "//evil.example", "https://evil.example", "/protected/../../evil", "/protected\\evil", "/protected/\r\nevil", "/%5cevil.example"])("rejects external or normalized escapes: %s", async (next) => {
    await expect(GET(request(next))).rejects.toThrow(/^REDIRECT:\/protected$/);
    expect(m.verify).toHaveBeenCalledOnce();
  });
  it("preserves protected nested paths and safe queries", async () => {
    await expect(GET(request("/protected/events?filter=mine"))).rejects.toThrow("REDIRECT:/protected/events?filter=mine");
  });
  it("defaults to protected", async () => { await expect(GET(request())).rejects.toThrow(/^REDIRECT:\/protected$/); });
  it("does not take the success redirect after OTP failure", async () => {
    m.verify.mockResolvedValue({ error: { message: "Expired & invalid" } });
    await expect(GET(request("/protected/account"))).rejects.toThrow("REDIRECT:/auth/error?error=Expired%20%26%20invalid");
  });
});
