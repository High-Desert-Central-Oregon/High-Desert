/** Steppe — correlation tests. Copyright (C) 2026 Steppe.
 * SPDX-License-Identifier: AGPL-3.0-or-later. GNU AGPL v3 or later; see LICENSE. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SentryReferenceBuffer,
  sanitizeSentryReferences,
  sentryReferences,
} from "@/lib/bug-reports/sentry-references";
import { parseReport, sanitizeDiagnostics } from "@/lib/bug-reports/shared";
import { clearDiagnostics } from "@/lib/bug-reports/client";
const mocks = vi.hoisted(() => ({
  operator: vi.fn(),
  row: vi.fn(),
  createClient: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/bug-reports/server", async () => ({
  ...(await vi.importActual("@/lib/bug-reports/server")),
  isSupportOperator: mocks.operator,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
import {
  loadReportSentryErrors,
  parseSentryDetails,
} from "@/lib/bug-reports/sentry-details";
const id = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-09-16T21:00:00.000Z");
const reference = {
  eventId: "a".repeat(32),
  occurredAt: new Date(now).toISOString(),
  release: "commit-one",
  kind: "TypeError",
};
function sentryEvent() {
  return {
    eventID: reference.eventId,
    groupID: "123456",
    release: { version: reference.release },
    dateCreated: reference.occurredAt,
    metadata: { type: "TypeError", value: "PRIVATE" },
    user: { email: "PRIVATE" },
    tags: [
      { key: "environment", value: "production" },
      { key: "handled", value: "no" },
    ],
    entries: [
      { type: "request", data: { body: "PRIVATE" } },
      {
        type: "exception",
        data: {
          values: [
            {
              value: "PRIVATE",
              stacktrace: {
                frames: [
                  {
                    filename: "webpack://_N_E/./app/protected/page.tsx",
                    lineNo: 42,
                    colNo: 7,
                    context: "PRIVATE",
                    vars: { secret: "PRIVATE" },
                  },
                  { filename: "/home/PRIVATE/secrets.txt", lineNo: 1 },
                ],
              },
            },
          ],
        },
      },
    ],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SENTRY_REPORTS_READ_TOKEN", "test-only-token");
  mocks.operator.mockResolvedValue(true);
  mocks.row.mockResolvedValue({
    data: { diagnostics: { sentryErrors: [reference] } },
    error: null,
  });
  mocks.createClient.mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({ gt: () => ({ maybeSingle: mocks.row }) }),
      }),
    }),
  });
  mocks.fetch.mockImplementation(async () => Response.json(sentryEvent()));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("local Sentry references", () => {
  it("bounds, deduplicates, expires and rejects delayed events after clearing", () => {
    const buffer = new SentryReferenceBuffer();
    for (let n = 0; n < 8; n++)
      buffer.record(
        { ...reference, eventId: n.toString(16).padStart(32, "0") },
        now,
      );
    expect(buffer.snapshot(now)).toHaveLength(5);
    buffer.record(reference, now);
    buffer.record(reference, now);
    expect(
      buffer.snapshot(now).filter((e) => e.eventId === reference.eventId),
    ).toHaveLength(1);
    const snapshot = buffer.snapshot(now);
    snapshot[0].release = "changed";
    expect(buffer.snapshot(now)[0].release).not.toBe("changed");
    buffer.clear(now + 1);
    buffer.record(reference, now + 2);
    expect(buffer.snapshot(now + 2)).toEqual([]);
    buffer.record(
      { ...reference, occurredAt: new Date(now + 3).toISOString() },
      now + 3,
    );
    expect(buffer.snapshot(now + 600_004)).toEqual([]);
  });
  it("clears references with account/page diagnostics", () => {
    sentryReferences.record({
      ...reference,
      occurredAt: new Date().toISOString(),
    });
    expect(sentryReferences.snapshot()).toHaveLength(1);
    clearDiagnostics();
    expect(sentryReferences.snapshot()).toEqual([]);
  });
  it("keeps only safe fields, rejects malformed references and preserves historical ones", () => {
    expect(
      sanitizeSentryReferences([
        { ...reference, message: "PRIVATE", user: "PRIVATE", kind: "PRIVATE" },
      ]),
    ).toEqual([{ ...reference, kind: "Error" }]);
    expect(
      sanitizeDiagnostics({ sentryErrors: [reference] })?.sentryErrors,
    ).toEqual([reference]);
    expect(
      sanitizeSentryReferences([
        { ...reference, eventId: "../../other-project" },
        { ...reference, occurredAt: "bad" },
      ]),
    ).toEqual([]);
  });
  it("does not attach references to text-only reports and supports errors without recorded actions", () => {
    const input = {
      requestKey: id,
      description: "Save failed",
      expected: "",
      email: "",
      page: "/",
    };
    expect(
      parseReport({ ...input, sentryErrors: [reference] })?.diagnostics,
    ).toBeNull();
    expect(
      parseReport({
        ...input,
        diagnostics: { events: [], sentryErrors: [reference] },
      })?.diagnostics?.sentryErrors,
    ).toEqual([reference]);
  });
});
describe("operator Sentry enrichment", () => {
  it("authorizes before reading reports or contacting Sentry", async () => {
    mocks.operator.mockResolvedValue(false);
    expect((await loadReportSentryErrors(id)).state).toBe("unavailable");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("contains authentication and database failures within the error section", async () => {
    mocks.operator.mockRejectedValueOnce(new Error("PRIVATE"));
    expect((await loadReportSentryErrors(id)).state).toBe("unavailable");
    mocks.row.mockRejectedValueOnce(new Error("PRIVATE"));
    expect((await loadReportSentryErrors(id)).state).toBe("unavailable");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("never retrieves errors for missing, expired or inaccessible reports", async () => {
    mocks.row.mockResolvedValue({ data: null, error: null });
    expect((await loadReportSentryErrors(id)).state).toBe("unavailable");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("does not guess errors when none were included", async () => {
    mocks.row.mockResolvedValue({ data: { diagnostics: null }, error: null });
    expect((await loadReportSentryErrors(id)).state).toBe("none");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("reports missing credentials without blocking the report", async () => {
    vi.stubEnv("SENTRY_REPORTS_READ_TOKEN", "");
    expect((await loadReportSentryErrors(id)).state).toBe("not_configured");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("retrieves only the exact Steppe event and returns safe technical details", async () => {
    const result = await loadReportSentryErrors(id);
    expect(mocks.fetch).toHaveBeenCalledWith(
      `https://sentry.io/api/0/projects/steppe-xu/steppe/events/${reference.eventId}/`,
      expect.objectContaining({ cache: "no-store", redirect: "error" }),
    );
    expect(result.errors[0].state).toBe("available");
    expect(result.errors[0].details?.frames).toEqual([
      { file: "app/protected/page.tsx", line: 42, column: 7 },
    ]);
    expect(result.errors[0].details?.handled).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|test-only-token/);
  });
  it("picks up delayed processing on the next review", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await loadReportSentryErrors(id)).errors[0].state).toBe("pending");
    expect((await loadReportSentryErrors(id)).errors[0].state).toBe(
      "available",
    );
  });
  it.each([401, 403, 429, 503])(
    "handles Sentry %s without losing report access",
    async (status) => {
      mocks.fetch.mockResolvedValueOnce(new Response(null, { status }));
      expect((await loadReportSentryErrors(id)).errors[0].state).toBe(
        "unavailable",
      );
    },
  );
  it("handles timeouts and oversized responses", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("PRIVATE"));
    expect((await loadReportSentryErrors(id)).errors[0].state).toBe(
      "unavailable",
    );
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ data: "x".repeat(512_001) }),
    );
    expect((await loadReportSentryErrors(id)).errors[0].state).toBe(
      "unavailable",
    );
  });
  it("refuses mismatched release, time, environment and event identity", () => {
    expect(
      parseSentryDetails(
        { ...sentryEvent(), release: "another-release" },
        reference,
      ),
    ).toBeNull();
    expect(
      parseSentryDetails(
        { ...sentryEvent(), eventID: "b".repeat(32) },
        reference,
      ),
    ).toBeNull();
    expect(
      parseSentryDetails(
        { ...sentryEvent(), dateCreated: new Date(now + 10_000).toISOString() },
        reference,
      ),
    ).toBeNull();
    expect(
      parseSentryDetails({ ...sentryEvent(), tags: [] }, reference),
    ).toBeNull();
  });
});
