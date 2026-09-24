"use client";

import { useState } from "react";
import { calendarDetails, calendarDetailFields } from "@/lib/calendar-details";
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
    copyField: string;
    fieldCopied: string;
  };
}) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [copyStatus, setCopyStatus] = useState("");
  const details = calendarDetails(
    { title, startsAt, endsAt, location, body },
    locale,
  );
  const fields = calendarDetailFields(
    { title, startsAt, endsAt, location, body },
    locale,
  );

  async function copyText(text: string, id: string, message: string) {
    setCopiedField(null);
    setCopyStatus("");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(id);
      setCopyStatus(message);
    } catch {
      setCopyStatus(labels.copyFailed);
      setDetailsOpen(true);
    }
  }

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
    } catch {
      // No download — surface the copy panel expanded instead.
      setDetailsOpen(true);
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
        onClick={() => copyText(details, "all", labels.copied)}
      >
        {labels.copy}
      </button>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-sm"
      >
        {copyStatus}
      </p>
      <details
        open={detailsOpen}
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        className="mt-[11px] border bg-muted"
      >
        <summary className="cursor-pointer p-[13px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {labels.note}
        </summary>
        <dl className="divide-y border-t px-[13px]">
          {fields.map((field) => (
            <div key={field.id} className="py-3">
              <dt className="text-xs font-semibold text-muted-foreground">
                {field.label}
              </dt>
              <dd className="flex items-start gap-3">
                <span className="min-w-0 flex-1 select-text whitespace-pre-wrap break-words pt-2 text-sm leading-relaxed">
                  {field.value}
                </span>
                <button
                  type="button"
                  aria-label={`${copiedField === field.id ? labels.fieldCopied : labels.copyField}: ${field.label}`}
                  className="min-h-11 shrink-0 px-2 text-sm underline focus-ring"
                  onClick={() =>
                    copyText(
                      field.value,
                      field.id,
                      `${field.label}: ${labels.fieldCopied}`,
                    )
                  }
                >
                  {copiedField === field.id
                    ? labels.fieldCopied
                    : labels.copyField}
                </button>
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
