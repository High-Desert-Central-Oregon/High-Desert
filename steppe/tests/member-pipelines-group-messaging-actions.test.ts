import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  user: vi.fn(),
  profile: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: m.user,
  getMyProfile: m.profile,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import {
  startGroupThreadDraft,
  respondToRequest,
} from "@/app/protected/messages/actions";
import {
  saveGroupContact,
  saveGroupRules,
} from "@/app/protected/account/messaging/actions";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
function data() {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    group_id: id,
    thread_id: id,
    with_id: other,
    body: " Synthetic ",
    version: "2",
    acknowledge: "on",
    allow: "on",
    response: "accept",
    rules: " Synthetic rules ",
  }))
    f.set(k, v);
  return f;
}
beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue({ id });
  m.profile.mockResolvedValue({ id, verified: true });
  m.client.mockResolvedValue({ rpc: m.rpc });
  m.rpc.mockResolvedValue({ data: id, error: null });
});
describe("group contact and request actions", () => {
  it("uses database group consent and pins only context/recipient/body, with successful navigation", async () => {
    await expect(startGroupThreadDraft(null, data())).rejects.toMatchObject({
      digest: expect.stringContaining(`/protected/messages/${id}`),
    });
    expect(m.rpc).toHaveBeenCalledWith("start_group_thread", {
      p_with: other,
      p_group: id,
      p_body: "Synthetic",
    });
  });
  it.each(["group_id", "with_id", "body"])(
    "rejects invalid %s without a database call",
    async (key) => {
      const f = data();
      f.set(key, key === "body" ? "" : "invalid");
      expect(await startGroupThreadDraft(null, f)).toEqual({
        error: "send-failed",
      });
      expect(m.client).not.toHaveBeenCalled();
    },
  );
  it("keeps generic refusal and transport errors with no redirect or revalidation", async () => {
    m.rpc.mockRejectedValue(new Error("Private details"));
    expect(await startGroupThreadDraft(null, data())).toEqual({
      error: "send-failed",
    });
    expect(m.revalidate).not.toHaveBeenCalled();
  });
  it("requires explicit acknowledgment, valid version, and verified session for preference saves", async () => {
    for (const [key, value] of [
      ["acknowledge", ""],
      ["version", "0"],
      ["version", "1.5"],
      ["group_id", "invalid"],
    ]) {
      const f = data();
      f.set(key, value);
      expect(await saveGroupContact(null, f)).toEqual({ error: "send-failed" });
    }
    expect(m.rpc).not.toHaveBeenCalled();
    m.profile.mockResolvedValue({ id, verified: false });
    expect(await saveGroupContact(null, data())).toEqual({
      error: "send-failed",
    });
  });
  it("saves exact acknowledged version and opt-in; an off choice is explicit", async () => {
    expect(await saveGroupContact(null, data())).toEqual({ saved: true });
    expect(m.rpc).toHaveBeenCalledWith("set_group_contact_preference", {
      p_group: id,
      p_version: 2,
      p_allow: true,
    });
    const f = data();
    f.delete("allow");
    await saveGroupContact(null, f);
    expect(m.rpc).toHaveBeenLastCalledWith("set_group_contact_preference", {
      p_group: id,
      p_version: 2,
      p_allow: false,
    });
  });
  it("allows turning off contact without silently acknowledging changed rules", async () => {
    const f = data();
    f.set("disable", "1");
    f.delete("acknowledge");
    f.delete("version");
    await saveGroupContact(null, f);
    expect(m.rpc).toHaveBeenCalledWith("disable_group_contact", {
      p_group: id,
    });
  });
  it("normalizes blank rules to disabled and rejects overlong rules", async () => {
    const f = data();
    f.set("rules", " ");
    await saveGroupRules(null, f);
    expect(m.rpc).toHaveBeenCalledWith("set_group_messaging_rules", {
      p_group: id,
      p_rules: null,
    });
    m.rpc.mockClear();
    f.set("rules", "x".repeat(2001));
    expect(await saveGroupRules(null, f)).toEqual({ error: "send-failed" });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each(["accept", "decline", "block"])(
    "uses recipient-only RPC for %s without a sender field",
    async (response) => {
      const f = data();
      f.set("response", response);
      f.set("sender_id", other);
      expect(await respondToRequest(null, f)).toBeNull();
      expect(m.rpc).toHaveBeenCalledWith("respond_message_request", {
        p_thread: id,
        p_response: response,
      });
    },
  );
  it("rejects forged decisions and handles failed decisions without private disclosure", async () => {
    const f = data();
    f.set("response", "accepted");
    expect(await respondToRequest(null, f)).toEqual({ error: "send-failed" });
    expect(m.rpc).not.toHaveBeenCalled();
    m.rpc.mockResolvedValue({ error: { message: "Private" } });
    expect(await respondToRequest(null, data())).toEqual({
      error: "send-failed",
    });
  });
});
