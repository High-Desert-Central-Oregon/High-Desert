import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), health: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ gte: () => ({
      gt: () => ({ or: mocks.health }),
    }) }) }) }),
  }),
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
  vi.stubEnv("CRON_SECRET", "");
  vi.stubEnv("BUG_REPORTS_ENABLED", "true");
  vi.stubEnv("SENTRY_BUG_REPORT_CRON_URL", "");
  mocks.health.mockResolvedValue({ count: 0, error: null });
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
    expect(await deliverBugReportNotifications()).toEqual({ attempted: 1, sent: 0, failed: 1 });
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
  it("accepts Vercel's cron token and runs cleanup before notification retry", async () => {
    vi.stubEnv("CRON_SECRET", "vercel-test-secret");
    const response = await GET(
      new Request("https://example.test/api/support/maintenance", {
        headers: { authorization: "Bearer vercel-test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "purge_expired_bug_reports");
    expect(mocks.send).toHaveBeenCalledOnce();
  });
  it.each(["Bearer test-secret", "Bearer wrong-token"])(
    "rejects an obsolete or wrong token when Vercel cron is configured: %s",
    async (authorization) => {
      vi.stubEnv("CRON_SECRET", "vercel-test-secret");
      const response = await GET(
        new Request("https://example.test/api/support/maintenance", {
          headers: { authorization },
        }),
      );
      expect(response.status).toBe(401);
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("fails closed without either secret", async () => {
    vi.stubEnv("BUG_REPORT_MAINTENANCE_SECRET", "");
    const response = await GET(
      new Request("https://example.test/api/support/maintenance", {
        headers: { authorization: "Bearer undefined" },
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns a visible failure and skips mail when cleanup fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    const response = await GET(
      new Request("https://example.test/api/support/maintenance", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reports failed email delivery as unhealthy without losing the saved retry", async () => {
    mocks.send.mockRejectedValue(new Error("private provider failure"));
    const response = await GET(new Request("https://example.test/api/support/maintenance", {
      headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_bug_report_notification", {
      p_id: "test-case", p_claim: "lease", p_sent: false,
    });
  });
  it("does not recover while unexpired deliveries have exhausted their retry budget", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.health.mockResolvedValue({ count: 1, error: null });
    const response = await GET(new Request("https://example.test/api/support/maintenance", {
      headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(503);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reports an unavailable queue-health query as unhealthy", async () => {
    mocks.health.mockResolvedValue({ count: null, error: { message: "unavailable" } });
    const response = await GET(new Request("https://example.test/api/support/maintenance", {
      headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(503);
  });
});
