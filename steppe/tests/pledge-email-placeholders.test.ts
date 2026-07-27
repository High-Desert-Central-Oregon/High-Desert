import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Guard against the defect that shipped: a confirmation email reading
 * "is now at 1 of 20." and "The link below always shows where stands." — the
 * neighborhood name silently missing from both.
 *
 * The cause was not a typo in the copy. `submit_pledge()` returns four public
 * facts and deliberately no `name`, but the client code cast its result to the
 * wider status row, so `result.name` was `undefined`. next-intl does not
 * complain about an absent variable; it renders nothing and moves on. TypeScript
 * was satisfied because the cast asserted a field the database never sends.
 *
 * So the whole failure was invisible at both compile time and run time, and only
 * showed up in an email a real person received. These tests make it visible:
 *
 *  1. CATALOG — every {placeholder} in every pledge-email string must be one the
 *     route actually supplies. Catches a new token added to copy with no call
 *     site change.
 *  2. COMPOSITION — drive the real route with the REAL message catalogs and a
 *     strict interpolator that records any variable a message asks for and does
 *     not receive. Catches the call site failing to pass one, which is what
 *     happened.
 *
 * Both run for EN and ES, so a translation cannot drift from English either.
 */

const MESSAGES = (locale: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../messages/${locale}.json`, import.meta.url)), "utf8"),
  );

const LOCALES = ["en", "es"] as const;

/** Every {token} in a string, in order. */
function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------------------
// 1 · catalog: no string may ask for a variable the route does not supply
// ---------------------------------------------------------------------------
describe("pledge email catalog", () => {
  // Exactly what app/api/pledge/route.ts passes as `vars`.
  const SUPPLIED = new Set(["neighborhood", "count", "threshold"]);

  for (const locale of LOCALES) {
    it(`${locale}: every placeholder is one the route supplies`, () => {
      const pledgeEmail = MESSAGES(locale).pledgeEmail as Record<string, string>;
      const unknown: string[] = [];
      for (const [key, value] of Object.entries(pledgeEmail)) {
        for (const token of placeholdersIn(value)) {
          if (!SUPPLIED.has(token)) unknown.push(`${key} → {${token}}`);
        }
      }
      expect(unknown, "copy asks for variables the call site never passes").toEqual([]);
    });
  }

  it("en and es ask for the SAME placeholders in each string", () => {
    const en = MESSAGES("en").pledgeEmail as Record<string, string>;
    const es = MESSAGES("es").pledgeEmail as Record<string, string>;
    const drift: string[] = [];
    for (const key of Object.keys(en)) {
      const a = [...new Set(placeholdersIn(en[key]))].sort();
      const b = [...new Set(placeholdersIn(es[key] ?? ""))].sort();
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        drift.push(`${key}: en[${a}] vs es[${b}]`);
      }
    }
    // A translation that drops {neighborhood} produces the same silent hole in
    // Spanish that shipped in English.
    expect(drift, "en/es placeholder drift").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2 · composition: run the real route against the real catalogs
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  submitPledge: vi.fn(),
  getRemovalToken: vi.fn(),
  getNeighborhoodStatus: vi.fn(),
  sendPledgeConfirmation: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
  /** Variables a message asked for but did not receive. */
  missing: [] as string[],
  locale: "en",
}));

vi.mock("@/lib/pledge", async () => {
  const shared = await vi.importActual<typeof import("@/lib/pledge-shared")>(
    "@/lib/pledge-shared",
  );
  return {
    ...shared,
    submitPledge: mocks.submitPledge,
    getRemovalToken: mocks.getRemovalToken,
    getNeighborhoodStatus: mocks.getNeighborhoodStatus,
    pledgeShareUrl: (slug: string) => `https://www.steppe.community/n/${slug}`,
    pledgeRemovalUrl: (slug: string, token: string) =>
      `https://www.steppe.community/n/${slug}/leave?token=${token}`,
  };
});

vi.mock("@/lib/pledge-email", () => ({
  sendPledgeConfirmation: mocks.sendPledgeConfirmation,
}));

