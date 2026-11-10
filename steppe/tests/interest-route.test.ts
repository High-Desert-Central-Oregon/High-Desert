import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  queue: vi.fn(),
  deliver: vi.fn(),
  callbacks: [] as Array<() => unknown>,
}));
vi.mock("@/lib/public-enrollment", () => ({
  queuePublicEnrollment: m.queue,
  deliverPublicEnrollment: m.deliver,
}));
vi.mock("next-intl/server", () => ({ getLocale: async () => "es" }));
vi.mock("next/server", async () => ({
  ...(await vi.importActual("next/server")),
  after: (cb: () => unknown) => m.callbacks.push(cb),
}));
import { POST } from "@/app/api/interest/route";
let nextIp = 0;
function post(body: unknown) {
  return new Request("http://localhost/api/interest", {
    method: "POST",
    headers: { "x-forwarded-for": `203.0.113.${++nextIp}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  m.callbacks.length = 0;
  m.queue.mockResolvedValue("queued");
  m.deliver.mockResolvedValue(true);
});
describe("interest ownership-confirmation intake", () => {
  it("queues a normalized request without exposing prior enrollment or claiming it is confirmed", async () => {
    for (let i = 0; i < 2; i++) {
      const r = await POST(
        post({
          email: " Neighbor@Example.COM ",
          consent: true,
          first_name: " Pat ",
          source: "bc",
        }),
      );
      expect(r.status).toBe(202);
      expect(await r.json()).toEqual({ ok: true });
    }
    expect(m.queue).toHaveBeenCalledWith(expect.any(Request), {
      email: "neighbor@example.com",
      purpose: "interest",
      slug: "",
      locale: "es",
      payload: {
        first_name: "Pat",
        source: "bc",
        consent: true,
        neighborhood: null,
        in_area: null,
      },
    });
    expect(m.deliver).not.toHaveBeenCalled();
    await m.callbacks[0]();
    expect(m.deliver).toHaveBeenCalledOnce();
  });
  it.each([
    { email: "bad", consent: true },
    { email: "a@example.test", consent: false },
    { email: "a@example.test" },
    { email: "x".repeat(321) + "@a.test", consent: true },
  ])("rejects invalid input %j", async (body) => {
    expect((await POST(post(body))).status).toBe(400);
    expect(m.queue).not.toHaveBeenCalled();
  });
  it("bounds actual bytes and malformed JSON", async () => {
    const r = post({ email: "x".repeat(5000), consent: true });
    r.headers.set("content-length", "1");
    expect((await POST(r)).status).toBe(413);
    expect((await POST(post("{bad"))).status).toBe(400);
    expect(m.queue).not.toHaveBeenCalled();
  });
  it("drops a honeypot with the same neutral response", async () => {
    const r = await POST(post({ company: "Bot" }));
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ ok: true });
    expect(m.queue).not.toHaveBeenCalled();
  });
  it.each([
    ["limited", 429],
    ["error", 503],
  ])("keeps %s visible", async (result, status) => {
    m.queue.mockResolvedValue(result);
    const r = await POST(post({ email: "a@example.test", consent: true }));
    expect(r.status).toBe(status);
    expect((await r.json()).ok).toBe(false);
  });
  it("does not change the accepted response when deferred delivery fails", async () => {
    m.deliver.mockResolvedValue(false);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(post({ email: "a@example.test", consent: true }));
    await m.callbacks[0]();
    expect(r.status).toBe(202);
    expect(log).toHaveBeenCalledWith("Public enrollment delivery pending");
    log.mockRestore();
  });
});
