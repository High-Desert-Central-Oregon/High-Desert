import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Contract test for POST /api/invite/redeem.
 *
 * Hermetic: the database call is mocked, so it runs with no DB and no network.
 * `lib/rate-limit` and the token/email normalizers are the REAL ones — the
 * limiter and the shape checks are exactly what this route exists to enforce, and
 * mocking them would only test the mock.
 *
 * What it pins is the stuff a leak or an oracle would travel through:
 *   · every token failure returns the SAME code, and never a reason
 *   · the honeypot is checked BEFORE the limiter, so a bot cannot burn a shared
 *     NAT's budget and lock out the real neighbours behind it
 *   · the limiter is keyed on the connection, NOT on the token — keying per
 *     token would hand an attacker a fresh budget for every guess
 *   · success says only `{ ok: true }`: no token, no email, no row, no count
 *   · this route never sends mail and never signs anyone in
 */

const mocks = vi.hoisted(() => ({
  redeemInvite: vi.fn(),
}));

// Only the DB-touching function is mocked. normalizeToken / normalizeInviteEmail
// are the real implementations — they are part of the contract under test.
vi.mock("@/lib/invite", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invite")>(
    "@/lib/invite",
  );
  return { ...actual, redeemInvite: mocks.redeemInvite };
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
}));

const { POST } = await import("@/app/api/invite/redeem/route");

const VALID_TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

/** One request. A distinct IP per test keeps the real limiter's state honest. */
function post(body: unknown, ip = "10.0.0.1") {
  return POST(
    new Request("https://www.steppe.community/api/invite/redeem", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

async function json(res: Response) {
  return (await res.json()) as { ok?: boolean; error?: string };
}

describe("POST /api/invite/redeem", () => {
  beforeEach(() => {
    mocks.redeemInvite.mockReset();
    mocks.redeemInvite.mockResolvedValue(true);
  });

  it("redeems a valid token and says nothing else", async () => {
    const res = await post(
      { token: VALID_TOKEN, email: "neighbor@example.com" },
      "10.1.0.1",
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    // Exactly one key. No token echo, no email, no count, no row.
    expect(body).toEqual({ ok: true });
    expect(mocks.redeemInvite).toHaveBeenCalledWith(
      VALID_TOKEN,
      "neighbor@example.com",
    );
  });

  it("normalizes a token that was retyped from a card, and the address with it", async () => {
    const res = await post(
      { token: `  ${VALID_TOKEN.toUpperCase()} `, email: "  Neighbor@Example.COM " },
      "10.1.0.2",
    );
    expect(res.status).toBe(200);
    // Lowered and trimmed on the way in, so casing cannot make a second person.
    expect(mocks.redeemInvite).toHaveBeenCalledWith(
      VALID_TOKEN,
      "neighbor@example.com",
    );
  });

  it("gives ONE answer to every token failure — no oracle", async () => {
    // Whatever the real reason (unknown / expired / exhausted / revoked), the DB
    // returns false and the route must not elaborate.
    mocks.redeemInvite.mockResolvedValue(false);

    const cases: Array<[string, unknown]> = [
      ["refused by the database", { token: VALID_TOKEN, email: "a@b.co" }],
      ["malformed token", { token: "not-a-token", email: "a@b.co" }],
      ["token of the wrong length", { token: "a1b2c3", email: "a@b.co" }],
      ["non-hex token", { token: "z".repeat(32), email: "a@b.co" }],
      ["malformed address", { token: VALID_TOKEN, email: "nope" }],
      ["missing both", {}],
    ];

    const answers = new Set<string>();
    let i = 0;
    for (const [name, body] of cases) {
      const res = await post(body, `10.2.0.${++i}`);
      const parsed = await json(res);
      expect(parsed.ok, name).toBeFalsy();
      answers.add(`${res.status}:${parsed.error}`);
    }
    // The whole point: one distinguishable answer across every failure mode.
    expect(answers).toEqual(new Set(["400:refused"]));
  });

  it("returns the same refusal for unparseable JSON", async () => {
    const res = await POST(
      new Request("https://www.steppe.community/api/invite/redeem", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.3.0.1" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe("refused");
  });

  it("checks the honeypot BEFORE the rate limiter, and tells the bot nothing", async () => {
    const ip = "10.4.0.1";
    // Twenty filled-honeypot posts — well past the limit of 5.
    for (let n = 0; n < 20; n++) {
      const res = await post(
        { token: VALID_TOKEN, email: "bot@example.com", company: "Acme" },
        ip,
      );
      expect(res.status).toBe(400);
      // Same refusal as a bad code: never "caught you".
      expect((await json(res)).error).toBe("refused");
    }
    // Nothing was redeemed...
    expect(mocks.redeemInvite).not.toHaveBeenCalled();
    // ...and the real neighbour behind the same NAT still gets through, because
    // the honeypot returned before the limiter counted anything.
    const good = await post({ token: VALID_TOKEN, email: "real@example.com" }, ip);
    expect(good.status).toBe(200);
    expect(await json(good)).toEqual({ ok: true });
  });

  it("rate-limits the CONNECTION, not the token — a new code buys no new budget", async () => {
    const ip = "10.5.0.1";
    mocks.redeemInvite.mockResolvedValue(false);

    // Five attempts are allowed; each one uses a DIFFERENT token, which is what
    // an enumeration attempt looks like.
    for (let n = 0; n < 5; n++) {
      const res = await post(
        { token: `${"0".repeat(31)}${n}`, email: "probe@example.com" },
        ip,
      );
      expect(res.status).toBe(400);
    }
    // The sixth is refused for the connection even though the token is brand new.
    const res = await post(
      { token: VALID_TOKEN, email: "probe@example.com" },
      ip,
    );
    expect(res.status).toBe(429);
    expect((await json(res)).error).toBe("rate_limited");
  });

  it("a rate limit on one connection does not spend another's budget", async () => {
    const ip = "10.6.0.1";
    for (let n = 0; n < 6; n++) {
      await post({ token: VALID_TOKEN, email: "x@example.com" }, ip);
    }
    const other = await post(
      { token: VALID_TOKEN, email: "y@example.com" },
      "10.6.0.2",
    );
    expect(other.status).toBe(200);
  });

  it("never sends mail and never signs anyone in", async () => {
    // The route module must not reach for the mailer or the auth actions at all —
    // redemption is a WRITE to the allowlist and nothing more. The handoff to the
    // OTP path is the client's next call, deliberately.
    const raw = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../app/api/invite/redeem/route.ts", import.meta.url),
        "utf8",
      ),
    );
    // Comments STRIPPED first. The route's own prose explains that the client
    // calls requestSignInLink next, and a grep over prose would fail on the
    // explanation rather than on the behaviour — a test that reads documentation
    // as code is not testing anything.
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/pledge-email|sendPledgeConfirmation|resend/i);
    expect(code).not.toMatch(/signInWithOtp|requestSignInLink|verifyOtp/);
    // And the only module it reaches for are the two it should.
    const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual([
      "@/lib/invite",
      "@/lib/rate-limit",
      "next/server",
    ]);
  });
});
