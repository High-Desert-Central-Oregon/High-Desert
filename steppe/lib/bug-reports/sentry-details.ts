/**
 * Steppe — operator-only Sentry enrichment for saved reports.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under the GNU AGPL version 3 or later; see LICENSE.
 */
import { createClient } from "@/lib/supabase/server";
import { isSupportOperator, readLimitedJson } from "./server";
import { sanitizeDiagnostics, UUID } from "./shared";
import { errorKind, type SentryReference } from "./sentry-references";

// Deliberately fixed to Steppe: report input never selects a host or project.
const ORGANIZATION = "steppe-xu";
const PROJECT = "steppe";
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
export type SentryDetails = {
  kind: string;
  handled: boolean | null;
  url: string;
  frames: { file: string; line: number; column?: number }[];
};
export type LinkedSentryError = {
  reference: SentryReference;
  state: "available" | "pending" | "unavailable" | "mismatch";
  details?: SentryDetails;
};
export type ReportSentryResult = {
  state: "ready" | "none" | "unavailable" | "not_configured";
  errors: LinkedSentryError[];
};

/** Copy only code locations; never render provider messages, request data or identity. */
export function parseSentryDetails(
  value: unknown,
  reference: SentryReference,
): SentryDetails | null {
  const event = record(value);
  const release =
    typeof event.release === "string"
      ? event.release
      : record(event.release).version;
  const time =
    typeof event.dateCreated === "string" ? Date.parse(event.dateCreated) : NaN;
  if (
    event.eventID !== reference.eventId ||
    release !== reference.release ||
    !Number.isFinite(time) ||
    Math.abs(time - Date.parse(reference.occurredAt)) > 5000 ||
    typeof event.groupID !== "string" ||
    !/^\d+$/.test(event.groupID)
  )
    return null;
  const tags = Array.isArray(event.tags) ? event.tags.map(record) : [];
  if (tags.find((tag) => tag.key === "environment")?.value !== "production")
    return null;
  const handled = tags.find((tag) => tag.key === "handled")?.value;
  const frames: SentryDetails["frames"] = [];
  for (const entry of Array.isArray(event.entries)
    ? event.entries.map(record)
    : []) {
    if (entry.type !== "exception") continue;
    const values = record(entry.data).values;
    for (const exception of Array.isArray(values) ? values.map(record) : []) {
      const stack = record(exception.stacktrace).frames;
      for (const frame of Array.isArray(stack) ? stack.map(record) : []) {
        if (
          typeof frame.filename !== "string" ||
          typeof frame.lineNo !== "number" ||
          !Number.isInteger(frame.lineNo) ||
          frame.lineNo < 1
        )
          continue;
        // The source maps may add webpack prefixes. Keep only app-owned source paths.
        const file = frame.filename.match(
          /(?:^|\/)((?:app|components|lib|_next\/static)\/[a-zA-Z0-9_./()[\]@~-]+\.(?:[cm]?js|tsx?))$/,
        )?.[1];
        if (!file || file.includes("..")) continue;
        frames.push({
          file,
          line: frame.lineNo,
          ...(typeof frame.colNo === "number" &&
          Number.isInteger(frame.colNo) &&
          frame.colNo >= 0
            ? { column: frame.colNo }
            : {}),
        });
      }
    }
  }
  return {
    kind: errorKind(record(event.metadata).type),
    handled: handled === "yes" ? true : handled === "no" ? false : null,
    url: `https://${ORGANIZATION}.sentry.io/issues/${event.groupID}/events/${reference.eventId}/`,
    frames: frames.slice(-20),
  };
}

export async function loadReportSentryErrors(
  id: string,
): Promise<ReportSentryResult> {
  try {
    // Authorize before report reads or any third-party request, including direct callers.
    if (!UUID.test(id) || !(await isSupportOperator()))
      return { state: "unavailable", errors: [] };
    const db = await createClient();
    const { data, error } = await db
      .from("bug_reports")
      .select("diagnostics")
      .eq("id", id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return { state: "unavailable", errors: [] };
    const references =
      sanitizeDiagnostics(data.diagnostics)?.sentryErrors ?? [];
    if (!references.length) return { state: "none", errors: [] };
    const token = process.env.SENTRY_REPORTS_READ_TOKEN;
    if (!token) return { state: "not_configured", errors: [] };
    const errors = await Promise.all(
      references.map(async (reference): Promise<LinkedSentryError> => {
        try {
          const response = await fetch(
            `https://sentry.io/api/0/projects/${ORGANIZATION}/${PROJECT}/events/${reference.eventId}/`,
            {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
              redirect: "error",
              signal: AbortSignal.timeout(4000),
            },
          );
          if (response.status === 404) return { reference, state: "pending" };
          if (!response.ok) return { reference, state: "unavailable" };
          // Bound even an unexpected provider response. No raw provider payload is stored.
          const details = parseSentryDetails(
            await readLimitedJson(response, 512_000),
            reference,
          );
          return details
            ? { reference, state: "available", details }
            : { reference, state: "mismatch" };
        } catch {
          return { reference, state: "unavailable" };
        }
      }),
    );
    return { state: "ready", errors };
  } catch {
    return { state: "unavailable", errors: [] };
  }
}
