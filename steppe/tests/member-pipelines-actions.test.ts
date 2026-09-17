import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  remove: vi.fn(),
  moderator: vi.fn(),
  after: vi.fn(),
}));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isModerator: m.moderator }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: m.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: m.adminRpc,
    storage: { from: () => ({ remove: m.remove }) },
  }),
}));
import { completeReview } from "@/app/protected/review/workflow-actions";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MEMBER_PIPELINES_ENABLED", "true");
  m.moderator.mockResolvedValue(true);
  m.rpc.mockImplementation(async (name) => ({
    data:
      name === "begin_verification_decision"
        ? [
            {
              token: "decision",
              evidence_path: "local-fixture/file.pdf",
              completed: false,
            },
          ]
        : null,
    error: null,
  }));
  m.adminRpc.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
});
describe("verification decision recovery", () => {
  it("does not touch evidence for a non-reviewer or disabled workflow", async () => {
    m.moderator.mockResolvedValue(false);
    expect(await completeReview(id, true, "")).toEqual({ ok: false });
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("stops before confirmation and decision when storage fails", async () => {
    m.remove.mockResolvedValue({ error: new Error("unavailable") });
    expect(await completeReview(id, true, "")).toEqual({ ok: false });
    expect(m.adminRpc).not.toHaveBeenCalled();
    expect(m.rpc.mock.calls.map((c) => c[0])).toEqual([
      "begin_verification_decision",
    ]);
  });
  it("does not decide unless the database acknowledges the purge", async () => {
    m.adminRpc.mockResolvedValue({ error: new Error("unavailable") });
    expect(await completeReview(id, true, "")).toEqual({ ok: false });
    expect(m.rpc.mock.calls.map((c) => c[0])).toEqual([
      "begin_verification_decision",
    ]);
  });
  it("retries a storage-deleted case with the same recorded choice", async () => {
    m.rpc
      .mockResolvedValueOnce({
        data: [{ token: "decision", evidence_path: "local-fixture/file.pdf" }],
        error: null,
      })
      .mockResolvedValueOnce({ error: new Error("temporarily unavailable") });
    expect(await completeReview(id, true, "")).toEqual({ ok: false });
    expect(await completeReview(id, true, "")).toEqual({ ok: true });
    expect(m.adminRpc).toHaveBeenLastCalledWith("confirm_verification_purge", {
      p_id: id,
      p_token: "decision",
    });
    expect(m.rpc).toHaveBeenLastCalledWith("decide_verification", {
      p_id: id,
      p_approve: true,
    });
  });
  it("treats a committed decision with a lost response as complete", async () => {
    m.rpc.mockResolvedValueOnce({
      data: [{ token: "decision", evidence_path: null, completed: true }],
      error: null,
    });
    expect(await completeReview(id, true, "")).toEqual({ ok: true });
    expect(m.remove).not.toHaveBeenCalled();
    expect(m.adminRpc).not.toHaveBeenCalled();
  });
});
