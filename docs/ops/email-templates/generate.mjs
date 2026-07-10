// Generates the Supabase auth email templates from the canonical brand shell
// (steppe/lib/email-shell.mjs) — so every Steppe email shares one design.
// Run from anywhere:  node docs/ops/email-templates/generate.mjs
// Then paste each .html into Supabase → Authentication → Email Templates.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderBrandEmail } from "../../../steppe/lib/email-shell.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));
const URL = "{{ .ConfirmationURL }}"; // Supabase token for the action link
const CODE = "{{ .Token }}"; // Supabase token for a numeric code

// Each entry is a Supabase auth email type. Copy is plain Steppe voice.
const templates = {
  "magic-link": {
    heading: "Your sign-in link",
    paragraphs: ["Tap the button below to sign in to Steppe. The link works once and expires soon."],
    action: { url: URL, label: "Sign in to Steppe" },
    securityNote:
      "If you didn't try to sign in, you can ignore this email. Nothing will happen, and no one can sign in without this link.",
    preheader: "Your one-time sign-in link for Steppe.",
  },
  "confirm-signup": {
    heading: "Confirm your email",
    paragraphs: [
      "Welcome to Steppe. Tap the button below to confirm this email address and finish setting up your account.",
    ],
    action: { url: URL, label: "Confirm email" },
    securityNote: "If you didn't create a Steppe account, you can ignore this email.",
    preheader: "Confirm your email to finish joining Steppe.",
  },
  invite: {
    heading: "You're invited to Steppe",
    paragraphs: [
      "Someone invited you to Steppe, a community-owned civic space for verified Redmond neighbors. Tap the button below to accept and set up your account.",
    ],
    action: { url: URL, label: "Accept invitation" },
    securityNote: "If this wasn't meant for you, you can ignore this email.",
    preheader: "You've been invited to join Steppe.",
  },
  "email-change": {
    heading: "Confirm your new email",
    paragraphs: [
      "Tap the button below to confirm this as the new email for your Steppe account. The link works once and expires soon.",
    ],
    action: { url: URL, label: "Confirm new email" },
    securityNote:
      "If you didn't ask to change your email, ignore this and your address stays the same. It may be worth signing in to check your account.",
    preheader: "Confirm your new email for Steppe.",
  },
  reauthentication: {
    heading: "Your confirmation code",
    paragraphs: ["Enter this code to confirm it's you. It expires shortly."],
    code: CODE,
    securityNote: "If you didn't request this, you can ignore it.",
    preheader: "Your Steppe confirmation code.",
  },
};

for (const [name, opts] of Object.entries(templates)) {
  writeFileSync(join(OUT, `${name}.html`), renderBrandEmail(opts) + "\n");
  console.log(`wrote ${name}.html`);
}
