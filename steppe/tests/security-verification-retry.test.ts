import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  remove: vi.fn(),
  claims: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: m.rpc, auth: { getClaims: m.claims } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ remove: m.remove }) },
  }),
}));
vi.mock("@/lib/member-pipelines/server", () => ({
  pipelinesEnabled: () => false,
  deliverMemberNotices: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
import { prepareVerificationUpload } from "@/app/protected/verify/actions";
beforeEach(() => {
  vi.resetAllMocks();
  m.claims.mockResolvedValue({ data: { claims: { sub: "self" } } });
  m.remove.mockResolvedValue({ error: null });
  m.rpc
    .mockResolvedValueOnce({ data: "self/old.pdf", error: null })
    .mockResolvedValueOnce({ data: "self/new.pdf", error: null });
});
describe("retrying an abandoned verification upload", () => {
  it("revokes and removes the old file before reserving a replacement", async () => {
    expect(await prepareVerificationUpload("pdf")).toEqual({
      data: "self/new.pdf",
      error: false,
    });
    expect(m.remove).toHaveBeenCalledWith(["self/old.pdf"]);
    expect(m.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      m.remove.mock.invocationCallOrder[0],
    );
    expect(m.remove.mock.invocationCallOrder[0]).toBeLessThan(
      m.rpc.mock.invocationCallOrder[1],
    );
  });
  it("does not hide Storage errors or reserve another object", async () => {
    m.remove.mockResolvedValue({ error: { message: "unavailable" } });
    expect(await prepareVerificationUpload("pdf")).toEqual({
      data: null,
      error: true,
    });
    expect(m.rpc).toHaveBeenCalledOnce();
  });
  it("refuses untrusted paths and pending-request releases", async () => {
    m.rpc
      .mockReset()
      .mockResolvedValue({ data: "other/private.pdf", error: null });
    expect((await prepareVerificationUpload("pdf")).error).toBe(true);
    expect(m.remove).not.toHaveBeenCalled();
    m.rpc.mockResolvedValue({ error: { message: "request pending" } });
    expect((await prepareVerificationUpload("pdf")).error).toBe(true);
    expect(m.remove).not.toHaveBeenCalled();
  });
});
