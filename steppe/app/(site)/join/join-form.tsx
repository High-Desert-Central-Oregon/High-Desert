"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Interest-signup form card for /join. POSTs to the real /api/interest endpoint
 * (service-role insert into interest_signups) and shows the confirmation only once
 * the server accepts it. Copy is localized from the "join" catalog namespace.
 *
 * Field mapping to the unchanged /api/interest contract: email → email; name →
 * first_name; neighborhood → in_area (true when provided); consent → true (implied
 * by submitting under the visible privacy notice); company → honeypot.
 */
type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

// QR A/B counter (first-party, zero-PII; see /api/qr). The printed pre-launch QR
// codes carry ?utm_content=quiet|square. We count an aggregate scan on arrival and
// an aggregate join on conversion — nothing identifying is ever sent.
const isQrVariant = (v: string | null): v is "quiet" | "square" =>
  v === "quiet" || v === "square";

// Fire-and-forget: must never block render or surface an error to the member.
function postQrCount(variant: "quiet" | "square", kind: "scan" | "join") {
  try {
    void fetch("/api/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant, kind }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
}

export function JoinForm() {
  const t = useTranslations("join");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  // QR scan count, on mount: when a printed QR lands here with
  // ?utm_content=quiet|square, record ONE scan per scan-session (sessionStorage
  // dedupes refreshes) and remember the variant for the conversion event below.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const variant = new URLSearchParams(window.location.search).get(
        "utm_content",
      );
      if (!isQrVariant(variant)) return;
      const flag = `qr_scan_${variant}`;
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
      sessionStorage.setItem("qr_variant", variant);
      postQrCount(variant, "scan");
    } catch {
      /* sessionStorage / URL unavailable — skip silently */
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    const neighborhood = String(fd.get("neighborhood") ?? "").trim();

    setStatus("submitting");
    setError("");

    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") ?? ""),
          first_name: String(fd.get("name") ?? ""),
          in_area: neighborhood !== "" ? true : null,
          consent: true,
          company: String(fd.get("company") ?? ""), // honeypot
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        duplicate?: boolean;
        error?: string;
      };

      if (res.ok && data.ok) {
        setStatus(data.duplicate ? "duplicate" : "success");
        // QR A/B conversion — same session as the scan; aggregate only, and
        // wrapped so an analytics failure can never break the join.
        try {
          const variant = sessionStorage.getItem("qr_variant");
          if (isQrVariant(variant)) postQrCount(variant, "join");
        } catch {
          /* never break the join over analytics */
        }
      } else {
        setError(data.error || t("errGeneric"));
        setStatus("error");
      }
    } catch {
      setError(t("errNetwork"));
      setStatus("error");
    }
  }

  if (status === "success" || status === "duplicate") {
    return (
      <div className="formcard" id="join-form">
        <div className="success" role="status">
          <div className="ck">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12l4 4 10-10" stroke="#6E8A5B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>{status === "duplicate" ? t("dupH") : t("successH")}</h2>
          <p>{status === "duplicate" ? t("dupP") : t("successP")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="formcard" id="join-form">
      <form onSubmit={handleSubmit} noValidate>
        <div className="fk">{t("formKicker")}</div>
        <h2>{t("formH")}</h2>
        <p className="fsub">{t("fsub")}</p>
        <div className="frow">
          <label htmlFor="em">{t("labelEmail")}</label>
          <input id="em" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="frow">
          <label htmlFor="nm">
            {t("labelName")} <span className="opt">{t("optional")}</span>
          </label>
          <input id="nm" name="name" type="text" placeholder={t("phName")} autoComplete="given-name" />
        </div>
        <div className="frow">
          <label htmlFor="nb">
            {t("labelNeighborhood")} <span className="opt">{t("optional")}</span>
          </label>
          <input id="nb" name="neighborhood" type="text" placeholder={t("phNeighborhood")} />
        </div>

        {/* Honeypot — real people leave this empty. */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <button className="submitb" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? t("submitting") : t("submit")}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {status === "error" && (
          <p className="formerr" role="alert">
            {error}
          </p>
        )}

        <p className="formnote">
          {t.rich("formnote", {
            link: (c) => <a href="/privacy">{c}</a>,
          })}
        </p>
      </form>
    </div>
  );
}
