import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression guard for interest_signups.source (migration 0031) — per-piece
// signup tracking from printed collateral's ?r=bc|pc|bm QR param. Hermetic,
// same shape as tests/interest-route.test.ts: mocks the service-role DB
// client so this exercises the ACTUAL POST /api/interest handler (the real
// write path found in the PART 0 audit — direct service-role table write,
// not an RPC, not an anon caller) without touching a database.
//
// (a) each valid code round-trips into the upsert call
// (b) an unknown/hostile ?r= value never reaches the column — coerced to
//     'direct' server-side, which is the check that counts (the CHECK
//     constraint proved in seed/matrix-0031.sql is the backstop, not this)
// (c) no source at all → 'direct'
//
// Anon/authenticated write refusal (guard d) is proved separately in
// tests/rls-smoke.test.ts against a live database — a mocked client can't
// exercise RLS.

const mocks = vi.hoisted(() => {
  const state = {
    data: [{ id: "row-1" }] as { id: string }[] | null,
    error: null as unknown,
  };
  const selectMock = vi.fn(async () => ({ data: state.data, error: state.error }));
  const upsertMock = vi.fn(() => ({ select: selectMock }));
  const fromMock = vi.fn(() => ({ upsert: upsertMock }));
  const createAdminClient = vi.fn(() => ({ from: fromMock }));
  const sendInterestConfirmation = vi.fn(async () => ({ ok: true }));
  return { state, selectMock, upsertMock, fromMock, createAdminClient, sendInterestConfirmation };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/interest-email", () => ({
  sendInterestConfirmation: mocks.sendInterestConfirmation,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${vars.name ?? ""}` : key,
}));
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
}));

import { POST } from "@/app/api/interest/route";
import { isSignupSourceCode, SIGNUP_SOURCE_CODES } from "@/lib/signup-source";

function post(body: unknown): Request {
  return new Request("http://localhost/api/interest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.data = [{ id: "row-1" }];
  mocks.state.error = null;
});

describe("POST /api/interest — signup source (0031)", () => {
  it.each(SIGNUP_SOURCE_CODES)("(a) round-trips a valid code: %s", async (code) => {
    const res = await POST(post({ email: `neighbor-${code}@example.com`, consent: true, source: code }));
    expect(res.status).toBe(200);
    expect(mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: code }),
      expect.anything(),
    );
  });

  it("(b) coerces an unrecognized-but-plausible value to 'direct'", async () => {
    await POST(post({ email: "x@example.com", consent: true, source: "referral" }));
    expect(mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "direct" }),
      expect.anything(),
    );
  });

  it("(b) coerces a hostile ?r= payload to 'direct' — never reaches the column raw", async () => {
    const hostile = "'); drop table interest_signups; --";
    await POST(post({ email: "y@example.com", consent: true, source: hostile }));
    const [row] = mocks.upsertMock.mock.calls[0] as [{ source: string }, unknown];
    expect(row.source).toBe("direct");
    expect(row.source).not.toBe(hostile);
  });

  it("(b) coerces a non-string source (bypassing client validation entirely) to 'direct'", async () => {
    await POST(post({ email: "z@example.com", consent: true, source: { $ne: null } }));
    expect(mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "direct" }),
      expect.anything(),
    );
  });

  it("(c) no ?r= at all → 'direct'", async () => {
    await POST(post({ email: "w@example.com", consent: true }));
    expect(mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "direct" }),
      expect.anything(),
    );
  });

  it("a honeypot drop still writes nothing — no source recorded for a bot", async () => {
    await POST(post({ email: "bot@example.com", consent: true, source: "bc", company: "Acme" }));
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });
});

describe("isSignupSourceCode — client-side allowlist mirrors the server's", () => {
  it("accepts exactly the three printed codes", () => {
    for (const code of SIGNUP_SOURCE_CODES) expect(isSignupSourceCode(code)).toBe(true);
  });

  it("rejects 'direct' itself, null, empty, and hostile input", () => {
    expect(isSignupSourceCode("direct")).toBe(false);
    expect(isSignupSourceCode(null)).toBe(false);
    expect(isSignupSourceCode("")).toBe(false);
    expect(isSignupSourceCode("<script>alert(1)</script>")).toBe(false);
  });
});
