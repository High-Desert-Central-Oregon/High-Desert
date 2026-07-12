"use client";

import { useState } from "react";

/**
 * Add to calendar — bundle behavior (inner.html :936-941, addToCalendar
 * :1712-1718): a hairline button that downloads a client-built .ics (zero
 * server state, works offline). The copy-details panel is the SECONDARY
 * fallback: nothing renders until the button is tapped; after a successful
 * download it appears collapsed (a details/summary the member can expand to
 * copy), and it auto-expands only when the download itself failed. The event
 * has no end time in the schema, so the VEVENT carries only DTSTART —
 * calendar apps treat it as a point/default-length event; nothing is
 * invented.
 */
export function AddToCalendar({
  eventId,
  title,
  startsAt,
  location,
  labels,
}: {
  eventId: string;
  title: string;
  startsAt: string;
  location: string | null;
  labels: { button: string; note: string; description: string };
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  const stamp = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Steppe//Exchange//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${eventId}@steppe.community`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(startsAt)}`,
    `SUMMARY:${title}`,
    ...(location ? [`LOCATION:${location}`] : []),
    `DESCRIPTION:${labels.description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

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
      {state !== "idle" && (
        <details
          role="status"
          open={state === "failed"}
          className="mt-[11px] border bg-muted"
        >
          <summary className="cursor-pointer p-[13px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {labels.note}
          </summary>
          <pre className="select-text whitespace-pre-wrap px-[13px] pb-[13px] font-mono text-[11.5px] leading-[1.7] text-foreground">
            {ics}
          </pre>
        </details>
      )}
    </div>
  );
}
