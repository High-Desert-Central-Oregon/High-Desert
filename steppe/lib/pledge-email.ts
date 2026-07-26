/**
 * Provider-isolated transactional send for the neighborhood pledge confirmation.
 *
 * Sibling of lib/interest-email.ts rather than a parameter on it, because the
 * SENDER IDENTITY differs and that is the point. The /join confirmation comes
 * from "Steppe <notify@steppe.community>" — an organization telling you that you
 * are on a list. This comes from "Greg Chism <greg@steppe.community>" and is
 * signed with a personal name, because a pledge is a person in your
 * neighborhood asking you to bring three doors with you. greg@ is a human-facing
 * alias, not a queue: a reply reaches a person, so replyTo is the same address.
 *
 * Copy: docs/decisions/steppe-momentum-pack-v1.2.md § 7, rendered through the
 * shared brand shell (lib/email-shell.mjs) so every Steppe email looks the same.
 * Multipart — a plain-text part carrying both URLs in full, plus the HTML shell.
 *
 * Configuration: RESEND_API_KEY (shared with the contact + interest senders).
 * PLEDGE_FROM overrides the sender. No open/click tracking, consistent with the
 * no-behavioral-tracking invariant.
 *
 * Fails gracefully — NEVER throws. By the time this runs the pledge row is
 * already written and the HTTP response has already been sent; a provider
 * hiccup or a missing key in local dev must not turn a recorded pledge into an
 * error the neighbor sees.
 */
import { renderBrandEmail } from "./email-shell.mjs";

export type PledgeEmail = {
  /** The new pledger's address. */
  to: string;
  subject: string;
  /** The email's H1. */
  heading: string;
  /** Body paragraphs, already localized by the caller. */
  paragraphs: string[];
  /** The neighborhood's public page — what the pledger forwards to three doors. */
  shareUrl: string;
  shareLabel: string;
  /** Token-bearing removal link. Opens a confirmation page; never deletes on GET. */
  removeUrl: string;
  removeLabel: string;
  /** Small print under the divider. */
  privacyNote: string;
};

export type SendResult =
  | { ok: true }
  | { ok: false; code: "config" | "send"; error: string };

export async function sendPledgeConfirmation(
  email: PledgeEmail,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // No key in this environment (local dev) is an expected, quiet non-send.
  if (!apiKey) {
    return {
      ok: false,
      code: "config",
      error: "Email delivery is not configured.",
    };
  }

  // A Resend-verified steppe.community sender. Personal name, human alias.
  const from = process.env.PLEDGE_FROM ?? "Greg Chism <greg@steppe.community>";

  // The plain-text part spells both URLs out in full: it is the part that
  // survives every client, and a share link the reader cannot copy is useless.
  const text = [
    ...email.paragraphs,
    `${email.shareLabel}: ${email.shareUrl}`,
    `${email.removeLabel}: ${email.removeUrl}`,
    email.privacyNote,
  ].join("\n\n");

  const html = renderBrandEmail({
    heading: email.heading,
    paragraphs: email.paragraphs,
    // The share link is the ask, so it gets the button. Removal is a demoted
    // text link — present and plainly worded on every send, never competing
    // with the CTA and never buried in grey 9px type either.
    action: { url: email.shareUrl, label: email.shareLabel },
    textLink: { url: email.removeUrl, label: email.removeLabel },
    securityNote: email.privacyNote,
    preheader: email.subject,
  });

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: email.to,
      replyTo: from,
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
