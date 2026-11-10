import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  complete: vi.fn(),
  signOut: vi.fn(),
  claims: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: m.rpc,
    auth: { getClaims: m.claims, signOut: m.signOut },
  }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/member-pipelines/removal", () => ({
  completeAccountRemoval: m.complete,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { deleteMyAccount } from "@/app/protected/account/actions";
beforeEach(() => {
  vi.resetAllMocks();
  m.claims.mockResolvedValue({
    data: { claims: { sub: "self" } },
    error: null,
  });
  m.rpc.mockImplementation(async (name: string) => ({
    error: null,
    data:
      name === "my_account_removal"
        ? [
            {
              id: "job",
              target_id: "self",
              pending_email: "synthetic@example.test",
              completed_at: null,
            },
          ]
        : null,
  }));
  m.complete.mockResolvedValue(true);
  m.signOut.mockResolvedValue({ error: null });
});
describe("self-removal action", () => {
  it("completes an authorized self job before farewell", async () => {
    await expect(deleteMyAccount()).rejects.toThrow("redirect:/?farewell=1");
    expect(m.complete).toHaveBeenCalledOnce();
    expect(m.signOut).toHaveBeenCalledOnce();
  });
  it.each([false, "throw"])(
    "keeps failed cleanup visible and retryable: %s",
    async (value) => {
      if (value === "throw")
        m.complete.mockRejectedValue(new Error("private provider error"));
      else m.complete.mockResolvedValue(false);
      expect(await deleteMyAccount()).toEqual({ error: "cleanup-pending" });
      expect(m.signOut).not.toHaveBeenCalled();
    },
  );
  it("never delegates an unbound or failed job read to the admin helper", async () => {
    m.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ data: [{ target_id: "other" }], error: null });
    expect(await deleteMyAccount()).toEqual({ error: "cleanup-pending" });
    expect(m.complete).not.toHaveBeenCalled();
  });
});
