"use client";

import { useState } from "react";

/**
 * Contact form card for /contact (design: _design-source/steppe-contact.html).
 * The design's client-only success is a stand-in; here the form POSTs to the real
 * /api/contact route, which emails hello@steppe.community via Resend (email-only,
 * nothing stored). On failure it surfaces the error and points to the direct
 * mailto: fallback. The `company` field is a honeypot.
 */
type Status = "idle" | "submitting" | "success" | "error";

const TOPICS = [
  "General question",
  "Partnership or funding",
  "Press or media",
  "Privacy",
  "Something else",
];

export function ContactForm() {
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
        setError(data.error || "Could not send your message.");
        setStatus("error");
      }
    } catch {
      setError("Couldn't reach the server.");
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
          <h2>Message sent.</h2>
          <p>
            Thanks for reaching out. We&rsquo;ll reply to the email you gave us as
            soon as we can.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="formcard" id="contact-card">
      <form onSubmit={handleSubmit} noValidate>
        <div className="fk">Send a message</div>
        <h2>Tell us what&rsquo;s on your mind.</h2>
        <p className="fsub">
          Fill in a few details and we&rsquo;ll reply to the email you give us.
        </p>

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
          <label htmlFor="nm">Name</label>
          <input id="nm" name="name" type="text" required placeholder="Your name" autoComplete="name" />
        </div>
        <div className="frow">
          <label htmlFor="em">Email</label>
          <input id="em" name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="frow">
          <label htmlFor="tp">Topic</label>
          <select id="tp" name="topic" defaultValue={TOPICS[0]}>
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="frow">
          <label htmlFor="msg">Message</label>
          <textarea
            id="msg"
            name="message"
            required
            placeholder="What would you like to tell us?"
          />
        </div>

        <button className="submitb" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Send message"}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {status === "error" && (
          <p className="formerr" role="alert">
            {error} You can{" "}
            <a href="mailto:hello@steppe.community">email us directly</a> instead.
          </p>
        )}

        <p className="formnote">
          We&rsquo;ll only use your message to reply, and for nothing else. See our{" "}
          <a href="/privacy">privacy commitments</a>.
        </p>
      </form>
    </div>
  );
}
