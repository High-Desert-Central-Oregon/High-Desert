import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), from: vi.fn(), rpc: vi.fn(), eq: vi.fn(), messageError: false }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
import { GET } from "@/app/protected/account/export/route";
const own = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks(); m.messageError = false; m.user.mockResolvedValue({ id: own });
  m.rpc.mockResolvedValue({ data: [], error: null });
  m.from.mockImplementation((table: string) => {
    const result = table === "messages"
      ? { data: [{ sender_id: own, body: "Synthetic authored support message" }], error: m.messageError ? { code: "42501" } : null }
      : { data: [], error: null };
    const q = {
      select: () => q,
      eq: (field: string, value: string) => { m.eq(table, field, value); return q; },
      maybeSingle: () => q,
      then: (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve),
    };
    return q;
  });
  m.client.mockResolvedValue({ from: m.from, rpc: m.rpc });
});
describe("authored support-message export", () => {
  it("pins export to the current member's authored messages", async () => {
    const r = await GET(); const payload = await r.json();
    expect(r.status).toBe(200);
    expect(m.eq).toHaveBeenCalledWith("messages", "sender_id", own);
    expect(payload.sent_messages).toEqual([{ sender_id: own, body: "Synthetic authored support message" }]);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  it("returns an unavailable response instead of silently omitting authored messages", async () => {
    m.messageError = true;
    expect((await GET()).status).toBe(503);
  });
  it("rejects unsigned callers before database reads", async () => {
    m.user.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(m.client).not.toHaveBeenCalled();
  });
});
