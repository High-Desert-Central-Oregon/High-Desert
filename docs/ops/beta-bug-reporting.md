# Beta bug reporting

Release preparation, September 14, 2026. Default off. Production activation
requires the database, operator access, retention scheduler, and delivery checks
below; shipping this code does not enable collection.

## Member flow

When `BUG_REPORTS_ENABLED=true`, **Report a bug / Reportar un error** appears on
the right in the shared website/app layout, including sign-in and onboarding.
The mobile button sits above bottom navigation. A keyboard-accessible dialog
preserves the page and accepts a description, optional expected result, and
optional reply email. Anonymous reports cover sign-in problems.

Technical history is explicitly opt-in. It keeps at most 100 events from a
rolling 10-minute window in page-session memory. Opening a report takes a
snapshot the person can inspect and omit. The report draft retains that snapshot
until reset; the live buffer continues recording only while enabled. Stop,
sign-out, account changes, and leaving the page session stop capture. Reloads and
full crashes lose the in-memory history. Nothing streams to a tracking service.

The current event set includes route changes, form submissions, displayed error
notices, generic client exceptions, connectivity changes, verification-upload
outcomes, verification-save failures, and RSVP outcomes. Route identifiers,
tokens, query strings, field values, message text, vote choices, document paths,
raw exception strings, console dumps, and screenshots are excluded. This is a
coarse reproduction aid; it does not reproduce arbitrary application state or
provide full traces, request correlation, attachments, or session replay.

Reports can include browser family/version, OS, viewport, language, installed
mode, connectivity, and the loaded app release. The server separately records its
release and authenticated reporter identity. The server sanitizes the submitted
diagnostics again; the timeline remains untrusted submitted context.

The database must acknowledge a save before the UI shows a reference. A secret
request key deduplicates retries, including concurrent requests. The attempted
payload stays fixed for retry; download/email provide a fallback. No automatic
email contains the report description or diagnostics.

## Operator flow

Designated support operators use **You → Bug reports**, at `/protected/support`.
This grant is separate from moderator/admin status and does not alter either.
Operators see a paginated newest-first queue, explicit load failures, each
description and timeline, reply email, status/history, expiry, and email state.
They can record a status/note, retry an email alert, and download a reproduction
bundle without the reporter identity/email or submission secret. Free text can
still contain sensitive content: review downloaded bundles before sharing.

Statuses: New, Reviewing, Needs information, Reproduced, In progress, Fixed,
Closed, Duplicate. Notes stay private to support. This slice has no member-reply
thread, automatic outcome mail, attachments, severity filter, or search. An
operator follows up through the supplied reply email using the ordinary support
process. Individual invitations and verification review are separate follow-ups.

## Activation checklist

1. Keep intake disabled while preparing. Apply
   `migrations/0035_beta_bug_reports.sql` manually as the database owner, per the
   repository's migration stop-gate. Existing deployments must already have the
   profile/tombstone substrate; the base schema alone does not enable reporting.
2. Identify the intended existing active Auth user by exact email, confirm its
   UUID, then explicitly insert that UUID into `support_operators`. Do not create
   an account, auto-verify it, change roles, or use an email check in client code.
   The private operating handoff contains the exact-account preparation query.
3. Configure the existing Supabase server/public keys and service-role key.
   Set `BUG_REPORT_NOTIFY_TO` to the operator's confirmed receiving address,
   `RESEND_API_KEY`, and an authorized `CONTACT_FROM`. Verify the durable site
   origin used by `lib/site-url.ts`; preview links must not appear in alerts.
