"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReport, retryReportNotification } from "../actions";
import { bugCopy, type BugStatus } from "@/lib/bug-reports/copy";
export function CaseControls({
  id,
  status,
  locale,
  pendingEmail,
}: {
  id: string;
  status: BugStatus;
  locale: "en" | "es";
  pendingEmail: boolean;
}) {
  const t = bugCopy[locale];
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const perform = (retry: boolean) =>
    start(async () => {
      setMessage("");
      try {
        const result = retry
          ? await retryReportNotification(id)
          : await updateReport(id, value, note);
        setMessage(
          result.ok ? (retry ? t.retryQueued : t.saved) : t.updateFailed,
        );
        if (result.ok) {
          setNote("");
          router.refresh();
        }
      } catch {
        setMessage(t.updateFailed);
      }
    });
  return (
    <section className="flex flex-col gap-3 border-y py-5">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          perform(false);
        }}
      >
        <label htmlFor="case-status">{t.status}</label>
        <select
          id="case-status"
          className="min-h-11 border bg-background p-2"
          value={value}
          onChange={(e) => setValue(e.target.value as BugStatus)}
        >
          {Object.entries(t.statuses).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="case-note">{t.note}</label>
        <textarea
          id="case-note"
          className="min-h-24 border bg-background p-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          aria-describedby="case-note-hint"
        />
        <p id="case-note-hint" className="text-xs">
          {t.noteHint}
        </p>
        <button className="min-h-11 border p-2 font-semibold" disabled={busy}>
          {t.save}
        </button>
      </form>
      {pendingEmail && (
        <button
          type="button"
          className="min-h-11 border p-2"
          disabled={busy}
          onClick={() => perform(true)}
        >
          {t.retry}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
