// Generates the Supabase auth email templates from the canonical brand shell
// (steppe/lib/email-shell.mjs) — so every Steppe email shares one design.
// Run from anywhere:  node docs/ops/email-templates/generate.mjs
// Then paste each .html into Supabase → Authentication → Email Templates.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderBrandEmail } from "../../../steppe/lib/email-shell.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));

// IMPORTANT — link form must match the app's verify route.
// app/auth/confirm/route.ts verifies with supabase.auth.verifyOtp({ token_hash, type }),
// i.e. the Supabase SSR "token hash" pattern. So the email must link to OUR OWN
// /auth/confirm with {{ .TokenHash }} + the matching type — NOT {{ .ConfirmationURL }}
// (which points at Supabase's hosted /auth/v1/verify and comes back as ?code=, which
// the route can't consume). Using ConfirmationURL here is what caused the
// "otp_expired / Email link is invalid" bounce to the site root.
// See: https://supabase.com/docs/guides/auth/server-side/nextjs (email templates).
const confirmURL = (type, next = "/protected") =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`;
const CODE = "{{ .Token }}"; // Supabase's numeric one-time code (magic-link, reauthentication)

// Each entry is a Supabase auth email type. Copy is plain Steppe voice.
//
// The magic-link email is CODE-FIRST and bilingual (EN·ES in one body):
//   • The 6-digit {{ .Token }} is the hero. Typing it keeps sign-in in the
//     browser the member already has open; tapping a link from Gmail/Proton
//     instead opens the email app's in-app webview, where the session never
//     reaches the member's real browser and the verify file picker is dead.
//   • The link survives only as a short LABELED text link — no button, and the
//     raw URL is never printed. A giant URL invites exactly the tap we're
//     steering away from.
//   • Bilingual body rather than a {{ if eq .Data.locale … }} conditional:
//     Supabase has ONE template per auth type (no per-locale variants), the
//     metadata locale is frozen at signup (it drifts from the member's current
//     language), and quoted Go-template literals don't survive the shell's
//     HTML escaper. Both languages, always, renders deterministically for
//     every member.
const templates = {
  "magic-link": {
    heading: "Your sign-in code",
    subheading: "Tu código de acceso",
    paragraphs: [
      "Enter this code on the Steppe sign-in page — it's the easiest way in. It works once and expires soon.",
      "Escribe este código en la página de acceso de Steppe — es la forma más fácil de entrar. Funciona una sola vez y caduca pronto.",
    ],
    code: CODE,
    textLink: {
      url: confirmURL("magiclink"),
      label: "Or tap here to sign in · O toca aquí para entrar",
    },
    securityNote:
      "If you didn't try to sign in, you can ignore this email — no one can sign in with the code alone. · Si no intentaste iniciar sesión, puedes ignorar este correo — nadie puede entrar solo con el código.",
    preheader: "{{ .Token }} is your Steppe sign-in code · tu código de acceso a Steppe",
  },
  "confirm-signup": {
    heading: "Confirm your email",
    paragraphs: [
      "Welcome to Steppe. Tap the button below to confirm this email address and finish setting up your account.",
    ],
    action: { url: confirmURL("signup"), label: "Confirm email" },
    securityNote: "If you didn't create a Steppe account, you can ignore this email.",
    preheader: "Confirm your email to finish joining Steppe.",
  },
  invite: {
    heading: "You're invited to Steppe",
    paragraphs: [
      "Someone invited you to Steppe, a community-owned civic commons for verified Redmond neighbors. Tap the button below to accept and set up your account.",
    ],
    action: { url: confirmURL("invite"), label: "Accept invitation" },
    securityNote: "If this wasn't meant for you, you can ignore this email.",
    preheader: "You've been invited to join Steppe.",
  },
  "email-change": {
    heading: "Confirm your new email",
    paragraphs: [
      "Tap the button below to confirm this as the new email for your Steppe account. The link works once and expires soon.",
    ],
    action: { url: confirmURL("email_change", "/protected/account"), label: "Confirm new email" },
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
