"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReport, retryReportNotification } from "../actions";
import { bugCopy, type BugStatus } from "@/lib/bug-reports/copy";
import { FormError } from "@/components/form-error";
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
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [busy, start] = useTransition();
  const perform = (retry: boolean) =>
    start(async () => {
      setMessage(null);
      try {
        const result = retry
          ? await retryReportNotification(id)
          : await updateReport(id, value, note);
        setMessage({
          text: result.ok ? (retry ? t.retryQueued : t.saved) : t.updateFailed,
          error: !result.ok,
        });
        if (result.ok) {
          // Retrying email does not save the support draft.
          if (!retry) setNote("");
          router.refresh();
        }
      } catch {
        setMessage({ text: t.updateFailed, error: true });
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
          className="field-control focus-ring min-h-11 border bg-background p-2 text-base md:text-sm"
          value={value}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value as BugStatus);
            setMessage(null);
          }}
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
          className="field-control focus-ring min-h-24 border bg-background p-2 text-base md:text-sm"
          value={note}
          disabled={busy}
          onChange={(e) => {
            setNote(e.target.value);
            setMessage(null);
          }}
          maxLength={2000}
          aria-describedby="case-note-hint"
        />
        <p id="case-note-hint" className="text-xs">
          {t.noteHint}
        </p>
        <button className="focus-ring min-h-11 border border-input p-2 font-semibold" disabled={busy}>
          {t.save}
        </button>
      </form>
      {pendingEmail && (
        <button
          type="button"
          className="focus-ring min-h-11 border border-input p-2"
          disabled={busy}
          onClick={() => perform(true)}
        >
          {t.retry}
        </button>
      )}
      {message && (message.error ? (
        <FormError message={message.text} pending={busy} />
      ) : (
        <p role="status">{message.text}</p>
      ))}
    </section>
  );
}
