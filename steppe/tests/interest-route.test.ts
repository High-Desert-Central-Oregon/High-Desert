import { describe, it, expect, vi, beforeEach } from "vitest";

// Smoke test for the Gate 0 interest funnel: POST /api/interest. Hermetic — the
// route's three collaborators (the service-role DB client, the confirmation
// sender, and the i18n translator) are mocked, so this runs anywhere with no DB
// or network. It pins the contract the launch depends on: what writes a row, what
// sends a confirmation, and — critically — what must NEVER do either.

const mocks = vi.hoisted(() => {
  // Mutable result the fake upsert resolves to; flipped per test.
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
// Return the message key (and interpolate {name}) so the assembled body is stable.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${vars.name ?? ""}` : key,
}));
// Keep NextResponse.json working as a plain web Response outside the Next runtime.
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

describe("POST /api/interest — Gate 0 funnel", () => {
  it("accepts a valid new signup: normalizes input, writes the row, sends ONE confirmation", async () => {
    const res = await POST(
      post({ email: "Neighbor@Example.com ", first_name: "  Ada ", in_area: true, consent: true }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    // Email lowercased + trimmed; on-conflict-do-nothing on email.
    expect(mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "neighbor@example.com",
        first_name: "Ada",
        in_area: true,
        consent: true,
      }),
      expect.objectContaining({ onConflict: "email", ignoreDuplicates: true }),
    );
    // Confirmation sent to the normalized address, exactly once.
    expect(mocks.sendInterestConfirmation).toHaveBeenCalledTimes(1);
    expect(mocks.sendInterestConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: "neighbor@example.com" }),
    );
  });

  it("does NOT re-confirm a duplicate — no second email", async () => {
    mocks.state.data = []; // on-conflict-do-nothing returns no row
    const res = await POST(post({ email: "dupe@example.com", consent: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(mocks.sendInterestConfirmation).not.toHaveBeenCalled();
  });

  it("drops a honeypot submission silently: no DB write, no email", async () => {
    const res = await POST(post({ email: "bot@example.com", consent: true, company: "Acme" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.fromMock).not.toHaveBeenCalled();
    expect(mocks.sendInterestConfirmation).not.toHaveBeenCalled();
  });

  it("rejects an invalid email with 400 and writes nothing", async () => {
    const res = await POST(post({ email: "not-an-email", consent: true }));
    expect(res.status).toBe(400);
    expect(mocks.fromMock).not.toHaveBeenCalled();
    expect(mocks.sendInterestConfirmation).not.toHaveBeenCalled();
  });

  it("requires explicit consent (400)", async () => {
    const res = await POST(post({ email: "x@example.com", consent: false }));
    expect(res.status).toBe(400);
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it("a throwing confirmation sender can NEVER fail a signup that's already written", async () => {
    mocks.sendInterestConfirmation.mockRejectedValueOnce(new Error("provider down"));
    const res = await POST(post({ email: "resilient@example.com", consent: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("a DB error surfaces as 500 and sends no email", async () => {
    mocks.state.error = { message: "db down" };
    const res = await POST(post({ email: "y@example.com", consent: true }));
    expect(res.status).toBe(500);
    expect(mocks.sendInterestConfirmation).not.toHaveBeenCalled();
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(post("{not valid json"));
    expect(res.status).toBe(400);
  });
});
