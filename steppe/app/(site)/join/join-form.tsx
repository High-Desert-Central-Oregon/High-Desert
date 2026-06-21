"use client";

import { useState } from "react";

/**
 * Interest-signup form card for /join (design: _design-source/steppe-join.html).
 * The design's client-only success state is a stand-in; here the form POSTs to the
 * real /api/interest endpoint (service-role insert into interest_signups) and only
 * shows the confirmation once the server accepts it.
 *
 * Field mapping to the existing /api/interest contract (kept unchanged):
 *   email        → email (required)
 *   name         → first_name (optional)
 *   neighborhood → in_area: true when provided (the schema has no free-text
 *                  neighborhood column; a Redmond-area neighborhood signals
 *                  in-area, the closest existing field)
 *   consent      → true, implied by submitting under the visible privacy notice
 *                  (the v-join design has no checkbox)
 *   company      → honeypot (visually hidden); a filled value is dropped server-side
 */
type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

export function JoinForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

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
      <div className="formcard" id="join-form">
        <div className="success" role="status">
          <div className="ck">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12l4 4 10-10" stroke="#6E8A5B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>
            {status === "duplicate" ? "You're already on the list." : "You're on the list."}
          </h2>
          <p>
            {status === "duplicate"
              ? "We already have your email, so we'll reach out the moment membership opens in Redmond."
              : "We'll email you the moment membership opens in Redmond. We're glad you're here."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="formcard" id="join-form">
      <form onSubmit={handleSubmit} noValidate>
        <div className="fk">Opening in Redmond soon</div>
        <h2>Get on the list.</h2>
        <p className="fsub">
          We&rsquo;re getting Steppe ready to open in Redmond. Leave your email and
          we&rsquo;ll tell you the moment it does. And don&rsquo;t worry, we will
          scale to all of Central Oregon.
        </p>
        <div className="frow">
          <label htmlFor="em">Email</label>
          <input id="em" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="frow">
          <label htmlFor="nm">
            Name <span className="opt">Optional</span>
          </label>
          <input id="nm" name="name" type="text" placeholder="First name" autoComplete="given-name" />
        </div>
        <div className="frow">
          <label htmlFor="nb">
            Neighborhood <span className="opt">Optional</span>
          </label>
          <input id="nb" name="neighborhood" type="text" placeholder="e.g. SE Redmond" />
        </div>

        {/* Honeypot — real people leave this empty. */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <button className="submitb" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Joining…" : "Join the list"}
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
          We&rsquo;ll only use your email to let you know when Steppe opens, and for
          nothing else. Our <a href="/privacy">privacy commitments</a> spell out
          the rest.
        </p>
      </form>
    </div>
  );
}
