# Launch checklist — Steppe

The production go-live sequence: the ops/env/deploy **steps** and the **tests** that
prove each one, in the order they must happen. This is the complement to
[`dry-run-runbook.md`](./dry-run-runbook.md) — that document is the deep *invariant*
harness for the member app (verification, secret ballot, tenure weight, append-only,
moderation/appeal, groups scoping); this one is the *operational* checklist that gets
Steppe from a green build to real neighbors using it.

> **The golden rule (GTM plan, hard dependency):** the funnel must work end-to-end
> *before* any public push. Marketing into a dead form burns the warmest contacts
> first. Fix the pipe, then open the tap.

## The two gates at a glance

Launch happens in two stages, gated by `LAUNCH_PHASE` (`lib/supabase/proxy.ts`):

| Gate | Trigger | What opens | Blocking on |
|---|---|---|---|
| **Gate 0 — public push** | drive traffic to `/join` | `LAUNCH_PHASE=prelaunch` (default): landing + `/partners` + `/preview` + `/join` + `/contact` only | funnel live (DB write + confirmation email) |
| **Gate 1 — app un-gate** | flip `LAUNCH_PHASE=live` | the member app (`/auth/*`, `/protected/*`) — closed beta, Oct–Nov 2026 | full DB + auth + legal + cohort |

Everything not on the prelaunch allowlist (including `/auth/*` and `/protected/*`)
redirects to the landing until `LAUNCH_PHASE=live`. So Gate 0 is safe to ship with the
member app still built-but-dormant.

## Automated gates (run on every deploy)

There is no unit/e2e test runner in the repo today — the checks below plus the manual
scripts in each gate are the suite. From `steppe/`:

- [ ] `npm run build` — Next production build. Runs **type-checking + lint + compile**; a
      failure here blocks deploy. (Vercel runs this off the GitHub mirror.)
- [ ] `npm run lint` — ESLint (also folded into `build`, but fast to run alone).
- [ ] *(optional, worth adding before Gate 1)* a scripted RLS smoke test so the dry-run
      runbook's core refusals run in CI rather than by hand.

---

## Gate 0 — before the public push

State: `LAUNCH_PHASE=prelaunch`. The member app stays dormant; only the marketing
surface + the `/join` interest funnel are reachable. Goal: capture 50–100 interested
people with a working confirmation email.

### Steps (ops + env)

- [ ] **DB has the funnel table.** `interest_signups` (migration `0014`, folded into
      `schema.sql`) exists in the prod project. It is RLS deny-by-default with **no
      policies** — only the service-role client writes it (`/api/interest`).
- [ ] **Resend sending domain verified.** `steppe.community` SPF/DKIM records set (at
      Porkbun) and verified in Resend, so mail from `notify@`/`hello@` isn't spam-foldered.
- [ ] **Prod env vars set** (Vercel project settings):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never `NEXT_PUBLIC_`)
  - `RESEND_API_KEY` — **without it the signup still succeeds but no confirmation is sent**
  - `LAUNCH_PHASE=prelaunch`
  - `NEXT_PUBLIC_SITE_URL=https://www.steppe.community` (absolute OG/canonical URLs)
  - *(optional)* `INTEREST_FROM`, `INTEREST_REPLY_TO`, `CONTACT_TO`, `CONTACT_FROM`
- [ ] **Domain + TLS.** `www.steppe.community` resolves to the deploy; certificate valid.
- [ ] **Deploy `main`.** The current commit ships the confirmation email.

### Tests

- [ ] **Happy path (prod).** Submit `/join` with a fresh address → success card → a new
      row lands in `interest_signups` → the confirmation email arrives (check inbox **and**
      spam).
- [ ] **Spanish.** Switch to ES (language toggle sets the `NEXT_LOCALE` cookie) → the form
      *and* the confirmation email arrive in Spanish.
- [ ] **Duplicate.** Resubmit the same address → "already on the list" card, **no second
      email**, no duplicate row.
- [ ] **Honeypot.** `curl` a POST with `company` filled → returns `{ ok: true }`, **no row,
      no email** (bot silently dropped):
      `curl -sX POST $SITE/api/interest -H 'content-type: application/json' -d '{"email":"bot@x.com","consent":true,"company":"x"}'`
- [ ] **Bad input.** Invalid email, or `consent` not `true` → `400`, no row.
- [ ] **Graceful degradation.** On a staging deploy with `RESEND_API_KEY` unset, a signup
      still succeeds with no email — proves a mail failure can't break a signup.
- [ ] **Deliverability.** Send to Gmail + one other provider; "view original" shows
      SPF/DKIM/DMARC = pass; not in spam.
