import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  operator: vi.fn(),
  rpc: vi.fn(),
  deliver: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/bug-reports/server", () => ({
  isSupportOperator: mocks.operator,
  deliverBugReportNotifications: mocks.deliver,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import {
  updateReport,
  retryReportNotification,
} from "@/app/protected/support/actions";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.operator.mockResolvedValue(true);
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.deliver.mockResolvedValue(undefined);
});
describe("support operator actions", () => {
  it("denies status changes and delivery retries to ordinary members", async () => {
    mocks.operator.mockResolvedValue(false);
    expect(await updateReport(id, "fixed", "private note")).toEqual({
      ok: false,
    });
    expect(await retryReportNotification(id)).toEqual({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("rejects malformed case updates before database writes", async () => {
    for (const args of [
      ["invalid", "fixed", ""],
      [id, "unknown", ""],
      [id, "fixed", "x".repeat(2001)],
    ])
      expect(await updateReport(...(args as [string, string, string]))).toEqual(
        { ok: false },
      );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("records the chosen status through the authenticated database function", async () => {
    expect(await updateReport(id, "reviewing", "  Investigating  ")).toEqual({
      ok: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("update_bug_report", {
      p_id: id,
      p_status: "reviewing",
      p_note: "Investigating",
    });
  });
  it("does not show a successful change after a database refusal", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "42501" } });
    expect(await updateReport(id, "fixed", "")).toEqual({ ok: false });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(await retryReportNotification(id)).toEqual({ ok: false });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("keeps a failed retry visible to the operator", async () => {
    mocks.deliver.mockRejectedValue(new Error("worker unavailable"));
    expect(await retryReportNotification(id)).toEqual({ ok: false });
    expect(mocks.rpc).toHaveBeenCalledWith("retry_bug_report_notification", {
      p_id: id,
    });
  });
});
