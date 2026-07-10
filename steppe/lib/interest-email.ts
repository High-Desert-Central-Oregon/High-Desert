// Provider-isolated transactional send for the /join interest-signup confirmation.
//
// Unlike lib/contact.ts (which delivers a member's message INTO the org inbox), this
// sends an OUTBOUND confirmation TO the person who just joined the interest list:
// "you're on the list — we'll email you once, when membership opens." Keeping the
// provider behind this one function keeps it swappable (Postmark / SES / Plunk)
// without touching the caller.
//
// Configuration: RESEND_API_KEY (shared with the contact form). The From address
// defaults to the verified steppe.community sender and is overridable via
// INTEREST_FROM; a reply routes to a human via INTEREST_REPLY_TO (default hello@).
// No open/click tracking is enabled here — consistent with the no-behavioral-tracking
// invariant (and tracking stays off at the domain).
//
// The copy is composed by the caller (localized via next-intl) and passed in as a
// heading + plain paragraphs, so this module stays request-agnostic and testable.
// It sends MULTIPART: a plain-text part (the paragraphs) plus the branded HTML shell
// (lib/email-shell.mjs) — the same shell the Supabase auth templates use, so every
// Steppe email looks the same. Plain text keeps deliverability high and covers clients
// that don't render HTML.
//
// Fails gracefully — NEVER throws. A confirmation that can't be sent must never turn
// a successful signup into an error: by the time we're here the interest row is
// already written, and the caller ignores a non-ok result (a missing key in local
// dev, a provider hiccup) and still reports success to the member.
import { renderBrandEmail } from "./email-shell.mjs";

export type InterestEmail = {
  to: string; // the new signup's address
  subject: string;
  heading: string; // the email's H1
  paragraphs: string[]; // body paragraphs (plain text; the caller localizes them)
};

export type SendResult =
  | { ok: true }
  | { ok: false; code: "config" | "send"; error: string };

export async function sendInterestConfirmation(
  email: InterestEmail,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // No key in this environment (e.g. local dev) is an expected, quiet non-send —
  // not an error the member should ever see.
  if (!apiKey) {
    return { ok: false, code: "config", error: "Email delivery is not configured." };
  }

  // A Resend-verified steppe.community sender; replies reach a person, not a void.
  const from = process.env.INTEREST_FROM ?? "Steppe <notify@steppe.community>";
  const replyTo = process.env.INTEREST_REPLY_TO ?? "hello@steppe.community";

  const text = email.paragraphs.join("\n\n");
  const html = renderBrandEmail({
    heading: email.heading,
    paragraphs: email.paragraphs,
    preheader: email.subject,
  });

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from, // SPF/DKIM-aligned steppe.community sender
      to: email.to,
      replyTo,
      subject: email.subject,
      text,
      html,
    });
    if (error) return { ok: false, code: "send", error: "Send failed." };
    return { ok: true };
  } catch {
    return { ok: false, code: "send", error: "Send failed." };
  }
}
