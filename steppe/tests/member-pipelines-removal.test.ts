import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  rpc: vi.fn(),
  remove: vi.fn(),
  getUserById: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: fake.rpc,
    storage: { from: () => ({ remove: fake.remove }) },
    auth: { admin: fake },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/member-pipelines/server", () => ({
  pipelinesEnabled: () => true,
}));
import { completeAccountRemoval } from "@/lib/member-pipelines/removal";
const job = {
  id: "job",
  target_id: "member",
  pending_email: "member@example.test",
  completed_at: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  fake.remove.mockResolvedValue({ error: null });
  fake.getUserById.mockResolvedValue({
    data: { user: { id: "member" } },
    error: null,
  });
  fake.deleteUser.mockResolvedValue({ error: null });
});
describe("account removal external cleanup", () => {
  it("deletes evidence before soft-deleting Auth and acknowledging completion", async () => {
    fake.rpc
      .mockResolvedValueOnce({
        data: [{ name: "member/nested/file.pdf" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ error: null });
    expect(await completeAccountRemoval(job)).toBe(true);
    expect(fake.remove).toHaveBeenCalledWith(["member/nested/file.pdf"]);
    expect(fake.deleteUser).toHaveBeenCalledWith("member", true);
    expect(fake.remove.mock.invocationCallOrder[0]).toBeLessThan(
      fake.deleteUser.mock.invocationCallOrder[0],
    );
    expect(fake.rpc).toHaveBeenLastCalledWith("finish_account_removal", {
      p_id: "job",
    });
  });
  it("leaves cleanup pending on a Storage failure", async () => {
    fake.rpc.mockResolvedValue({
      data: [{ name: "member/file.pdf" }],
      error: null,
    });
    fake.remove.mockResolvedValue({ error: { message: "unavailable" } });
    expect(await completeAccountRemoval(job)).toBe(false);
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });
  it("leaves cleanup pending on an Auth failure", async () => {
    fake.rpc.mockResolvedValue({ data: [], error: null });
    fake.deleteUser.mockResolvedValue({ error: { message: "unavailable" } });
    expect(await completeAccountRemoval(job)).toBe(false);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });
  it("retries safely after Auth succeeded but the completion acknowledgement failed", async () => {
    fake.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ error: null });
    fake.getUserById.mockResolvedValue({
      data: { user: { id: "member", deleted_at: "2026-01-01" } },
      error: null,
    });
    expect(await completeAccountRemoval(job)).toBe(true);
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });
  it("rejects paths outside the confirmed account and bounds batches", async () => {
    fake.rpc.mockResolvedValueOnce({
      data: [{ name: "someone-else/file.pdf" }],
      error: null,
    });
    expect(await completeAccountRemoval(job)).toBe(false);
    expect(fake.remove).not.toHaveBeenCalled();
    fake.rpc.mockResolvedValue({
      data: [{ name: "member/file.pdf" }],
      error: null,
    });
    expect(await completeAccountRemoval(job)).toBe(false);
    expect(fake.remove).toHaveBeenCalledTimes(5);
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });
});
