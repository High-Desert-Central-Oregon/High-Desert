"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
// lib/pledge-shared, NOT lib/pledge: this is a client component, and lib/pledge
// reaches the database through next/headers.
import {
  remaining,
  thresholdReached,
  pledgePath,
  type NeighborhoodStatus,
} from "@/lib/pledge-shared";
import { StrataColumn } from "./strata-column";

/**
 * The pledge panel: the count, the column, and the one action.
 *
 * A client component that receives the SERVER-FETCHED status as props. React
 * server-renders it, so the number a QR-scanner sees is in the initial HTML and
 * does not wait for hydration — while the count still updates in place after a
 * submission rather than making someone reload a page they just posted to.
 *
 * Three states, and the difference between the last two matters:
 *   forming   — below the threshold; the ask is a pledge.
 *   reached   — at or past the threshold but NOT yet opened. Steppe does not
 *               claim neighbors are already posting here, because a person has
 *               not opened it yet (see neighborhood_status.is_open, invariant 5).
 *   open      — a human recorded the opening; the ask becomes verification.
 */
type Status = "idle" | "submitting" | "done" | "error";

export function PledgePanel({ status }: { status: NeighborhoodStatus }) {
  const t = useTranslations("pledge");

  const [count, setCount] = useState(status.pledgeCount);
  const [stage, setStage] = useState<Status>("idle");
  const [alreadyPledged, setAlreadyPledged] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const { threshold, name, slug, isOpen } = status;
  const left = remaining({ pledgeCount: count, threshold });
  const reached = thresholdReached({ pledgeCount: count, threshold });
  // Shown without a scheme, the way it is printed on the mailer and the yard
  // sign, so the page and the paper read as the same address. The path comes
  // from the shared helper so there is one definition of the printed shape.
  const shareUrl = `steppe.community${pledgePath(slug)}`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (stage === "submitting") return;

    const fd = new FormData(e.currentTarget);
    setStage("submitting");
    setError("");

    try {
      const res = await fetch("/api/pledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          email: String(fd.get("email") ?? ""),
          company: String(fd.get("company") ?? ""), // honeypot
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pledgeCount?: number;
        alreadyPledged?: boolean;
        error?: string;
      };

      if (res.ok && data.ok) {
        if (typeof data.pledgeCount === "number") setCount(data.pledgeCount);
        setAlreadyPledged(Boolean(data.alreadyPledged));
        setStage("done");
      } else {
        setError(data.error || t("errGeneric"));
        setStage("error");
        emailRef.current?.focus();
      }
    } catch {
      setError(t("errNetwork"));
      setStage("error");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`https://${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked or unavailable — the URL is visible and selectable
      // right next to the button, so there is nothing to recover from.
      setCopied(false);
    }
  }

  return (
    <div className="pledge">
      <div className="pledge-wrap">
        <div className="pledge-grid">
          <div className="pledge-col">
            <StrataColumn count={count} threshold={threshold} />
            <p className="pledge-legend">{t("legend")}</p>
          </div>

          <div className="pledge-body">
            <p className="pledge-eyebrow">
              {isOpen ? t("stateOpen") : reached ? t("stateReached") : t("stateForming")}
            </p>

            <h1 className="pledge-title">{name}</h1>

            <p className="pledge-count">
              <span className="pledge-count-n">{count}</span>
              <span className="pledge-count-of">
                {isOpen
                  ? t("countOpen", { threshold })
                  : t("countOf", { threshold })}
              </span>
            </p>

            <p className="pledge-lead">
              {isOpen
                ? t("leadOpen", { neighborhood: name })
                : reached
                  ? t("leadReached", { neighborhood: name, threshold })
                  : t.rich("leadForming", {
                      neighborhood: name,
                      threshold,
                      remaining: left,
                      b: (c) => <strong>{c}</strong>,
                    })}
            </p>

            <div className="pledge-action">
              {stage === "done" ? (
                <div className="pledge-done" role="status">
                  <p className="pledge-done-kicker">
                    {alreadyPledged
                      ? t("doneAlready")
                      : t("doneLayer", { count })}
                  </p>
                  <p className="pledge-done-h">
                    {left > 0
                      ? t("doneRemaining", { remaining: left, neighborhood: name })
                      : t("doneReached", { neighborhood: name })}
                  </p>
                  <p className="pledge-done-p">{t("doneThreeDoors")}</p>

                  <div className="pledge-share">
                    <span className="pledge-share-url">{shareUrl}</span>
                    <button
                      type="button"
                      className="pledge-copy"
                      onClick={handleCopy}
                      data-copied={copied ? "1" : undefined}
                    >
                      {copied ? t("copied") : t("copy")}
                    </button>
                  </div>
                </div>
              ) : isOpen ? (
                <a className="pledge-submit pledge-submit-link" href="/join">
                  {t("ctaVerify")}
                </a>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="pledge-field">
                    <label className="pledge-label" htmlFor="pledge-email">
                      {t("labelEmail")}
                    </label>
                    <div className="pledge-input-row">
                      <input
                        ref={emailRef}
                        id="pledge-email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                        aria-describedby="pledge-privacy"
                        aria-invalid={stage === "error" || undefined}
                      />
                      <button
                        className="pledge-submit"
                        type="submit"
                        disabled={stage === "submitting"}
                      >
                        {stage === "submitting" ? t("submitting") : t("submit")}
                      </button>
                    </div>
                  </div>

                  {/* Honeypot — real people leave this empty. */}
                  <div className="pledge-hp" aria-hidden="true">
                    <label htmlFor="pledge-company">Company</label>
                    <input
                      id="pledge-company"
                      name="company"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  {stage === "error" && (
                    <p className="pledge-error" role="alert">
                      {error}
                    </p>
                  )}

                  <p className="pledge-privacy" id="pledge-privacy">
                    {t("privacy", { neighborhood: name })}
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
