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
| Storage bucket (0016) | ✅ applied on prod (founder, 2026-07-10); staging rehearsal green — private, MIME/size limits, both policies. **Verify-then-forget proven**: service-role upload of an allowed type succeeds, a disallowed MIME is rejected, anon read is denied (no leak), and a service-role delete removes the object. |
| Scheduled close | ✅ rehearsed — `close_due_proposals()` closes a past-window proposal and writes the aggregate audit; `pg_cron` confirmed installable on the Postgres image |
| Auth SMTP / cohort / flip | ⏳ pending — see steps 3, 5, 7 |

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
Supabase → **Authentication → Providers → Email**: ensure enabled.
**Authentication → Emails → SMTP Settings** → enable **Custom SMTP** (Resend):
- Host `smtp.resend.com` · Port `465` (SSL) or `587` (TLS)
- Username `resend` · Password = your **`RESEND_API_KEY`**
- Sender `notify@steppe.community` (a Resend-verified domain sender) · Sender name `Steppe`

**Authentication → URL Configuration:**
- Site URL: `https://www.steppe.community`
- Redirect URLs (allow-list): `https://www.steppe.community/**`

Why SMTP: Supabase's built-in mailer is rate-limited (a few/hour) — fine for a test,
not a cohort. Resend removes the cap and gives deliverability (SPF/DKIM already set for
the funnel email).
- Verify: request a magic link in prod → arrives (inbox, not spam) → login works (step 8).

### 4. 🔧 Scheduled proposal close (pg_cron)
In the Supabase SQL editor (rehearsal confirmed both steps work):
```sql
create extension if not exists pg_cron;
select cron.schedule('close-due-proposals', '* * * * *',
                     $$select public.close_due_proposals();$$);
```
*(Optional for launch — a moderator can close manually; the trigger audits either path
exactly once.)*
- Verify: `select jobname, schedule from cron.job where jobname = 'close-due-proposals';`

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

## Rehearsal log — 2026-07-10 (local staging mirror)

Ran the go-live-specific checks the pure-SQL dry-run couldn't cover, on the local
Supabase stack (schema + `0016` + seed):

| Rehearsed | Result |
|---|---|
| `0016` apply | ✅ clean + idempotent; bucket private, 10 MB / 5 MIME types, both policies |
| Storage **verify-then-forget** | ✅ service-role upload (allowed type) → 200; disallowed MIME → 400; anon read → denied; service-role delete → object row gone |
| Scheduled close | ✅ `close_due_proposals()` closed a past-window proposal + wrote the aggregate audit; `pg_cron` installs on the image |
| Full invariant dry-run (A–D + extended) | ✅ green earlier this session (`dry-run-report-2026-07-08.md`) |

**Not rehearsable locally** (verify in prod at step 8): real magic-link SMTP round trip
(needs Resend + a real inbox) and the Vercel `LAUNCH_PHASE` flip. The *code/DB/storage*
paths behind them are proven.

## Rollback (instant, no data loss)

The gate is **env-only**. If anything looks wrong after step 7:
set **`LAUNCH_PHASE=prelaunch`** in Vercel → redeploy → the member app re-gates on the
next request. Nothing is deleted; members simply can't reach `/protected` until you
flip back.

- Verify rollback: `/protected` → 307 → `/` again.

---

*Living document. The flip itself is one env var; the discipline is everything before it.*
