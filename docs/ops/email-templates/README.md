# Steppe email templates — the house style

Every transactional email Steppe sends shares **one shell**:
[`steppe/lib/email-shell.mjs`](../../../steppe/lib/email-shell.mjs) — cream paper card,
Besley heading in sage-deep, Schibsted Grotesk body, Martian Mono labels, a sand rule,
and a `Steppe · Redmond, Oregon` footer. Palette matches
`steppe/app/(site)/tokens.css`; type uses the brand trio first with web-safe fallbacks
(email clients don't load webfonts). Table layout + inline styles for Gmail / Outlook /
Apple Mail. Voice is plain and warm — no marketing, no dark patterns.

## Two consumers, one shell

- **In-app** — the `/join` confirmation (`lib/interest-email.ts`) renders the shell and
  sends **multipart** (branded HTML + a plain-text part). Copy is localized (en/es).
- **Supabase auth** — the five `.html` files here are generated from the same shell.

## Supabase auth templates

Regenerate any time the shell or copy changes:

```bash
node docs/ops/email-templates/generate.mjs
```

Then paste each into **Supabase → Authentication → Email Templates**, and set the subject:

| File | Supabase template | Subject | Token used |
|---|---|---|---|
| `magic-link.html` | Magic Link | `Your Steppe sign-in link` | `{{ .ConfirmationURL }}` |
| `confirm-signup.html` | Confirm signup | `Confirm your Steppe email` | `{{ .ConfirmationURL }}` |
| `invite.html` | Invite user | `You're invited to Steppe` | `{{ .ConfirmationURL }}` |
| `email-change.html` | Change Email Address | `Confirm your new Steppe email` | `{{ .ConfirmationURL }}` |
| `reauthentication.html` | Reauthentication | `Your Steppe confirmation code` | `{{ .Token }}` |

*(No "Reset Password" template — Steppe is passwordless / magic-link.)*

## Changing an email

Edit the copy in `generate.mjs` (auth) or `steppe/messages/{en,es}.json` →
`interestEmail` (the `/join` confirmation). Never edit a generated `.html` by hand —
edit the shell or `generate.mjs` and re-run, so all emails stay in sync.

## Why HTML *and* text

The plain-text part keeps deliverability high and covers clients that don't render
HTML; the HTML part carries the brand. The button always has a copy-paste fallback URL
beneath it, and every email starts with a hidden preheader (the inbox preview line).
