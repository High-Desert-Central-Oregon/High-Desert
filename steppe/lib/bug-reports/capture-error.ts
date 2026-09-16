/**
 * Steppe — retain a private, local reference to a sanitized crash.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under the GNU AGPL version 3 or later; see LICENSE.
 */
import type { ErrorEvent } from "@sentry/core";
import { sanitizeError } from "@/lib/sentry-privacy";
import { sentryReferences } from "./sentry-references";
export function sanitizeAndRememberError(event: ErrorEvent): ErrorEvent | null {
  const safe = sanitizeError(event);
  if (
    safe?.event_id &&
    typeof safe.timestamp === "number" &&
    Number.isFinite(safe.timestamp)
  ) {
    const occurredAt = new Date(safe.timestamp * 1000);
    if (!Number.isNaN(occurredAt.getTime()))
      sentryReferences.record({
        eventId: safe.event_id,
        occurredAt: occurredAt.toISOString(),
        release: safe.release,
        kind: safe.exception?.values?.[0]?.type,
      });
  }
  return safe;
}
