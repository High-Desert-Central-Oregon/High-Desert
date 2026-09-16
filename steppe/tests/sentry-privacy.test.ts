import { describe, expect, it } from "vitest";
import { makeSession, getCurrentScope, startSession, captureSession } from "@sentry/core";
import { BrowserClient, defaultStackParser } from "@sentry/browser";
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
  it("keeps crash accounting through the real SDK transport without sending identity", async () => {
    const envelopes: unknown[] = [];
    const client = new BrowserClient({
      dsn: "https://public@example.com/1", release: "transport-test", environment: "test",
      defaultIntegrations: false, integrations: [], stackParser: defaultStackParser,
      beforeSend: sanitizeError, sendDefaultPii: false,
      enableLogs: false, enableMetrics: false, sendClientReports: false,
      transport: () => ({ send: async (envelope) => { envelopes.push(envelope); return {}; }, flush: async () => true }),
    });
    client.on("beforeSendSession", sanitizeSession);
    const scope = getCurrentScope();
    scope.setClient(client);
    client.init();
    scope.setUser({ id: "private-member", email: "private@example.com" });
    const session = startSession();
    captureSession();
    client.captureEvent({
      exception: { values: [{ type: "TypeError", value: "private form content", mechanism: { type: "onerror", handled: false }, stacktrace: { frames: [{ filename: "https://www.steppe.community/_next/static/chunks/example.js", lineno: 10, colno: 2 }] } }] },
      request: { url: "https://www.steppe.community/private-member" },
    }, {}, scope);
    await client.flush();
    expect(session.status).toBe("crashed");
    expect(session.errors).toBe(1);
    const payload = JSON.stringify(envelopes);
    expect(payload).toContain('"type":"session"');
    expect(payload).toContain('"type":"event"');
    expect(payload).toContain('"status":"crashed"');
    expect(payload).not.toContain("private");
    scope.setUser(null);
    scope.setSession(undefined);
    scope.setClient(undefined);
    await client.close();
  });

});
