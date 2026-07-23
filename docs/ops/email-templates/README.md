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

| File | Supabase template | Subject | Link/token form |
|---|---|---|---|
| `magic-link.html` | Magic Link | `{{ .Token }} is your Steppe sign-in code` | code-first: `{{ .Token }}` hero + labeled `…&type=magiclink` text link |
| `confirm-signup.html` | Confirm signup | `Confirm your Steppe email` | `…&type=signup` |
| `invite.html` | Invite user | `You're invited to Steppe` | `…&type=invite` |
| `email-change.html` | Change Email Address | `Confirm your new Steppe email` | `…&type=email_change&next=/protected/account` |
| `reauthentication.html` | Reauthentication | `Your Steppe confirmation code` | `{{ .Token }}` (6-digit code, no link) |

*(No "Reset Password" template — Steppe is passwordless / magic-link.)*

> **Why `{{ .TokenHash }}`, not `{{ .ConfirmationURL }}`.** The app verifies links in
> `app/auth/confirm/route.ts` with `verifyOtp({ token_hash, type })` (the Supabase SSR
> pattern), so every link must point at **our own** `/auth/confirm` carrying
> `token_hash` + the matching `type`. `{{ .ConfirmationURL }}` instead points at
> Supabase's hosted verifier and returns a `?code=` the route can't consume — the cause
> of the "Email link is invalid or has expired" bounce to the site root. Regenerate with
> `node docs/ops/email-templates/generate.mjs`; never hand-edit the `.html`.

> **Why the magic-link email is code-first (and bilingual).** Tapping the emailed link
> from Gmail or Proton opens the email app's **in-app webview**: the session lands
> there — never in the member's real browser — and the verification file picker is
> dead. So the 6-digit `{{ .Token }}` is the hero: the member types it on the sign-in
> page they already have open (`verifyEmailCode` in `app/auth/login/actions.ts`), and
> the link survives only as a short **labeled** text link — the raw URL is never
> printed, because a giant URL invites exactly the tap we're steering away from. The
> body is EN·ES in one template: Supabase offers **one template per auth type** (no
> per-locale variants); a `{{ if eq .Data.locale … }}` Go-template conditional exists
> but keys on signup-time metadata (drifts from the member's current language) and its
> quoted literals don't survive the shell's HTML escaper — both languages, always, is
> deterministic. When pasting, also confirm in the dashboard: **OTP length = 6** and
> the **email OTP expiry** (Auth → Providers → Email), and set the subject from the
> table above (the code in the subject means the inbox notification alone is enough).

## Changing an email

Edit the copy in `generate.mjs` (auth) or `steppe/messages/{en,es}.json` →
`interestEmail` (the `/join` confirmation). Never edit a generated `.html` by hand —
edit the shell or `generate.mjs` and re-run, so all emails stay in sync.

## Why HTML *and* text

The plain-text part keeps deliverability high and covers clients that don't render
HTML; the HTML part carries the brand. Emails with a button keep a copy-paste fallback
URL beneath it; the code-first magic-link email deliberately has no raw URL (see
above). Every email starts with a hidden preheader (the inbox preview line) — the
magic-link preheader carries the code itself, so the notification preview alone can
sign a member in.
