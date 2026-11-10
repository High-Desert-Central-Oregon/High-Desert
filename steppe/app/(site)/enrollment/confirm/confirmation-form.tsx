"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
export function ConfirmationForm({ token }: { token: string }) {
  const t = useTranslations("enrollment");
  const [state, setState] = useState<"ready" | "pending" | "done" | "error">(
    "ready",
  );
  const [removeUrl, setRemoveUrl] = useState<string | null>(null);
  async function confirm() {
    setState("pending");
    try {
      const response = await fetch("/api/enrollment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error("confirmation unavailable");
      setRemoveUrl(data.removeUrl ?? null);
      setState("done");
    } catch {
      setState("error");
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">
        {t(state === "done" ? "confirmed" : "heading")}
      </h1>
      {state === "done" ? (
        <>
          <p>{t(removeUrl ? "confirmedBody" : "confirmedInterestBody")}</p>
          {removeUrl && (
            <a className="underline underline-offset-4" href={removeUrl}>
              {t("remove")}
            </a>
          )}
        </>
      ) : (
        <>
          <p>{t("pageBody")}</p>
          <button
            className="rounded-md border px-5 py-3"
            disabled={!token || state === "pending"}
            onClick={confirm}
          >
            {t(state === "pending" ? "pending" : "button")}
          </button>
          {(!token || state === "error") && <p role="alert">{t("error")}</p>}
        </>
      )}
    </div>
  );
}
