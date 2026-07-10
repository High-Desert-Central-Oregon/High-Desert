# Gate 1 go-live runbook — un-gate the member app

The push-button sequence to take the member app from **prelaunch** to **live**
(`LAUNCH_PHASE=live`). Companion to [`launch-checklist.md`](./launch-checklist.md)
(the full readiness list) and [`dry-run-runbook.md`](../dry-run-runbook.md) (the
invariant harness). **Do not flip until every step below is green.**

## Owners

| Mark | Who | Meaning |
|---|---|---|
| 🤖 | repo / automatable | done in code, or a script/command I can run |
| 👤 | founder | your decision / content (legal, cohort) |
| 🔧 | ops dashboard | Supabase or Vercel console — human hands only |

---

## Readiness snapshot (verified 2026-07-10)

| Area | State |
|---|---|
| App code | ✅ `main` builds clean; **18 tests pass** (`c8c3c07`) |
| Deploy chain | ✅ Vercel auto-deploys `main` via the GitHub mirror; prod serves in **prelaunch** (`/protected`, `/auth/*` → 307 → `/`) |
| Prod DB | ✅ schema applied (35 neighborhoods, 2 `documents`); RLS deny-by-default confirmed against prod (anon can't read/write `interest_signups`, can't read `votes` / base `profiles`) |
| Governance config | ✅ tenure weights centralized + provisional (`vote_weight_for()`); turnout floor provisional (5); **no hardcoded pass/fail thresholds** — outcome is human-read (invariant 5) |
| Terms/Privacy | 🔴 **draft — legal review pending** (counsel packet still in draft) |
| Storage bucket (0016) | ⏳ must verify/apply on prod (owner-only; not observable from outside) |
| Auth SMTP / pg_cron / cohort | ⏳ pending (see steps) |

**Hard blocker:** step 1 (legal). Everything else can be staged behind it.

---

## The sequence

### 1. 🔴 👤 Legal — Terms & Privacy final
Replace the draft `documents` bodies with the **legal-reviewed v1.0**, then re-render
the `/legal/*` pages + the consent-gate copy so all three surfaces match (see the
counsel packet). **This gates the flip** — presenting draft Terms as final is a
liability (per the T&S decision record).
- Verify: the `documents` rows are the reviewed text, not the v0.1 draft.

### 2. 🔧 Apply migration 0016 (verification-evidence bucket) to prod
In the Supabase SQL editor (as owner), run
`migrations/0016_verification_evidence_bucket.sql`. Idempotent; forces the bucket private.
- Verify: `select id, public from storage.buckets where id = 'verification-evidence';` → `public = false`, and the two policies exist on `storage.objects`.

### 3. 🔧 Auth — magic-link SMTP + URLs
Supabase → Authentication: Email provider on; wire **Resend SMTP** (so links aren't
rate-limited); set **Site URL** + **Redirect URLs** to `https://www.steppe.community`.
- Verify: request a magic link in prod → it arrives (inbox, not spam) → login works (step 9 covers the full round trip).

### 4. 🔧 Scheduled proposal close (pg_cron)
Enable the `pg_cron` extension and install the `cron.schedule(...)` for
`close_due_proposals()` (migration `0010`). *(Optional for launch — a moderator can
close manually; the trigger audits either path exactly once.)*
- Verify: `select jobname from cron.job;` shows `close-due-proposals`.

### 5. 👤 🔧 Founding cohort + admins
Seed the **real, verified** founding members. **Never** load
`seed/dry-run-accounts.sql` / `seed/dry-run-groups.sql` into prod (synthetic).
Then: `update profiles set role = 'admin' where id = '<your-auth-uid>';` (+ moderators).
- Verify: the roster is real people; at least one admin + the moderator minimum.

### 6. 🤖 Pre-flip verification (I run / confirm)
- Full invariant **dry-run** on a *staging* copy (`dry-run-runbook.md` A–D) — green this session on local; re-run against a prod-mirror staging DB.
- `rls-audit.md` findings all closed (A-DB-1 = 0016, done).
- `npm run build` + `npm run test` green on the commit being deployed.

### 7. 🔧 Flip the gate
Vercel → project env: set **`LAUNCH_PHASE=live`** → **redeploy** (`LAUNCH_PHASE` is
read at runtime by `lib/supabase/proxy.ts`; a redeploy makes it take effect).
- Verify: `curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://www.steppe.community/protected` → **200** (no longer 307 → `/`).

### 8. 🤖 👤 Post-flip smoke (prod)
- Magic-link login round trip → `profiles` row created → session refresh through the proxy.
- **Verify-then-forget, live:** submit evidence → moderator `decide_verification()` → the Storage object is **deleted** and `profiles.evidence_path` nulled.
- Open a short proposal → vote → close → `proposal_results` reveals only after `closes_at`.
- Data export works; a11y / Spanish / mobile pass on the member surface.

---

## Rollback (instant, no data loss)

The gate is **env-only**. If anything looks wrong after step 7:
set **`LAUNCH_PHASE=prelaunch`** in Vercel → redeploy → the member app re-gates on the
next request. Nothing is deleted; members simply can't reach `/protected` until you
flip back.

- Verify rollback: `/protected` → 307 → `/` again.

---

*Living document. The flip itself is one env var; the discipline is everything before it.*