// The REAL catalogs, with a STRICTER interpolator than production's. next-intl
// renders an absent variable as nothing; here we record it, so the test fails
// where production silently shipped a hole.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    const dict = JSON.parse(
      readFileSync(
        fileURLToPath(new URL(`../messages/${mocks.locale}.json`, import.meta.url)),
        "utf8",
      ),
    )[namespace] as Record<string, string>;
    return (key: string, vars?: Record<string, unknown>) => {
      const template = dict[key];
      if (template === undefined) {
        mocks.missing.push(`${key} → MISSING KEY`);
        return `«missing:${key}»`;
      }
      return template.replace(/\{(\w+)\}/g, (_m, token: string) => {
        const value = vars?.[token];
        if (value === undefined || value === null || value === "") {
          mocks.missing.push(`${key} → {${token}}`);
          return `«unfilled:${token}»`;
        }
        return String(value);
      });
    };
  },
}));

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

const TOKEN = "3f2b1a44-0026-4c0a-9f11-8a7d6e5c4b3a";
let ipSeq = 0;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterCallbacks.length = 0;
  mocks.missing.length = 0;
  mocks.locale = "en";
  mocks.submitPledge.mockResolvedValue({
    ok: true,
    result: { pledgeCount: 1, threshold: 20, isOpen: false, alreadyPledged: false },
  });
  mocks.getRemovalToken.mockResolvedValue(TOKEN);
  mocks.getNeighborhoodStatus.mockResolvedValue({
    slug: "wildflower",
    name: "Wildflower",
    threshold: 20,
    pledgeCount: 1,
    isOpen: false,
  });
  mocks.sendPledgeConfirmation.mockResolvedValue({ ok: true });
});

async function pledgeAndCapture() {
  const res = await POST(
    new Request("http://localhost/api/pledge", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ipSeq % 250}` },
      body: JSON.stringify({ slug: "wildflower", email: "neighbor@example.com" }),
    }),
  );
  for (const cb of [...mocks.afterCallbacks]) await cb();
  mocks.afterCallbacks.length = 0;
  expect(res.status).toBe(200);
  expect(mocks.sendPledgeConfirmation).toHaveBeenCalledTimes(1);
  return mocks.sendPledgeConfirmation.mock.calls[0][0] as {
    subject: string;
    heading: string;
    paragraphs: string[];
    shareUrl: string;
    shareLabel: string;
    removeUrl: string;
    removeLabel: string;
    privacyNote: string;
  };
}

describe("pledge email composition", () => {
  for (const locale of LOCALES) {
    it(`${locale}: no placeholder goes unfilled anywhere in the email`, async () => {
      mocks.locale = locale;
      const sent = await pledgeAndCapture();

      // Nothing asked for a variable it did not get.
      expect(mocks.missing, "variables the copy wanted and the route did not pass").toEqual([]);

      // And nothing leaked a raw or marked placeholder into the sent text.
      const everything = [
        sent.subject, sent.heading, ...sent.paragraphs,
        sent.shareLabel, sent.removeLabel, sent.privacyNote,
      ].join("\n");
      expect(everything).not.toMatch(/\{\w+\}/);
      expect(everything).not.toContain("«unfilled:");
      expect(everything).not.toContain("«missing:");
    });
  }

  it("the neighborhood name actually appears — the exact bug that shipped", async () => {
    const sent = await pledgeAndCapture();
    expect(sent.subject).toContain("Wildflower");
    expect(sent.paragraphs[0]).toContain("Wildflower");

    // The two sentences that shipped broken, asserted on their real signature:
    // a dropped leading variable left the line starting mid-sentence ("is now
    // at 1 of 20."), and a dropped mid-sentence one left two words fused
    // ("where stands").
    expect(sent.paragraphs[0]).not.toMatch(/^\s*is now at/i);
    expect(sent.paragraphs.join("\n")).not.toMatch(/where\s+stands/);

    // A dropped variable also leaves a tell wherever it sat: a doubled space,
    // or a space stranded before punctuation. Neither should exist anywhere.
    const everything = [sent.subject, sent.heading, ...sent.paragraphs].join("\n");
    expect(everything).not.toMatch(/ {2}/);
    expect(everything).not.toMatch(/\s+[.,]/);
  });

  it("fails loudly if the call site stops supplying a variable", async () => {
    // Reproduce the original defect: the name is unavailable. The route must
    // NOT send a half-interpolated email.
    mocks.getNeighborhoodStatus.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/pledge", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify({ slug: "wildflower", email: "neighbor@example.com" }),
      }),
    );
    for (const cb of [...mocks.afterCallbacks]) await cb();

    // The pledge itself still succeeds — a mail problem never un-records it.
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    // But no broken email goes out.
    expect(mocks.sendPledgeConfirmation).not.toHaveBeenCalled();
  });
});
