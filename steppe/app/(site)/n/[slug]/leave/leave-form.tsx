"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { pledgePath } from "@/lib/pledge-shared";

/**
 * The confirm-and-remove control. One deliberate press, then the address is
 * gone — a hard delete, no tombstone, nothing retained (invariant: verify, then
 * forget, applied to pre-member data).
 *
 * Consequential and irreversible, so it gets a real pause rather than a
 * one-tap: the button states what will happen, and leaving is offered next to a
 * plain way to change your mind (invariant 10). It is not made hard, only
 * deliberate — nothing a member made is held hostage.
 */
type Stage = "idle" | "submitting" | "done" | "error";

export function LeaveForm({
  slug,
  token,
  neighborhood,
}: {
  slug: string;
  token: string;
  neighborhood: string;
}) {
  const t = useTranslations("pledge");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");

  async function handleRemove() {
    if (stage === "submitting") return;
    setStage("submitting");
    setError("");
    try {
      const res = await fetch("/api/pledge/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        setStage("done");
      } else {
        setError(data.error || t("errGeneric"));
        setStage("error");
      }
    } catch {
      setError(t("errNetwork"));
      setStage("error");
    }
  }

  if (stage === "done") {
    // Worded the same whether or not a row existed: an already-removed pledge
    // and a never-existed token produce identical pages, so this is not an
    // oracle for testing guessed tokens. It is also simply true either way.
    return (
      <div role="status">
        <p className="pledge-lead">{t("leaveDone", { neighborhood })}</p>
        <p className="pledge-privacy">{t("leaveDoneNote")}</p>
        <p className="pledge-leave-actions">
          <a href={pledgePath(slug)}>{t("leaveBack", { neighborhood })}</a>
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="pledge-lead">{t("leaveLead", { neighborhood })}</p>

      <div className="pledge-leave-actions">
        <button
          type="button"
          className="pledge-submit"
          onClick={handleRemove}
          disabled={stage === "submitting"}
        >
          {stage === "submitting" ? t("leaveSubmitting") : t("leaveConfirm")}
        </button>
        <a className="pledge-leave-cancel" href={pledgePath(slug)}>
          {t("leaveCancel")}
        </a>
      </div>

      {stage === "error" && (
        <p className="pledge-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
