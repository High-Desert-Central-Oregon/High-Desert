import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  canRemove: vi.fn(),
  cleanup: vi.fn(),
  rpc: vi.fn(),
  read: vi.fn(),
  create: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/member-pipelines/removal", () => ({
  canRemoveAccounts: fake.canRemove,
  completeAccountRemoval: fake.cleanup,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: fake.create }));
import {
  previewRemoval,
  removeAccount,
  retryRemoval,
} from "@/app/protected/people/remove/actions";
const id = "11111111-1111-4111-8111-111111111111";
const input = {
  target: id,
  confirmation: "member@example.test",
  reason: "test_reset",
  acknowledged: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  fake.canRemove.mockResolvedValue(true);
  fake.create.mockResolvedValue({
    rpc: fake.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: fake.read }) }),
    }),
  });
});
describe("removal server action boundary", () => {
  it("never obtains a privileged cleanup client for an unauthorized caller", async () => {
    fake.canRemove.mockResolvedValue(false);
    expect(await previewRemoval(input.confirmation)).toEqual({ ok: false });
    expect(await removeAccount(input)).toEqual({ state: "failed" });
    expect(await retryRemoval(id)).toEqual({ state: "failed" });
    expect(fake.create).not.toHaveBeenCalled();
    expect(fake.cleanup).not.toHaveBeenCalled();
  });
  it("requires confirmation and a valid reason on the server", async () => {
    for (const invalid of [
      { acknowledged: false },
      { reason: "other" },
      { confirmation: "" },
      { target: "bad-id" },
    ])
      expect(await removeAccount({ ...input, ...invalid })).toEqual({
        state: "failed",
      });
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("does not clean up a job the caller cannot read through RLS", async () => {
    fake.read.mockResolvedValue({ data: null, error: null });
    expect(await retryRemoval(id)).toEqual({ state: "failed" });
    expect(fake.cleanup).not.toHaveBeenCalled();
  });
  it("reports durable pending cleanup when an external service throws", async () => {
    fake.rpc.mockResolvedValue({ data: id, error: null });
    const job = {
      id,
      target_id: id,
      pending_email: input.confirmation,
      completed_at: null,
    };
    fake.read.mockResolvedValue({ data: job, error: null });
    fake.cleanup.mockRejectedValue(new Error("service unavailable"));
    expect(await removeAccount(input)).toEqual({ state: "pending" });
    expect(fake.cleanup).toHaveBeenCalledWith(job);
  });
});
