import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  queue: vi.fn(),
  deliver: vi.fn(),
  removePledge: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
}));
vi.mock("@/lib/public-enrollment", () => ({
  queuePublicEnrollment: mocks.queue,
  deliverPublicEnrollment: mocks.deliver,
}));
vi.mock("@/lib/pledge", () => ({ removePledge: mocks.removePledge }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/server", async () => ({
  ...(await vi.importActual("next/server")),
  after: (cb: () => unknown) => mocks.afterCallbacks.push(cb),
}));
import { POST } from "@/app/api/pledge/route";
import { POST as REMOVE } from "@/app/api/pledge/remove/route";
const TOKEN = "3f2b1a44-0026-4c0a-9f11-8a7d6e5c4b3a";
let nextIp = 0;
const freshIp = () => `203.0.113.${++nextIp}`;
function post(url: string, body: unknown, ip = freshIp()) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterCallbacks.length = 0;
  mocks.queue.mockResolvedValue("queued");
  mocks.deliver.mockResolvedValue(true);
  mocks.removePledge.mockResolvedValue(true);
});
describe("pledge possession challenge route", () => {
  it("normalizes input and gives the same neutral response to new and repeated requests", async () => {
    for (let i = 0; i < 2; i++) {
      const r = await POST(
        post("http://localhost/api/pledge", {
          slug: " Canyon-Rim ",
          email: " Neighbor@Example.COM ",
        }),
      );
      expect(r.status).toBe(202);
      expect(await r.json()).toEqual({ ok: true });
    }
    expect(mocks.queue).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        email: "neighbor@example.com",
        slug: "canyon-rim",
        purpose: "pledge",
      }),
    );
    expect(mocks.deliver).not.toHaveBeenCalled();
    await mocks.afterCallbacks[0]();
    expect(mocks.deliver).toHaveBeenCalledOnce();
  });
  it("honeypots have the same response without database or mail work", async () => {
    const r = await POST(
      post("http://localhost/api/pledge", { company: "Bot" }),
    );
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ ok: true });
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it.each(["", "a".repeat(81), "../../protected", "bad_slug"])(
    "rejects malformed campaign %s",
    async (slug) => {
      expect(
        (
          await POST(
            post("http://localhost/api/pledge", {
              slug,
              email: "a@example.test",
            }),
          )
        ).status,
      ).toBe(400);
      expect(mocks.queue).not.toHaveBeenCalled();
    },
  );
  it("bounds actual bytes even when the length header lies", async () => {
    for (const size of [undefined, "1", "99999"]) {
      const r = post("http://localhost/api/pledge", {
        slug: "canyon-rim",
        email: "x".repeat(5000),
      });
      if (size) r.headers.set("content-length", size);
      expect((await POST(r)).status).toBe(413);
    }
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it("changing campaigns cannot reset the caller budget", async () => {
    const ip = freshIp();
    for (let i = 0; i < 60; i++)
      expect(
        (
          await POST(
            post(
              "http://localhost/api/pledge",
              { slug: `campaign-${i}`, email: "a@example.test" },
              ip,
            ),
          )
        ).status,
      ).toBe(202);
    expect(
      (
        await POST(
          post(
            "http://localhost/api/pledge",
            { slug: "another", email: "a@example.test" },
            ip,
          ),
        )
      ).status,
    ).toBe(429);
  });
  it.each([
    ["limited", 429],
    ["unknown", 404],
    ["error", 503],
  ])("surfaces %s without false enrollment", async (result, status) => {
    mocks.queue.mockResolvedValue(result);
    const r = await POST(
      post("http://localhost/api/pledge", {
        slug: "canyon-rim",
        email: "a@example.test",
      }),
    );
    expect(r.status).toBe(status);
    expect((await r.json()).ok).toBe(false);
  });
  it("rejects invalid email and malformed JSON", async () => {
    expect(
      (
        await POST(
          post("http://localhost/api/pledge", {
            slug: "canyon-rim",
            email: "bad",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await POST(post("http://localhost/api/pledge", "{bad"))).status,
    ).toBe(400);
  });
});
describe("POST /api/pledge/remove", () => {
  it("removes on a well-formed token", async () => {
    const res = await REMOVE(
      post("http://localhost/api/pledge/remove", { token: TOKEN }, freshIp()),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, removed: true });
    expect(mocks.removePledge).toHaveBeenCalledWith(TOKEN);
  });

  it("answers an unknown token exactly as it answers an already-removed one", async () => {
    mocks.removePledge.mockResolvedValue(false);
    const a = await REMOVE(
      post("http://localhost/api/pledge/remove", { token: TOKEN }, freshIp()),
    );
    const b = await REMOVE(
      post(
        "http://localhost/api/pledge/remove",
        {
          token: "11111111-2222-3333-4444-555555555555",
        },
        freshIp(),
      ),
    );
    expect(a.status).toBe(b.status);
    expect(await a.json()).toEqual(await b.json());
  });

  it("rejects a malformed token without a database call", async () => {
    const res = await REMOVE(
      post(
        "http://localhost/api/pledge/remove",
        { token: "not-a-uuid" },
        freshIp(),
      ),
    );
    expect(res.status).toBe(400);
    expect(mocks.removePledge).not.toHaveBeenCalled();
  });
});
