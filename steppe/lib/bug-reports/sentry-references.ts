/**
 * Steppe — bounded references to anonymous application errors.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under the GNU AGPL version 3 or later; see LICENSE.
 */
export const MAX_SENTRY_REFERENCES = 5;
export const SENTRY_REFERENCE_AGE_MS = 10 * 60_000;
export const SENTRY_EVENT_ID = /^[a-f0-9]{32}$/;
const RELEASE = /^[a-zA-Z0-9._-]{1,80}$/;
const KINDS =
  /^(Error|TypeError|RangeError|ReferenceError|SyntaxError|URIError|EvalError)$/;
export type SentryReference = {
  eventId: string;
  occurredAt: string;
  release: string;
  kind: string;
};
export function errorKind(value: unknown): string {
  return typeof value === "string" && KINDS.test(value) ? value : "Error";
}
/** Historical references stay readable; only the live buffer applies an age limit. */
export function sanitizeSentryReferences(value: unknown): SentryReference[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(-MAX_SENTRY_REFERENCES).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { eventId, occurredAt, release, kind } = item;
    if (
      typeof eventId !== "string" ||
      !SENTRY_EVENT_ID.test(eventId) ||
      seen.has(eventId) ||
      typeof release !== "string" ||
      !RELEASE.test(release) ||
      typeof occurredAt !== "string" ||
      !Number.isFinite(Date.parse(occurredAt)) ||
      new Date(occurredAt).toISOString() !== occurredAt
    )
      return [];
    seen.add(eventId);
    return [{ eventId, occurredAt, release, kind: errorKind(kind) }];
  });
}
/** Memory only, no identity, URLs or error messages. Cleared across account changes. */
export class SentryReferenceBuffer {
  private references: SentryReference[] = [];
  private clearedAt = 0;
  clear(now = Date.now()) {
    this.references = [];
    this.clearedAt = now;
  }
  record(value: unknown, now = Date.now()) {
    const reference = sanitizeSentryReferences([value])[0];
    if (!reference) return;
    const time = Date.parse(reference.occurredAt);
    // Reject delayed SDK processing from before an account/page boundary.
    if (
      time < this.clearedAt ||
      time > now + 1000 ||
      now - time > SENTRY_REFERENCE_AGE_MS
    )
      return;
    this.references = sanitizeSentryReferences([
      ...this.snapshot(now).filter(
        (item) => item.eventId !== reference.eventId,
      ),
      reference,
    ]);
  }
  snapshot(now = Date.now()): SentryReference[] {
    this.references = this.references.filter(
      (item) => now - Date.parse(item.occurredAt) <= SENTRY_REFERENCE_AGE_MS,
    );
    return this.references.map((item) => ({ ...item }));
  }
}
export const sentryReferences = new SentryReferenceBuffer();
