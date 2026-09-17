import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: m.rpc }),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: m.send };
  },
}));
import { deliverMemberNotices } from "@/lib/member-pipelines/server";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-only");
  vi.stubEnv("MEMBER_REVIEW_NOTIFY_TO", "reviewer@example.test");
  m.send.mockResolvedValue({ error: null });
});
function queue(kind: string) {
  m.rpc.mockImplementation(async (name) => ({
    error: null,
    data:
      name === "claim_member_notices"
        ? [
            {
              id: "notice",
              claim: "lease",
              kind,
              recipient_email: "applicant@example.test",
              locale: "en",
              reference_id: "case",
              expires_at: "2026-09-21T19:00:00Z",
            },
          ]
        : null,
  }));
}
describe("minimal durable service mail", () => {
  it("uses the actual expiry for a resend and a stable delivery key", async () => {
    queue("invitation");
    await deliverMemberNotices();
    const [mail, options] = m.send.mock.calls[0];
    expect(mail.to).toBe("applicant@example.test");
    expect(mail.text).toContain("Sep 21");
    expect(mail.text).not.toContain("within seven days");
    expect(options.idempotencyKey).toBe("steppe-member-notice-notice");
  });
  it("routes arrivals to the reviewer and decisions to the member without case content", async () => {
    queue("verification_received");
    await deliverMemberNotices();
    expect(m.send.mock.calls[0][0].to).toBe("reviewer@example.test");
    queue("verification_decided");
    await deliverMemberNotices();
    const mail = m.send.mock.calls[1][0];
    expect(mail.to).toBe("applicant@example.test");
    expect(mail.text).toContain("/protected/verify");
    expect(mail).not.toHaveProperty("member_reply");
  });
  it("keeps failed delivery pending with its lease identity", async () => {
    queue("invitation");
    m.send.mockResolvedValue({ error: { message: "unavailable" } });
    await deliverMemberNotices();
    expect(m.rpc).toHaveBeenLastCalledWith("finish_member_notice", {
      p_id: "notice",
      p_claim: "lease",
      p_sent: false,
    });
  });
});
