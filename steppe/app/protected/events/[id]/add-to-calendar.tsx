"use client";

import { useState } from "react";
import { calendarDetails } from "@/lib/calendar-details";
import { buildIcs } from "@/lib/ics";

/** Downloads an offline-compatible ICS file and offers copyable, Pacific-time
 * prose. If clipboard/download access fails, the text remains selectable. */
export function AddToCalendar({
  eventId,
  title,
  startsAt,
  endsAt,
  location,
  body,
  locale,
  labels,
}: {
  eventId: string;
  title: string;
  startsAt: string;
  /** DTEND when the event has an end (events.ends_at, 0020). */
  endsAt?: string | null;
  location: string | null;
  body?: string | null;
  locale: string;
  labels: {
    button: string;
    note: string;
    description: string;
    copy: string;
    copied: string;
    copyFailed: string;
  };
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  const [copyStatus, setCopyStatus] = useState("");
  const details = calendarDetails(
    { title, startsAt, endsAt, location, body },
    locale,
  );
  const ics = buildIcs({
    prodId: "-//Steppe//Exchange//EN",
    events: [
      {
        uid: `${eventId}@steppe.community`,
        dtstamp: new Date().toISOString(),
        dtstart: startsAt,
        dtend: endsAt,
        summary: title,
        location,
        description: [body, labels.description].filter(Boolean).join("\n\n"),
      },
    ],
  });

  const download = () => {
    try {
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "steppe-event.ics";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1500);
      setState("done");
    } catch {
      // No download — surface the copy panel expanded instead.
      setState("failed");
    }
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={download}
        className="flex items-center justify-center gap-[9px] border bg-card p-[13px] font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4.5" width="18" height="16" rx="1.5" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </svg>
        {labels.button}
      </button>
      <button
        type="button"
        className="mt-3 min-h-11 self-start underline focus-ring"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(details);
            setCopyStatus(labels.copied);
          } catch {
            setCopyStatus(labels.copyFailed);
            setState("failed");
          }
        }}
      >
        {labels.copy}
      </button>
      {copyStatus && (
        <p role="status" className="text-sm">
          {copyStatus}
        </p>
      )}
      <details
        role="status"
        open={state === "failed"}
        className="mt-[11px] border bg-muted"
      >
        <summary className="cursor-pointer p-[13px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {labels.note}
        </summary>
        <pre className="select-text whitespace-pre-wrap px-[13px] pb-[13px] font-mono text-[11.5px] leading-[1.7] text-foreground">
          {details}
        </pre>
      </details>
    </div>
  );
}
