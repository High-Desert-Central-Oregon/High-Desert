// Provider-isolated transactional send for the /contact form.
//
// hello@steppe.community is a Protonmail inbox that can't easily send from a
// serverless app, so the form delivers THROUGH a transactional provider (Resend)
// that drops the message into that inbox. Keep the provider behind this single
// function so it stays swappable (Postmark / SES / Plunk) without touching callers.
//
// Privacy posture: email-only. The message is delivered to the inbox and is NOT
// stored in the app DB ("collect the minimum, nothing just in case"). It transits
// Resend and is encrypted at rest by Proton in the inbox.
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
  const to = process.env.CONTACT_TO;
  const from = process.env.CONTACT_FROM;

  // Missing config (e.g. RESEND_API_KEY not set yet) is a clean, expected failure
  // so the UI can point the user at the direct mailto: fallback.
  if (!apiKey || !to || !from) {
    return { ok: false, code: "config", error: "Email delivery is not configured yet." };
  }

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
      from, // a Resend-verified sending domain (SPF/DKIM aligned), e.g. notify@steppe.community
      to, // hello@steppe.community (the Protonmail inbox)
      replyTo: input.email, // "reply" in Proton reaches the submitter directly
      subject,
      text,
    });
    if (error) return { ok: false, code: "send", error: "Could not send your message." };
    return { ok: true };
  } catch {
    return { ok: false, code: "send", error: "Could not send your message." };
  }
}
