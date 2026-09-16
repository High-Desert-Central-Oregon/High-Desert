import { describe, expect, it } from "vitest";
import { makeSession } from "@sentry/core";
import { sanitizeError, sanitizeSession } from "../lib/sentry-privacy";

describe("anonymous browser health", () => {
  it("removes member data while preserving the unhandled crash and code position", () => {
    const event = sanitizeError({
      event_id: "event", release: "commit", environment: "production",
      message: "private form value", user: { id: "member-id", email: "private@example.com" },
      request: { url: "https://steppe.community/member-id?secret=1", cookies: "token" },
      breadcrumbs: [{ message: "private click" }], extra: { report: "private report" },
      tags: { member: "member-id" }, contexts: { private: { value: "private context" } },
      exception: { values: [{ type: "TypeError", value: "private error", mechanism: { type: "onerror", handled: false, data: { private: "private" } }, stacktrace: { frames: [
        { filename: "https://www.steppe.community/_next/static/chunks/123.js?secret=1", lineno: 12, colno: 4, vars: { password: "private" }, function: "private function" },
        { filename: "https://www.steppe.community/member-id", lineno: 1 },
      ] } }] },
    });
    expect(JSON.stringify(event)).not.toMatch(/private|member-id|secret|password/);
    expect(event?.exception?.values?.[0]?.mechanism?.handled).toBe(false);
    expect(event?.exception?.values?.[0]?.stacktrace?.frames).toEqual([{ filename: "https://www.steppe.community/_next/static/chunks/123.js", lineno: 12, colno: 4, in_app: true }]);
    expect(event?.release).toBe("commit");
  });
  it("does not send arbitrary message events", () => expect(sanitizeError({ message: "private" })).toBeNull());
  it("serializes health without a user identifier, IP or user agent", () => {
    const session = makeSession({ release: "commit", environment: "production", user: { id: "member-id", ip_address: "192.0.2.1" }, userAgent: "private device" });
    sanitizeSession(session);
    const payload = JSON.parse(JSON.stringify(session));
    expect(payload.attrs).toEqual({ release: "commit", environment: "production" });
    expect(payload.did).toBeUndefined();
    expect(payload.status).toBe("ok");
  });
});
