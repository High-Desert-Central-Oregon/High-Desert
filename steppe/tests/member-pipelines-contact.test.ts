import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { contactSteppeDraft, contactSteppe } from "@/app/protected/messages/actions";
const id = "11111111-1111-4111-8111-111111111111";
const failure = { error: "send-failed" };
function form(body = "  Synthetic support question  ") {
  const f = new FormData(); f.set("body", body); return f;
}
beforeEach(() => {
  vi.resetAllMocks(); m.user.mockResolvedValue({ id });
  m.rpc.mockResolvedValue({ data: id, error: null }); m.client.mockResolvedValue({ rpc: m.rpc });
});
describe("Contact Steppe action", () => {
  it("requires sign-in and preserves the auth redirect", async () => {
    m.user.mockResolvedValue(null);
    await expect(contactSteppeDraft(null, form())).rejects.toMatchObject({ digest: expect.stringContaining(";/auth/login;") });
    expect(m.client).not.toHaveBeenCalled();
  });
  it("rejects blank text before a database call", async () => {
    expect(await contactSteppeDraft(null, form(" \n "))).toEqual(failure);
    expect(m.client).not.toHaveBeenCalled();
  });
  it("ignores forged recipient, identity and post fields and caps text", async () => {
    const f = form("x".repeat(4100));
    f.set("with_id", "forged"); f.set("sender_id", "forged"); f.set("about_post", "forged");
    await expect(contactSteppeDraft(null, f)).rejects.toMatchObject({ digest: expect.stringContaining(`;/protected/messages/${id};`) });
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("start_support_thread", { p_body: "x".repeat(4000) });
  });
  it("keeps a generic error for refused and thrown submissions", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "Private route details" } });
    expect(await contactSteppeDraft(null, form())).toEqual(failure);
    m.rpc.mockRejectedValue(new TypeError("Synthetic offline failure"));
    expect(await contactSteppeDraft(null, form())).toEqual(failure);
  });
  it("fails safely for malformed results and uses a fixed no-JS failure route", async () => {
    m.rpc.mockResolvedValue({ data: "/outside", error: null });
    expect(await contactSteppeDraft(null, form())).toEqual(failure);
    const f = form(); f.set("back", "https://example.test");
    await expect(contactSteppe(f)).rejects.toMatchObject({ digest: expect.stringContaining(";/protected/messages/contact?msgErr=1;") });
  });
  it("still propagates success and refreshes the inbox", async () => {
    await expect(contactSteppeDraft(null, form())).rejects.toMatchObject({ digest: expect.stringContaining(`;/protected/messages/${id};`) });
    expect(m.rpc).toHaveBeenCalledWith("start_support_thread", { p_body: "Synthetic support question" });
    expect(m.revalidate).toHaveBeenCalledWith("/protected/messages");
  });
});
