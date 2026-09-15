import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
import { deliverBugReportNotifications } from "@/lib/bug-reports/server";
import { GET } from "@/app/api/support/maintenance/route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-only");
  vi.stubEnv("BUG_REPORT_NOTIFY_TO", "operator@example.test");
  vi.stubEnv("BUG_REPORT_MAINTENANCE_SECRET", "test-secret");
  vi.stubEnv("BUG_REPORTS_ENABLED", "true");
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "claim_bug_report_notifications"
        ? [{ id: "test-case", claim: "lease" }]
        : null,
    error: null,
  }));
  mocks.send.mockResolvedValue({ error: null });
});
describe("bug-report notification delivery and retention", () => {
  it("sends only a reference/link and acknowledges the claimed delivery", async () => {
    await deliverBugReportNotifications();
    expect(mocks.send).toHaveBeenCalledOnce();
    const [message, options] = mocks.send.mock.calls[0];
    expect(message.text).toContain("/protected/support/test-case");
    expect(message).not.toHaveProperty("diagnostics");
    expect(options.idempotencyKey).toBe("steppe-bug-test-case");
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "finish_bug_report_notification",
      { p_id: "test-case", p_claim: "lease", p_sent: true },
    );
  });
  it("keeps provider errors and missing configuration pending", async () => {
    mocks.send.mockResolvedValueOnce({ error: { message: "unavailable" } });
    await deliverBugReportNotifications();
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "finish_bug_report_notification",
      { p_id: "test-case", p_claim: "lease", p_sent: false },
    );
    vi.stubEnv("RESEND_API_KEY", "");
    await deliverBugReportNotifications();
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "finish_bug_report_notification",
      { p_id: "test-case", p_claim: "lease", p_sent: false },
    );
  });
  it("rejects unauthenticated maintenance without touching storage", async () => {
    expect(
      (await GET(new Request("https://example.test/api/support/maintenance")))
        .status,
    ).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("purges saved reports even when intake has been turned off", async () => {
    vi.stubEnv("BUG_REPORTS_ENABLED", "false");
    const response = await GET(
      new Request("https://example.test/api/support/maintenance", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "purge_expired_bug_reports",
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
