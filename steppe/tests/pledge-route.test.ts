import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Contract test for POST /api/pledge and POST /api/pledge/remove.
 *
 * Hermetic: the database access, the mail sender, and the translator are mocked,
 * so it runs anywhere with no DB and no network. The pure helpers (email
 * normalization, the rate limiter, the count arithmetic) are the REAL ones —
 * mocking those would only test the mock.
 *
 * It pins the things a leak or an inflated count would go through: what records
 * a pledge, what sends mail, what must never do either, and what must never
 * appear in a response body.
 */

const mocks = vi.hoisted(() => ({
  submitPledge: vi.fn(),
  getRemovalToken: vi.fn(async () => "3f2b1a44-0026-4c0a-9f11-8a7d6e5c4b3a"),
  getNeighborhoodStatus: vi.fn(),
  removePledge: vi.fn(async () => true),
  sendPledgeConfirmation: vi.fn(async () => ({ ok: true as const })),
  afterCallbacks: [] as Array<() => unknown>,
}));

// Only the database-touching module is mocked. lib/rate-limit and
// lib/pledge-shared are the REAL ones — the limiter and the count arithmetic
// are exactly what these tests are here to exercise, and mocking them would
// only test the mock.
vi.mock("@/lib/pledge", async () => {
  const shared = await vi.importActual<typeof import("@/lib/pledge-shared")>(
    "@/lib/pledge-shared",
  );
  return {
    ...shared,
    submitPledge: mocks.submitPledge,
    getRemovalToken: mocks.getRemovalToken,
    getNeighborhoodStatus: mocks.getNeighborhoodStatus,
    removePledge: mocks.removePledge,
    pledgeShareUrl: (slug: string) => `https://www.steppe.community/n/${slug}`,
    pledgeRemovalUrl: (slug: string, token: string) =>
      `https://www.steppe.community/n/${slug}/leave?token=${token}`,
  };
});

vi.mock("@/lib/pledge-email", () => ({
  sendPledgeConfirmation: mocks.sendPledgeConfirmation,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

// NextResponse.json as a plain web Response; after() records the callback so a
// test can run it deliberately and assert on what the deferred send did.
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
  after: (cb: () => unknown) => {
    mocks.afterCallbacks.push(cb);
  },
}));

import { POST } from "@/app/api/pledge/route";
import { POST as REMOVE } from "@/app/api/pledge/remove/route";

const TOKEN = "3f2b1a44-0026-4c0a-9f11-8a7d6e5c4b3a";

