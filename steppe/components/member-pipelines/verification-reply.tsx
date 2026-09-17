"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pc } from "@/lib/member-pipelines/copy";
import { replyToReview } from "@/app/protected/review/workflow-actions";
export function VerificationReply({
  id,
  locale,
}: {
  id: string;
  locale: string;
}) {
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const result = await replyToReview(id, reply);
            setMessage(pc(locale, result.ok ? "replied" : "failed"));
            if (result.ok) router.refresh();
          } catch {
            setMessage(pc(locale, "failed"));
          }
        });
      }}
    >
      <label htmlFor="verification-reply">{pc(locale, "reply")}</label>
      <textarea
        id="verification-reply"
        required
        minLength={2}
        maxLength={1200}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        aria-describedby="reply-hint"
        className="min-h-24 rounded border bg-background p-2"
      />
      <p id="reply-hint" className="text-xs">
        {pc(locale, "replyHint")}
      </p>
      <button disabled={busy} className="min-h-11 rounded border px-3">
        {pc(locale, "sendReply")}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
