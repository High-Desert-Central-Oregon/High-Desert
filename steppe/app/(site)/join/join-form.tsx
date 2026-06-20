"use client";

import { useState } from "react";

/**
 * Pre-launch interest form. Posts to the server-only /api/interest endpoint
 * (which holds the service-role key — never the client) and shows an inline
 * success / already-on-the-list / error state without leaving the page.
 *
 * The `company` field is a honeypot: visually hidden and skipped by keyboard and
 * screen readers, so a real person never fills it. The server drops any
 * submission that does.
 */
type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

export function JoinForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;

    const form = e.currentTarget;
    const fd = new FormData(form);

    setStatus("submitting");
    setError("");

    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") ?? ""),
          first_name: String(fd.get("first_name") ?? ""),
          in_area: fd.get("in_area") === "on",
          consent: fd.get("consent") === "on",
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
        form.reset();
      } else {
        setError(data.error || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success" || status === "duplicate") {
    return (
      <div className="join-done reveal" role="status">
        <p className="join-done-title">
          {status === "success"
            ? "You’re on the list."
            : "You’re already on the list."}
        </p>
        <p className="join-done-body">
          {status === "success"
            ? "We’ll email you when Steppe opens to new members. Nothing else — no ads, no selling your data, ever."
            : "That email is already saved — we’ll be in touch when membership opens. No need to sign up again."}
        </p>
      </div>
    );
  }

  return (
    <form className="join-form reveal" onSubmit={handleSubmit} noValidate>
      <div className="jf-field">
        <label htmlFor="jf-email">
          Email <span className="jf-req">(required)</span>
        </label>
        <input
          id="jf-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      <div className="jf-field">
        <label htmlFor="jf-first">
          First name <span className="jf-opt">(optional)</span>
        </label>
        <input
          id="jf-first"
          name="first_name"
          type="text"
          autoComplete="given-name"
          placeholder="What should we call you?"
        />
      </div>

      <label className="jf-check">
        <input type="checkbox" name="in_area" />
        <span>
          I&rsquo;m in the Redmond / Central Oregon area.{" "}
          <span className="jf-opt">(optional)</span>
        </span>
      </label>

      <label className="jf-check jf-consent">
        <input type="checkbox" name="consent" required />
        <span>
          Email me when Steppe is ready. No ads, no selling your data, ever.
        </span>
      </label>

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div className="jf-hp" aria-hidden="true">
        <label htmlFor="jf-company">Company</label>
        <input
          id="jf-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {status === "error" && (
        <p className="jf-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="jf-submit"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Sending…" : "Keep me posted"}
      </button>

      <p className="jf-fine">
        We store only your email (and name, if you give it) to notify you at
        launch. Read our <a href="/privacy">privacy notice</a>.
      </p>
    </form>
  );
}