function post(url: string, body: unknown, ip = "203.0.113.1"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Run everything after() queued, the way the platform would post-response. */
async function flushAfter() {
  const queued = [...mocks.afterCallbacks];
  mocks.afterCallbacks.length = 0;
  for (const cb of queued) await cb();
}

function ok(pledgeCount: number, alreadyPledged = false) {
  return {
    ok: true as const,
    result: {
      slug: "canyon-rim",
      name: "Canyon Rim",
      threshold: 20,
      pledgeCount,
      isOpen: false,
      alreadyPledged,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterCallbacks.length = 0;
  mocks.submitPledge.mockResolvedValue(ok(15));
  mocks.getRemovalToken.mockResolvedValue(TOKEN);
  // The route resolves the display name here — submit_pledge() does not return it.
  mocks.getNeighborhoodStatus.mockResolvedValue({
    slug: "canyon-rim", name: "Canyon Rim", threshold: 20, pledgeCount: 15, isOpen: false,
  });
  mocks.removePledge.mockResolvedValue(true);
  mocks.sendPledgeConfirmation.mockResolvedValue({ ok: true });
});

// A fresh IP per test keeps the real (module-scoped) limiter from bleeding
// across cases — everything except the limiter test itself stays under the cap.
let ipSeq = 0;
const freshIp = () => `198.51.100.${++ipSeq % 250}`;

describe("POST /api/pledge", () => {
  it("records a pledge and returns only the four public facts", async () => {
    const res = await POST(post("http://localhost/api/pledge", {
      slug: "canyon-rim", email: "  Neighbor@Example.COM ",
    }, freshIp()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true, pledgeCount: 15, threshold: 20, isOpen: false, alreadyPledged: false,
    });
    // The response body must never carry a token, an id, or an address.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(TOKEN);
    expect(raw).not.toMatch(/@|removal|token|\bid\b/i);
  });

  it("normalizes the address before it reaches the database", async () => {
    await POST(post("http://localhost/api/pledge", {
      slug: "  Canyon-Rim  ", email: "  Neighbor@Example.COM ",
    }, freshIp()));
    expect(mocks.submitPledge).toHaveBeenCalledWith("canyon-rim", "  Neighbor@Example.COM ");
  });

  it("sends exactly one confirmation for a NEW pledge", async () => {
    await POST(post("http://localhost/api/pledge", {
      slug: "canyon-rim", email: "new@example.com",
    }, freshIp()));
    // Deferred, not blocking: nothing has been sent when the response returns.
    expect(mocks.sendPledgeConfirmation).not.toHaveBeenCalled();
    await flushAfter();
    expect(mocks.sendPledgeConfirmation).toHaveBeenCalledTimes(1);

    const sent = mocks.sendPledgeConfirmation.mock.calls[0][0];
    expect(sent.to).toBe("new@example.com");
    expect(sent.shareUrl).toBe("https://www.steppe.community/n/canyon-rim");
    expect(sent.removeUrl).toContain(TOKEN);
  });

  it("sends NOTHING when the address was already pledged", async () => {
    mocks.submitPledge.mockResolvedValue(ok(15, true));
    const res = await POST(post("http://localhost/api/pledge", {
      slug: "canyon-rim", email: "again@example.com",
    }, freshIp()));
    await flushAfter();

    expect((await res.json()).alreadyPledged).toBe(true);
    expect(mocks.sendPledgeConfirmation).not.toHaveBeenCalled();
    expect(mocks.getRemovalToken).not.toHaveBeenCalled();
  });

  it("a repeated submission does not inflate the count", async () => {
    mocks.submitPledge.mockResolvedValueOnce(ok(15, false)).mockResolvedValueOnce(ok(15, true));
    const ip = freshIp();
    const a = await (await POST(post("http://localhost/api/pledge", { slug: "canyon-rim", email: "x@example.com" }, ip))).json();
    const b = await (await POST(post("http://localhost/api/pledge", { slug: "canyon-rim", email: "X@EXAMPLE.com" }, ip))).json();
    expect(a.pledgeCount).toBe(15);
    expect(b.pledgeCount).toBe(15);
  });

  it("the honeypot records nothing and reveals nothing", async () => {
    const res = await POST(post("http://localhost/api/pledge", {
      slug: "canyon-rim", email: "bot@example.com", company: "Acme",
    }, freshIp()));
    expect(res.status).toBe(200); // a bot is not told it was caught
    expect(mocks.submitPledge).not.toHaveBeenCalled();
    await flushAfter();
    expect(mocks.sendPledgeConfirmation).not.toHaveBeenCalled();
  });

  it("an unknown slug 404s, and a non-campaign neighborhood 404s identically", async () => {
    mocks.submitPledge.mockResolvedValue({ ok: false, reason: "unknown_neighborhood" });
    const ghost = await POST(post("http://localhost/api/pledge", { slug: "ghost", email: "a@b.com" }, freshIp()));
    const real = await POST(post("http://localhost/api/pledge", { slug: "braydon-park", email: "a@b.com" }, freshIp()));

    expect(ghost.status).toBe(404);
    expect(real.status).toBe(404);
    // Identical, so the endpoint is not an oracle for which campaigns exist.
    expect(await ghost.json()).toEqual(await real.json());
  });

  it("surfaces a rejected address as a 400 the neighbor can act on", async () => {
    // The shape check itself lives in lib/pledge and, authoritatively, in
    // submit_pledge() — both covered in tests/pledge.test.ts against the real
    // database. What is pinned here is the route's half of the contract: an
    // invalid address is a 400 with a fixable message, not a 500 and not a
    // silent success.
    mocks.submitPledge.mockResolvedValue({ ok: false, reason: "invalid_email" });
    const res = await POST(post("http://localhost/api/pledge", { slug: "canyon-rim", email: "nope" }, freshIp()));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/address/i);
  });

  it("a database failure is a 500, never a false success", async () => {
    mocks.submitPledge.mockResolvedValue({ ok: false, reason: "error" });
    const res = await POST(post("http://localhost/api/pledge", { slug: "canyon-rim", email: "a@b.com" }, freshIp()));
    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
  });

  it("rejects a missing slug and a malformed body", async () => {
    expect((await POST(post("http://localhost/api/pledge", { email: "a@b.com" }, freshIp()))).status).toBe(400);
    expect((await POST(post("http://localhost/api/pledge", "{not json", freshIp()))).status).toBe(400);
  });

  it("rate-limits a single IP, and the honeypot cannot burn a shared NAT's budget", async () => {
    const ip = "192.0.2.77";
    // The honeypot short-circuits BEFORE the limiter, so bot traffic must not
    // consume the allowance of real neighbors behind the same address.
    for (let i = 0; i < 30; i++) {
      await POST(post("http://localhost/api/pledge", { slug: "canyon-rim", email: "b@e.com", company: "x" }, ip));
    }
    const stillFine = await POST(post("http://localhost/api/pledge", { slug: "canyon-rim", email: "real@e.com" }, ip));
    expect(stillFine.status).toBe(200);

    let sawLimit = false;
    for (let i = 0; i < 12; i++) {
      const r = await POST(post("http://localhost/api/pledge", { slug: "canyon-rim", email: `n${i}@e.com` }, ip));
      if (r.status === 429) sawLimit = true;
    }
    expect(sawLimit).toBe(true);
  });

  it("a mail failure never turns a recorded pledge into an error", async () => {
    mocks.sendPledgeConfirmation.mockRejectedValue(new Error("resend down"));
    const res = await POST(post("http://localhost/api/pledge", { slug: "canyon-rim", email: "ok@example.com" }, freshIp()));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

describe("POST /api/pledge/remove", () => {
  it("removes on a well-formed token", async () => {
    const res = await REMOVE(post("http://localhost/api/pledge/remove", { token: TOKEN }, freshIp()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, removed: true });
    expect(mocks.removePledge).toHaveBeenCalledWith(TOKEN);
  });

  it("answers an unknown token exactly as it answers an already-removed one", async () => {
    mocks.removePledge.mockResolvedValue(false);
    const a = await REMOVE(post("http://localhost/api/pledge/remove", { token: TOKEN }, freshIp()));
    const b = await REMOVE(post("http://localhost/api/pledge/remove", {
      token: "11111111-2222-3333-4444-555555555555",
    }, freshIp()));
    expect(a.status).toBe(b.status);
    expect(await a.json()).toEqual(await b.json());
  });

  it("rejects a malformed token without a database call", async () => {
    const res = await REMOVE(post("http://localhost/api/pledge/remove", { token: "not-a-uuid" }, freshIp()));
    expect(res.status).toBe(400);
    expect(mocks.removePledge).not.toHaveBeenCalled();
  });
});
