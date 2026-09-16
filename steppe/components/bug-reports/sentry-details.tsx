/**
 * Steppe — private error details for support review.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under the GNU AGPL version 3 or later; see LICENSE.
 */
import { loadReportSentryErrors } from "@/lib/bug-reports/sentry-details";
import { bugCopy } from "@/lib/bug-reports/copy";
import { formatRedmondDateTime } from "@/lib/time";

export async function ReportSentryDetails({
  id,
  locale,
}: {
  id: string;
  locale: "en" | "es";
}) {
  const t = bugCopy[locale];
  const result = await loadReportSentryErrors(id);
  return (
    <section>
      <h2 className="text-xl font-semibold">{t.sentryHeading}</h2>
      <p className="my-2 text-xs">{t.sentryNote}</p>
      {result.state !== "ready" ? (
        <p>
          {result.state === "none"
            ? t.sentryNone
            : result.state === "not_configured"
              ? t.sentryNotConfigured
              : t.sentryUnavailable}
        </p>
      ) : (
        <ol className="divide-y border-y">
          {result.errors.map(({ reference, state, details }) => (
            <li key={reference.eventId} className="py-3 text-sm">
              <p className="font-semibold">
                {details?.kind ?? reference.kind} ·{" "}
                {formatRedmondDateTime(reference.occurredAt, locale)}
              </p>
              <p className="break-all">
                {t.release}: <code>{reference.release}</code>
              </p>
              <p className="break-all">
                <code>{reference.eventId}</code>
              </p>
              {details ? (
                <>
                  {details.handled !== null && (
                    <p>
                      {details.handled ? t.sentryHandled : t.sentryUnhandled}
                    </p>
                  )}
                  {details.frames.length > 0 && (
                    <ol className="my-2">
                      {details.frames.map((frame, index) => (
                        <li key={index} className="break-all">
                          <code>
                            {frame.file}:{frame.line}
                            {frame.column !== undefined
                              ? `:${frame.column}`
                              : ""}
                          </code>
                        </li>
                      ))}
                    </ol>
                  )}
                  <a
                    className="underline"
                    href={details.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.sentryOpen}
                  </a>
                </>
              ) : (
                <p>
                  {state === "pending"
                    ? t.sentryPending
                    : state === "mismatch"
                      ? t.sentryMismatch
                      : t.sentryUnavailable}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
