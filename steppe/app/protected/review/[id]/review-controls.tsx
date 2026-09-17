"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { pc } from "@/lib/member-pipelines/copy";
import { requestInformation, completeReview } from "../workflow-actions";
import { createEvidenceSignedUrl } from "../actions";
export function ReviewControls({
  id,
  locale,
  hasEvidence,
  finalizing,
  recordedApprove,
  recordedMessage,
}: {
  id: string;
  locale: string;
  hasEvidence: boolean;
  finalizing: boolean;
  recordedApprove: boolean | null;
  recordedMessage: string;
}) {
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState(recordedMessage);
  const [feedback, setFeedback] = useState("");
  const [url, setUrl] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming !== null) cancelRef.current?.focus();
  }, [confirming]);
  const decide = (approve: boolean) => {
    start(async () => {
      try {
        const result = await completeReview(id, approve, message);
        setFeedback(pc(locale, result.ok ? "saved" : "decisionFailed"));
      } catch {
        setFeedback(pc(locale, "decisionFailed"));
      }
      setConfirming(null);
      router.refresh();
    });
  };
  if (confirming !== null)
    return (
      <section
        className="flex flex-col gap-3 rounded border p-4"
        aria-label={pc(locale, "confirmDecision")}
      >
        <p role="alert">
          {pc(locale, confirming ? "confirmApprove" : "confirmReject")}
        </p>
        {message && <p className="whitespace-pre-wrap">{message}</p>}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            disabled={busy}
            className="min-h-11 rounded border px-3"
            onClick={() => setConfirming(null)}
          >
            {pc(locale, "cancel")}
          </button>
          <button
            disabled={busy}
            className="min-h-11 rounded border px-3 font-semibold"
            onClick={() => decide(confirming)}
          >
            {pc(locale, "confirmDecision")}
          </button>
        </div>
      </section>
    );
  return (
    <div className="flex flex-col gap-5">
      {hasEvidence && !finalizing ? (
        <div>
          <button
            disabled={busy}
            className="min-h-11 rounded border px-3"
            onClick={() =>
              start(async () => {
                try {
                  const result = await createEvidenceSignedUrl(id);
                  if ("url" in result) {
                    setUrl(result.url);
                    window.setTimeout(() => setUrl(""), 55_000);
                  } else setFeedback(pc(locale, "evidenceError"));
                } catch {
                  setFeedback(pc(locale, "evidenceError"));
                }
              })
            }
          >
            {pc(locale, "evidence")}
          </button>
          {url && (
            <a
              className="ml-3 underline"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {pc(locale, "openEvidence")}
            </a>
          )}
        </div>
      ) : !hasEvidence && !finalizing ? (
        <p className="text-sm">{pc(locale, "noEvidence")}</p>
      ) : null}
      {finalizing ? (
        <section className="rounded border p-4">
          <p>{pc(locale, "finishing")}</p>
          <p className="my-2 font-semibold">
            {pc(locale, recordedApprove ? "approve" : "reject")}
          </p>
          <button
            disabled={busy}
            onClick={() => decide(recordedApprove === true)}
            className="min-h-11 rounded border px-3"
          >
            {pc(locale, "finish")}
          </button>
        </section>
      ) : (
        <>
          <form
            className="flex flex-col gap-2 border-y py-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                try {
                  const result = await requestInformation(id, question);
                  setFeedback(
                    pc(locale, result.ok ? "questionSent" : "failed"),
                  );
                  if (result.ok) {
                    setQuestion("");
                    router.refresh();
                  }
                } catch {
                  setFeedback(pc(locale, "failed"));
                }
              });
            }}
          >
            <label htmlFor="review-question">{pc(locale, "requestInfo")}</label>
            <textarea
              id="review-question"
              required
              minLength={5}
              maxLength={1200}
              className="min-h-24 rounded border bg-background p-2"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              aria-describedby="question-hint"
            />
            <p id="question-hint" className="text-xs">
              {pc(locale, "questionHint")}
            </p>
            <button disabled={busy} className="min-h-11 rounded border px-3">
              {pc(locale, "requestInfo")}
            </button>
          </form>
          <section className="flex flex-col gap-2">
            <label htmlFor="decision-message">
              {pc(locale, "decisionMessage")}
            </label>
            <textarea
              id="decision-message"
              maxLength={1200}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-24 rounded border bg-background p-2"
            />
            <p className="text-xs">{pc(locale, "questionHint")}</p>
            <div className="flex gap-3">
              <button
                disabled={busy}
                className="min-h-11 rounded border px-3"
                onClick={() => setConfirming(true)}
              >
                {pc(locale, "approve")}
              </button>
              <button
                disabled={busy || message.trim().length < 5}
                className="min-h-11 rounded border px-3"
                onClick={() => setConfirming(false)}
              >
                {pc(locale, "reject")}
              </button>
            </div>
          </section>
        </>
      )}
      {feedback && <p role="status">{feedback}</p>}
    </div>
  );
}
