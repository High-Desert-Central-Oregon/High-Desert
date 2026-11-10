import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: m.rpc,
    storage: { from: () => ({ remove: m.remove }) },
  }),
}));
import { cleanupOrphanEvidence } from "@/lib/member-pipelines/evidence-cleanup";
beforeEach(() => {
  vi.resetAllMocks();
  m.remove.mockResolvedValue({ error: null });
  m.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "claim_orphan_evidence_cleanup"
        ? [{ path: "self/orphan.pdf", claim: "lease" }]
        : name === "orphan_evidence_cleanup_pending"
          ? false
          : null,
    error: null,
  }));
});
describe("orphan evidence worker", () => {
  it("acknowledges Storage API removal rather than deleting metadata directly", async () => {
    expect(await cleanupOrphanEvidence()).toBe(true);
    expect(m.remove).toHaveBeenCalledWith(["self/orphan.pdf"]);
    expect(m.rpc).toHaveBeenCalledWith("finish_orphan_evidence_cleanup", {
      p_path: "self/orphan.pdf",
      p_claim: "lease",
      p_success: true,
    });
  });
  it.each(["returned", "thrown"])(
    "retains %s Storage failures for retry",
    async (kind) => {
      if (kind === "returned")
        m.remove.mockResolvedValue({ error: { message: "failure" } });
      else m.remove.mockRejectedValue(new Error("failure"));
      expect(await cleanupOrphanEvidence()).toBe(false);
      expect(m.rpc).toHaveBeenCalledWith("finish_orphan_evidence_cleanup", {
        p_path: "self/orphan.pdf",
        p_claim: "lease",
        p_success: false,
      });
    },
  );
  it("reports unfinished or unacknowledged work as unhealthy", async () => {
    m.rpc.mockImplementation(async (name: string) => ({
      data: name === "claim_orphan_evidence_cleanup" ? [] : true,
      error: null,
    }));
    expect(await cleanupOrphanEvidence()).toBe(false);
  });
});
