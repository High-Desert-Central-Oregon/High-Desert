// Provider-isolated mail renderer for the bounded public-enrollment worker.
// Failed sends return an explicit result; the durable queue keeps retry state.
// Possession links use the branded multipart shell without open/click tracking.
import { renderBrandEmail } from "./email-shell.mjs";

export type InterestEmail = {
  to: string; // address receiving the possession challenge
  subject: string;
  heading: string; // the email's H1
  paragraphs: string[]; // body paragraphs (plain text; the caller localizes them)
  action?: { url: string; label: string };
  idempotencyKey?: string;
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
    return {
      ok: false,
      code: "config",
      error: "Email delivery is not configured.",
    };
  }

  // A Resend-verified steppe.community sender; replies reach a person, not a void.
  const from = process.env.INTEREST_FROM ?? "Steppe <notify@steppe.community>";
  const replyTo = process.env.INTEREST_REPLY_TO ?? "hello@steppe.community";

  const text = [
    ...email.paragraphs,
    ...(email.action ? [`${email.action.label}: ${email.action.url}`] : []),
  ].join("\n\n");
  const html = renderBrandEmail({
    heading: email.heading,
    paragraphs: email.paragraphs,
    preheader: email.subject,
    action: email.action,
  });

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from, // SPF/DKIM-aligned steppe.community sender
        to: email.to,
        replyTo,
        subject: email.subject,
        text,
        html,
      },
      { idempotencyKey: email.idempotencyKey },
    );
    if (error) return { ok: false, code: "send", error: "Send failed." };
    return { ok: true };
  } catch {
    return { ok: false, code: "send", error: "Send failed." };
  }
}
