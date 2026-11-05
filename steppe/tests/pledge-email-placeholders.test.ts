import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  send: vi.fn(),
  locale: "en",
  missing: [] as string[],
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: m.rpc }),
}));
vi.mock("@/lib/interest-email", () => ({ sendInterestConfirmation: m.send }));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale }: { locale: string }) => {
    const catalog = JSON.parse(
      readFileSync(
        new URL(`../messages/${locale}.json`, import.meta.url),
        "utf8",
      ),
    ).enrollment;
    return (key: string, vars: Record<string, string> = {}) =>
      catalog[key].replace(/\{(\w+)\}/g, (_: string, name: string) => {
        if (!(name in vars)) m.missing.push(name);
        return vars[name] ?? "";
      });
  },
}));
import { deliverPublicEnrollment } from "@/lib/public-enrollment";
beforeEach(() => {
  vi.resetAllMocks();
  m.missing = [];
  m.send.mockResolvedValue({ ok: true });
  m.rpc.mockImplementation(async (name: string) => ({
    data: name === "public_enrollment_healthy" ? true : [],
    error: null,
  }));
});
describe("localized ownership-confirmation mail", () => {
  it.each(["en", "es"])(
    "composes %s without missing variables or leaking a removal token before confirmation",
    async (locale) => {
      m.rpc.mockResolvedValueOnce({
        data: [
          {
            id: "job",
            email: "synthetic@example.test",
            purpose: "pledge",
            slug: "canyon-rim",
            locale,
            token: "a".repeat(64),
            claim: "lease",
          },
        ],
        error: null,
      });
      expect(await deliverPublicEnrollment()).toBe(true);
      expect(m.missing).toEqual([]);
      const mail = m.send.mock.calls[0][0];
      expect(mail.action.url).toBe(
        `https://www.steppe.community/enrollment/confirm?token=${"a".repeat(64)}`,
      );
      expect(mail).not.toHaveProperty("removeUrl");
      expect(mail.idempotencyKey).toBe("public-enrollment/job");
      expect(m.rpc).toHaveBeenCalledWith("finish_public_enrollment_mail", {
        p_id: "job",
        p_claim: "lease",
        p_success: true,
      });
    },
  );
  it("retains a failed provider delivery and stops the bounded batch", async () => {
    m.rpc.mockResolvedValueOnce({
      data: [
        {
          id: "job",
          email: "synthetic@example.test",
          purpose: "interest",
          locale: "en",
          token: "a".repeat(64),
          claim: "lease",
        },
      ],
      error: null,
    });
    m.send.mockResolvedValue({ ok: false });
    expect(await deliverPublicEnrollment()).toBe(false);
    expect(m.send).toHaveBeenCalledOnce();
    expect(m.rpc).toHaveBeenLastCalledWith("finish_public_enrollment_mail", {
      p_id: "job",
      p_claim: "lease",
      p_success: false,
    });
  });
  it("never sends more than five messages in one worker invocation", async () => {
    m.rpc.mockImplementation(async (name: string) => ({
      data:
        name === "claim_public_enrollment_mail"
          ? [
              {
                id: "job",
                email: "synthetic@example.test",
                purpose: "interest",
                locale: "en",
                token: "a".repeat(64),
                claim: "lease",
              },
            ]
          : true,
      error: null,
    }));
    expect(await deliverPublicEnrollment()).toBe(true);
    expect(m.send).toHaveBeenCalledTimes(5);
  });
});
