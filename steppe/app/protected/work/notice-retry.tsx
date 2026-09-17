"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pc } from "@/lib/member-pipelines/copy";
import { retryNotice } from "./actions";

export function NoticeRetry({ id, locale }: { id: string; locale: string }) {
  const [busy, start] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        disabled={busy}
        className="min-h-11 rounded border px-3"
        onClick={() =>
          start(async () => {
            try {
              const form = new FormData();
              form.set("id", id);
              const result = await retryNotice(form);
              setMessage(pc(locale, result.ok ? "saved" : "retryFailed"));
              if (result.ok) router.refresh();
            } catch {
              setMessage(pc(locale, "retryFailed"));
            }
          })
        }
      >
        {pc(locale, busy ? "sending" : "retry")}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
