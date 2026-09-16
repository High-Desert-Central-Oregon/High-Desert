import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  after: vi.fn(),
  deliver: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/bug-reports/server", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/bug-reports/server")
  >("@/lib/bug-reports/server");
  return { ...actual, deliverBugReportNotifications: mocks.deliver };
});
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
  after: mocks.after,
}));
import { POST } from "@/app/api/bug-reports/route";
const input = {
  requestKey: "11111111-1111-4111-8111-111111111111",
  description: "Something failed",
  expected: "",
  email: "",
  page: "/invite/private?code=secret",
  reporter_id: "forged",
};
function request(
  body: unknown = input,
  origin = "https://www.steppe.community",
) {
  return new Request("https://www.steppe.community/api/bug-reports", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": "192.0.2.4",
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BUG_REPORTS_ENABLED", "true");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-secret");
  vi.stubEnv("STEPPE_RELEASE_ID", "test-release");
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "test-sha");
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "server-user" } },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: "server-report", error: null });
});
describe("bug report submission", () => {
  it("binds identity/release on the server, sanitizes context, and queues email only after saving", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: "server-report" });
    const payload = mocks.rpc.mock.calls[0][1];
    expect(payload.p_reporter).toBe("server-user");
    expect(payload.p_release).toBe("test-sha");
    expect(payload.p_page).toBe("/invite/[token]");
    expect(payload.p_bucket).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(payload)).not.toContain("192.0.2.4");
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("accepts missing sessions for login problems, but does not downgrade auth outages", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: "AuthSessionMissingError" },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.rpc.mock.calls[0][1].p_reporter).toBeNull();
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: "AuthRetryableFetchError" },
    });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("never acknowledges failed storage or bypasses database rate limits", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "other" } });
    expect((await POST(request())).status).toBe(503);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001" } });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("rejects disabled intake, cross-origin submits, and oversized payloads", async () => {
    expect(
      (await POST(request(input, "https://elsewhere.example"))).status,
    ).toBe(403);
    expect(
      (await POST(request({ ...input, description: "x".repeat(65000) })))
        .status,
    ).toBe(400);
    vi.stubEnv("BUG_REPORTS_ENABLED", "false");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
