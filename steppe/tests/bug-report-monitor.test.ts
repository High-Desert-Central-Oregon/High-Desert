import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
import { startMaintenanceCheckIn } from "@/lib/bug-reports/monitor";
import { GET } from "@/app/api/support/maintenance/route";

const monitorUrl = "https://o123.ingest.us.sentry.io/api/456/cron/bug-report-maintenance/abcdef0123456789/";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SENTRY_BUG_REPORT_CRON_URL", monitorUrl);
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.stubEnv("BUG_REPORTS_ENABLED", "false");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockResolvedValue({ ok: true });
  mocks.rpc.mockResolvedValue({ error: null });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("maintenance monitor", () => {
  it("pairs run status using one ID and sends no request or report details", async () => {
    const response = await GET(new Request("https://example.test/api/support/maintenance?private=secret", {
      headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(200);
    const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls.map(url => url.searchParams.get("status"))).toEqual(["in_progress", "ok"]);
    expect(urls[0].searchParams.get("check_in_id")).toBe(urls[1].searchParams.get("check_in_id"));
    expect([...urls[0].searchParams.keys()].sort()).toEqual(["check_in_id", "environment", "status"]);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("secret");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error" });
  });
  it("sends a generic error status when maintenance fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "private database details" } });
    expect((await GET(new Request("https://example.test/api/support/maintenance", {
      headers: { authorization: "Bearer test-secret" },
    }))).status).toBe(503);
    expect(fetchMock.mock.calls.map(([url]) => url.searchParams.get("status")))
      .toEqual(["in_progress", "error"]);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("database");
  });
  it("never sends check-ins for unauthorized calls", async () => {
    expect((await GET(new Request("https://example.test/api/support/maintenance"))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["preview", "development", ""])("does not monitor %s deployments", async value => {
    vi.stubEnv("VERCEL_ENV", value);
    expect(await startMaintenanceCheckIn()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("remains optional until configured", async () => {
    vi.stubEnv("SENTRY_BUG_REPORT_CRON_URL", "");
    expect(await startMaintenanceCheckIn()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["https://example.test/", "http://o123.ingest.sentry.io/api/456/cron/job/abcd/"])(
    "rejects an invalid destination without sending data: %s", async value => {
      vi.stubEnv("SENTRY_BUG_REPORT_CRON_URL", value);
      await startMaintenanceCheckIn();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each(["network", "rejected"])("still runs maintenance after a %s check-in failure", async failure => {
    if (failure === "network") fetchMock.mockRejectedValue(new Error("private connection details"));
    else fetchMock.mockResolvedValue({ ok: false });
    const response = await GET(new Request("https://example.test/api/support/maintenance", {
      headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("purge_expired_bug_reports");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith("Bug-report maintenance monitor check-in failed");
  });
});
