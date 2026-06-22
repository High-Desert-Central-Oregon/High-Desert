"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Contact form card for /contact. POSTs to the real /api/contact route (emails
 * hello@steppe.community via Resend, email-only). On failure it surfaces the error
 * and points to the mailto: fallback. The `company` field is a honeypot. Copy is
 * localized from the "contact" namespace; topic option VALUES stay English so the
 * route's topic validation contract is unchanged (only the labels are localized).
 */
type Status = "idle" | "submitting" | "success" | "error";

const TOPICS: { value: string; key: string }[] = [
  { value: "General question", key: "topicGeneral" },
  { value: "Partnership or funding", key: "topicPartnership" },
  { value: "Press or media", key: "topicPress" },
  { value: "Privacy", key: "topicPrivacy" },
  { value: "Something else", key: "topicOther" },
];

export function ContactForm() {
  const t = useTranslations("contact");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    setStatus("submitting");
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          topic: String(fd.get("topic") ?? ""),
          message: String(fd.get("message") ?? ""),
          company: String(fd.get("company") ?? ""), // honeypot
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok) {
        setStatus("success");
      } else {
        setError(data.error || t("errGeneric"));
        setStatus("error");
      }
    } catch {
      setError(t("errNetwork"));
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="formcard" id="contact-card">
        <div className="success" role="status">
          <div className="ck">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12l4 4 10-10" stroke="#6E8A5B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>{t("successH")}</h2>
          <p>{t("successP")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="formcard" id="contact-card">
      <form onSubmit={handleSubmit} noValidate>
        <div className="fk">{t("formKicker")}</div>
        <h2>{t("formH")}</h2>
        <p className="fsub">{t("fsub")}</p>

        {/* Honeypot — real people leave this empty. */}
        <input
          className="hp"
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div className="frow">
          <label htmlFor="nm">{t("labelName")}</label>
          <input id="nm" name="name" type="text" required placeholder={t("phName")} autoComplete="name" />
        </div>
        <div className="frow">
          <label htmlFor="em">{t("labelEmail")}</label>
          <input id="em" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="frow">
          <label htmlFor="tp">{t("labelTopic")}</label>
          <select id="tp" name="topic" defaultValue={TOPICS[0].value}>
            {TOPICS.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {t(topic.key)}
              </option>
            ))}
          </select>
        </div>
        <div className="frow">
          <label htmlFor="msg">{t("labelMessage")}</label>
          <textarea id="msg" name="message" required placeholder={t("phMessage")} />
        </div>

        <button className="submitb" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? t("submitting") : t("submit")}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {status === "error" && (
          <p className="formerr" role="alert">
            {error}{" "}
            {t.rich("errMail", {
              link: (c) => <a href="mailto:hello@steppe.community">{c}</a>,
            })}
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