- [ ] **Privacy (no leak).** As an anonymous client, a read of `interest_signups` returns
      nothing (RLS deny). The list is never exposed.
- [ ] **Marketing surface smoke.** Landing, `/join`, `/privacy`, `/contact`, `/partners`,
      `/preview` all load; mobile viewport OK; keyboard-only nav works; the `/contact` form
      delivers to the inbox.

---

## Gate 1 — before the member app un-gates

State to reach: `LAUNCH_PHASE=live`. This opens everything trust-sensitive, so the whole
DB + auth + governance surface must be correct first.

### Steps (DB + auth + ops)

- [ ] **DB fully applied.** On a *fresh* project: `schema.sql` → `migrations/0016` (storage
      bucket) → `seed/documents-terms-privacy-v0.1.sql`. **Do not replay `0001`–`0015`** —
      they're folded into `schema.sql`. (On the already-initialized project, apply only the
      delta: `0016`, plus the documents seed if those rows are still placeholders.)
- [ ] **Storage bucket private.** `verification-evidence` exists, `public = false`, with the
      upload-own-folder + moderators-read policies (migration `0016`). Verify:
      `select id, public from storage.buckets where id = 'verification-evidence';` → `false`.
- [ ] **Auth (magic link).** Supabase Email provider on; **Site URL + redirect URLs** set to
      the prod domain; a real SMTP provider (Resend) wired so magic links aren't rate-limited.
- [ ] **Scheduled proposal close.** `pg_cron` extension enabled and the `cron.schedule(...)`
      for `close_due_proposals()` installed (migration `0010`).
- [ ] **Legal — Terms & Privacy.** Replace the draft `documents` bodies with the
      **legal-reviewed v1.0**. *(Human, blocking — pending counsel; do not present the draft
      as final.)*
- [ ] **Governance config.** Confirm quorum / majority / immutable thresholds and the tenure
      multipliers load from **config**, not hardcoded (provisional, for the cohort to ratify).
- [ ] **Seed the founding cohort** — real, verified members. **Never** load
      `seed/dry-run-accounts.sql` / `seed/dry-run-groups.sql` into prod (synthetic).
- [ ] **First admin + moderators.** `update profiles set role = 'admin' where id = '<uid>';`
- [ ] **Flip `LAUNCH_PHASE=live` and deploy.**

### Tests

- [ ] **Run the full invariant dry-run** — [`dry-run-runbook.md`](./dry-run-runbook.md)
      end-to-end on a staging copy: Walkthroughs A (verification + moderation + appeal +
      transparency), B (tenure-weighted secret vote + revise-before-close), C (hardening
      G1–G5), D (groups scoping G8–G12), and the invariant-coverage matrix. **This is the
      member-app test.**
- [ ] **RLS review closed.** Re-walk [`rls-audit.md`](./rls-audit.md); confirm every finding
      is resolved (A-DB-1, the evidence bucket, is done — migration `0016`).
- [ ] **Verify-then-forget, live.** Submit evidence → a moderator decides via
      `decide_verification()` → confirm the Storage object is **deleted** and
      `profiles.evidence_path` nulled. Nothing persists but `verified` + method.
- [ ] **Magic-link round trip in prod.** Request a link → it arrives → logging in creates the
      `profiles` row → session refresh works through the proxy.
- [ ] **Scheduled close.** Open a short-window proposal; confirm `pg_cron` closes it on time
      and the result shows only via `proposal_results` (closed proposals only).
- [ ] **Data export.** A member can export their own data (member-owned, invariant 8).
- [ ] **Accessibility / Spanish / mobile pass** across the member app (invariant 9): semantic
      HTML, keyboard paths, contrast, es strings present, slow-phone layout.

---

## Human-only / external dependencies (track separately)

These gate the launch but aren't code — start them early:

- **Legal review** of Terms & Privacy → blocks Gate 1.
- **Resend** domain verification + SMTP → Gate 0 confirmation email *and* Gate 1 magic links.
- **DNS + TLS** for `www.steppe.community`.
- **Cohort recruitment + verification** (the founding 50), and the physical launch venue.
- **First-vote design** — the cohort's genuine day-one decision (GTM plan calls this the
  launch's center of gravity).

---

## Reference

**Env vars** — see [`steppe/.env.example`](../steppe/.env.example) and
[`DEPLOYMENT.md`](../DEPLOYMENT.md) §1.
**DB apply order** — see [`docs/SETUP.md`](./SETUP.md) and [`DEPLOYMENT.md`](../DEPLOYMENT.md) §4.
**Prelaunch allowlist** — `steppe/lib/supabase/proxy.ts`.

*Living document. Update it as the launch sequence firms up.*
