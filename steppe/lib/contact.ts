// Provider-isolated transactional send for the /contact form.
//
// The form delivers THROUGH a transactional provider (Resend) that drops the
// message into the hello@steppe.community inbox. Keep the provider behind this
// single function so it stays swappable (Postmark / SES / Plunk) without touching
// callers.
//
// Configuration: only RESEND_API_KEY is required (it's set in the deploy env). The
// from/to addresses default to the verified steppe.community sender + inbox and are
// overridable via CONTACT_FROM / CONTACT_TO. We do NOT enable Resend open/click
// tracking — no tracking options are passed here (and it stays off at the domain).
//
// Privacy posture: email-only. The message is delivered to the inbox and is NOT
// stored in the app DB ("collect the minimum, nothing just in case"). It transits
// Resend; nothing about it is persisted by Steppe.
//
// Fails gracefully — never throws — so the route + UI can fall back to mailto:.
export type ContactInput = {
  name: string;
  email: string;
  topic: string;
  message: string;
};

export type SendResult =
  | { ok: true }
  | { ok: false; code: "config" | "send"; error: string };

export async function sendContactEmail(input: ContactInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // Missing RESEND_API_KEY is a clean, expected failure so the UI can point the
  // user at the direct mailto: fallback.
  if (!apiKey) {
    return { ok: false, code: "config", error: "Email delivery is not configured yet." };
  }

  // A Resend-verified steppe.community sender, and the inbox to deliver to.
  const from = process.env.CONTACT_FROM ?? "Steppe <hello@steppe.community>";
  const to = process.env.CONTACT_TO ?? "hello@steppe.community";

  const subject = `[Contact · ${input.topic}] ${input.name}`;
  const text = [
    `Name:  ${input.name}`,
    `Email: ${input.email}`,
    `Topic: ${input.topic}`,
    "",
    input.message,
  ].join("\n");

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from, // a Resend-verified steppe.community sender (SPF/DKIM aligned)
      to, // hello@steppe.community
      replyTo: input.email, // replying to the delivered mail reaches the submitter directly
      subject,
      text,
    });
    if (error) return { ok: false, code: "send", error: "Could not send your message." };
    return { ok: true };
  } catch {
    return { ok: false, code: "send", error: "Could not send your message." };
  }
}
