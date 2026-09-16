import { describe, it, expect } from "vitest";
import {
  DiagnosticBuffer,
  MAX_AGE_MS,
  parseReport,
  safePage,
  sanitizeDiagnostics,
} from "@/lib/bug-reports/shared";
describe("bug report privacy boundary", () => {
  it("removes route identifiers, tokens, query strings, and unknown paths", () => {
    expect(safePage("/invite/secret?email=private@example.com#token")).toBe(
      "/invite/[token]",
    );
    expect(safePage("/protected/messages/private-thread")).toBe(
      "/protected/messages/[id]",
    );
    expect(safePage("/n/home-address/leave?token=secret")).toBe(
      "/n/[slug]/leave",
    );
    expect(safePage("https://attacker.example/secrets")).toBe("/unknown");
    expect(safePage("/not-listed/private-text")).toBe("/unknown");
    expect(safePage("/protected/groups/private-name/manage")).toBe(
      "/protected/groups/[slug]/manage",
    );
  });
  it("records nothing before opt-in; bounds, expires, and clears history", () => {
    const buffer = new DiagnosticBuffer();
    buffer.record("form.submit", "/contact", 0);
    expect(buffer.snapshot(0)).toEqual([]);
    buffer.enable(true);
    for (let n = 0; n < 110; n++) buffer.record("page.open", "/contact", n);
    expect(buffer.snapshot(110)).toHaveLength(100);
    expect(buffer.snapshot(MAX_AGE_MS + 200)).toEqual([]);
    buffer.record("ui.error", "/contact", MAX_AGE_MS + 300);
    buffer.enable(false);
    expect(buffer.snapshot(MAX_AGE_MS + 300)).toEqual([]);
  });
  it("drops raw console data, private payloads, and forged event names", () => {
    const result = sanitizeDiagnostics({
      events: [
        {
          name: "form.submit",
          page: "/protected/events/secret?token=private",
          atMs: 1,
          password: "secret",
        },
        { name: "vote.yes", atMs: 2, page: "/" },
        { name: "ui.error", atMs: Infinity, page: "/" },
      ],
      environment: {
        browser: "Chrome",
        version: "133.0.0",
        os: "macOS",
        width: 50000,
        height: 800,
        locale: "es",
        mode: "browser",
        online: true,
        cookie: "secret",
      },
      rawConsole: "private message",
      screenshot: "identity document",
    });
    expect(result?.events).toEqual([
      { name: "form.submit", page: "/protected/events/[id]", atMs: 1 },
    ]);
    expect(result?.environment.width).toBe(10000);
    expect(JSON.stringify(result)).not.toMatch(
      /secret|password|cookie|private|identity/,
    );
  });
  it("accepts text-only reports and refuses malformed submissions", () => {
    const input = {
      requestKey: "11111111-1111-4111-8111-111111111111",
      description: "The RSVP failed",
      expected: "",
      email: "",
      page: "/contact",
    };
    expect(parseReport(input)?.diagnostics).toBeNull();
    expect(parseReport({ ...input, description: "     " })).toBeNull();
    expect(parseReport({ ...input, email: "wrong" })).toBeNull();
    expect(parseReport({ ...input, requestKey: "wrong" })).toBeNull();
    expect(
      parseReport({
        ...input,
        reporter_id: "forged",
        role: "admin",
        release: "forged",
      }),
    ).not.toHaveProperty("reporter_id");
  });
});