4. Set a strong production `CRON_SECRET`. `steppe/vercel.json` configures an
   **hourly** Vercel request to `GET /api/support/maintenance`; Vercel sends
   `Authorization: Bearer <secret>` automatically. Redeploy after setting the
   secret and verify the job in Project Settings → Cron Jobs. Inspect its run
   logs and investigate non-200 responses; a 503 means maintenance failed.
   Keep the secret out of URLs. For another scheduler, the route accepts
   `BUG_REPORT_MAINTENANCE_SECRET` only when `CRON_SECRET` is absent. Do not
   configure two schedulers for the same job. See [Vercel's cron guidance](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
   Configure the maintenance alerts below before relying on unattended operation.
5. Reconcile the formal privacy-policy disclosure, backup retention, and support
   export handling with these operational settings before enabling collection.
   The reporter and English/Spanish privacy summary explain the actual feature.
6. Set `BUG_REPORTS_ENABLED=true`. The app must also be reachable with
   `LAUNCH_PHASE=live` for operator review. Rehearse with an authorized test
   participant: save, receive alert, open as operator, deny another member, update
   status, export, and confirm cleanup. Hosted Auth, mailbox delivery, and the
   exact operator account remain deployment checks.

## Delivery, retention, and failure handling

- The saved report row is also its durable pending notification job. Immediate
  delivery runs after the response; maintenance retries up to 10 due reports per
  run. A claim lasts five minutes; failed delivery becomes due after 15 minutes,
  with eight automatic attempts. The actual retry cadence follows the scheduler.
  Manual retry resets the attempt budget. Provider idempotency reduces duplicate
  alerts; it is not an unlimited exactly-once guarantee across provider outages.
- Pending email never removes a report or changes the successful save receipt.
  Missing mail configuration leaves alerts pending. Inspect the queue and
  scheduler when alerts stop. The retry action asks the operator to check the
  resulting delivery status; it does not claim an email was delivered.
- Maintenance returns 503 for a failed email attempt, an unavailable queue-health
  query, or unexpired pending deliveries that exhausted eight attempts (excluding
  active delivery leases). Exhausted deliveries keep the job unhealthy until
  resolved or expired. Cleanup still runs first. When intake is disabled,
  maintenance continues cleanup and pauses notification retries/queue checks.
- Entire reports and case history expire after 30 days. RLS hides expired cases
  immediately; the next successful hourly cleanup deletes stored content and old
  rate-limit buckets. A broken scheduler delays physical deletion. This does not
  erase provider backups or downloaded copies; configure those separately.
- Account tombstoning deletes that member's submitted reports and support grant,
  and removes their actor identity from other support history. Intake locks the
  active profile so concurrent deletion cannot leave a new report behind.
  Anonymous reports are not retroactively linked after sign-in.
- Members' existing account export includes their own unexpired reports even if
  new reporting has been disabled. Internal notes and secret request keys are
  excluded. Authenticated users cannot write reports directly or read others'
  reports without the explicit support grant.
- Payload cap: 64 KB; description: 4,000 characters; expected result: 2,000;
  stored diagnostics: 50 KB. Database-backed rate limiting allows five accepted
  reports per source IP per rolling hour, using a keyed hash rather than storing
  the IP. Shared-network users share this limit. Deploy behind trusted forwarding
  headers (as on the current hosting platform), not an untrusted direct proxy.
- Disable `BUG_REPORTS_ENABLED` to stop intake and remove the launcher. Keep
  maintenance configured so retention continues. Do not drop report tables as a
  rollback; saved cases and account export must survive. For continued operator
  access during maintenance, leave the feature on and restrict intake deliberately
  in a separately reviewed change.

## Maintenance alerts with Sentry

Use a dedicated Steppe project and a cron monitor named `bug-report-maintenance`:

1. Match Vercel's schedule: `0 * * * *`, timezone UTC. Allow ten minutes for a
   late start and five minutes for completion. Set failure and recovery thresholds
   to one run. Configure an email alert for this monitor's new and recurring
   failures and confirm the intended operator's receiving address in Sentry.
2. Copy the monitor's **HTTP check-in URL** into the server-only Vercel Production
   variable `SENTRY_BUG_REPORT_CRON_URL` and redeploy. Do not configure it in
   Preview. The code also requires `VERCEL_ENV=production` before sending.
3. Run the scheduled job once from Vercel and confirm paired `in_progress`/`ok`
   check-ins in Sentry. Verify the alert destination using Sentry's test action
   before marking notifications operational. Do not break production storage or
   mail credentials to test failures.

The integration follows [Sentry's HTTP cron check-in protocol](https://docs.sentry.io/product/monitors-and-alerts/monitors/crons/getting-started/http/).
Each authorized run sends only its random run ID, `production` environment, and
`in_progress`, `ok`, or `error` status. No report data, member identifiers, request
details, or raw exceptions are transmitted. This does not install browser error
tracking, session replay, or performance tracing.

Sentry detects missed starts and unfinished runs independently of the app. A
check-in request times out after three seconds; telemetry failure does not stop
cleanup or retries. The app logs only a fixed check-in failure message. If Sentry
itself is unavailable, notification delivery cannot be guaranteed; inspect the
Vercel job logs directly. A 200 response proves maintenance completed, not that
Sentry received its check-in or an email reached an inbox.

For an alert, inspect the Vercel maintenance run and the protected support queue.
Restore database access or mail configuration as appropriate, then manually
retry exhausted notifications in the queue. Verify the next successful check-in
and recovery. Disable/delete the Sentry monitor deliberately if permanently
retiring the scheduled job; stopping intake alone leaves retention scheduled.

## Validation

The focused run passed **56 tests**: 25 reporting/privacy/worker/operator/database checks
and 31 existing interest, invite-redemption, and neighborhood-pledge regressions.
The eight database checks used a disposable loopback PostgreSQL 16 database with
the repository base schema and migration 0035; they cover RLS, privileged RPCs,
concurrent deduplication and notification claims, rate limits, case updates,
expiry/purge, and account tombstoning. Auth was a local SQL fixture, not hosted
Supabase Auth. This does not replace testing the complete hosted migration chain.

Browser verification used the local app and local PostgREST with mail disabled:

- English report saved with actual contact → join navigation, form-submit, and
  error-notice events; the saved row contained the scrubbed timeline.
- Spanish report saved at 390×844 with `diagnostics: null`.
- Both saved rows retained pending email state with mail disabled.
- Desktop/mobile panel layout, opt-in defaults, receipt, and report reference
  were inspected. Escape closes the dialog and restores focus to the launcher.
  No production submissions or emails were sent.

Full lint, TypeScript, and the optimized production build passed. The build used
the same isolated service configuration; its existing multiple-lockfile warning
remains. The release browser check used synthetic support and ordinary-member sessions:
the operator opened the saved case, saw its timeline, and saved a review status
and private note; the ordinary member was redirected away from that case.
A Spanish mobile report saved with diagnostics omitted. These checks use a local
Auth fixture and do not certify hosted Auth or real email delivery.

Run pure/mocked tests separately from the repository's hosted-linked suites.
Database tests require `BUG_REPORT_TEST_DB_URL` and refuse a non-loopback host or
a database name other than `steppe_bug_reports_test`. Never use production URLs.

From `steppe/`, run `npm run test:bug-reports` for the 48 pure/mocked checks (the
eight SQL tests skip without the explicit local URL). With an isolated database
prepared from the base schema and 0035, pass its loopback connection string in
`BUG_REPORT_TEST_DB_URL` to run all 56. This configuration excludes the usual
`tests/setup.ts` environment loader and hosted-linked suites.

## Release verification, September 14

- Updated against main after the classic hero restoration.
- 56 focused tests passed, including eight real local SQL checks and five new
  operator-action checks; full suite: 113 passed, 114 environment-dependent
  checks skipped, seven existing todos. Lint and production build passed.
- The Auth-state listener stays active on public pages so cross-tab sign-out
  also clears diagnostic drafts after returning to the website.
- Vercel lists the production alert recipient and mail/database keys. The
  reporting feature flag and maintenance secret are absent. Sensitive values
  are unavailable through the CLI check, so hosted schema/account access and
  real delivery remain unverified. Keep intake disabled until activation checks
  are complete. No production migration or role grant was performed.

## Matching Sentry errors to a report

When a reporter chooses **Include the technical details shown below**, the report
can include up to five references to anonymous browser errors from the preceding
ten minutes in that page session. They can refresh the preview before sending.
The optional activity timeline and report text stay in Steppe. Nothing from a
report is copied into Sentry. Existing anonymous crash monitoring is independent
of the optional activity recorder.

Support operators see a **Sentry errors** section on each report. It retrieves
only the exact included event IDs from the fixed `steppe-xu/steppe` project.
Event ID, release, production environment and occurrence time must agree before
showing the error type, handled state, app source locations and a Sentry link.
There is no matching by email, inferred identity, page or approximate time.
Refreshing the case can pick up an event after Sentry finishes processing it.

Set server-only `SENTRY_REPORTS_READ_TOKEN` in the Steppe production deployment
to a dedicated Sentry credential with `project:read`. The existing Vercel release
integration credential does not have this permission. Never prefix this value
with `NEXT_PUBLIC_`, commit it, or put it in report diagnostics. Rotate/revoke it
through Sentry and update Vercel together. See the [Sentry event API](https://docs.sentry.io/api/events/retrieve-an-event-for-a-project/).

The authenticated report read and support-operator permission check happen before
any Sentry request. Provider requests have four-second timeouts, no redirects or
cache, and a bounded response. Missing credentials, authorization failure, expired
or missing events and Sentry outages leave report review available. No provider
message, identity, request body, breadcrumb, source snippet or context is stored
or rendered. The error references follow the report's existing retention period;
Sentry event retention is separate. A deleted Sentry event may remain unavailable.

References are memory-only until included in a report, and cleared on account
changes, sign-out and page exit. Reports without references remain valid. Errors
after a page reload, older than ten minutes, blocked by the browser, or never sent
to Sentry cannot be retroactively connected. Server errors are not captured by
the existing browser-only monitoring setup.

This change needs no database migration and does not enable intake. Preserve the
`BUG_REPORTS_ENABLED` setting separately from deploying code.
Validation covers real SDK transport sanitization, exact correlation, consent
serialization, account clearing, operator authorization, delayed processing,
mismatched events and provider failures. Database tests still require the explicit
disposable local database configured by the existing test runbook.

## Activation approval, September 16

The owner approved production intake and the already-authorized single labeled
test alert to greg@steppe.community. The factual support/crash disclosure and
downloaded-copy handling rule are published in `steppe/content/legal/privacy.md`;
this operational approval does not assert counsel sign-off on the wider policy.
Support exports must be deleted by the originating report expiry or earlier on a
valid deletion request. Reapply expiry and prior deletions before opening restored
data. Do not represent live-row cleanup as deletion of provider recovery copies.
