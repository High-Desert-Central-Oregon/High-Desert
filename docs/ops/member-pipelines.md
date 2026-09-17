# Member pipelines: invitations, verification, and sign-in

Release runbook. Production activation was verified on 2026-09-17 as recorded
below; untested delivery and provider flows are explicitly listed separately.
The beta bug-report slice is documented in [beta-bug-reporting.md](beta-bug-reporting.md).

## Production status — 2026-09-17

- PR58 merged as `6a49e76370c18184079b0649880178925adf2088` and deployed.
- Migrations 0036 and 0037 applied through the owner SQL editor after the new
  code was ready. API schema refreshed; `MEMBER_PIPELINES_ENABLED=true` enabled.
- Existing owner admin/support access verified without granting any new role.
  Work, individual invitation controls and the verification queue opened live.
- Hosted checks confirmed RLS, no anonymous invitation reads, no direct member
  invitation writes, a working Auth confirmation trigger, and service-only
  permission to acknowledge evidence cleanup.
- The combined maintenance worker returned HTTP200 after activation. Verification
  notices are configured for the designated reviewer inbox.
- Exact release-head validation: 126 tests passed with no skips, including isolated
  PostgreSQL tests. TypeScript, lint and production build passed. Local browser
  tests covered invite creation, clarification/reply, member access denial,
  deliberate decision confirmation, completed review and Spanish mobile layout.
- Real invitation delivery and a new person's complete hosted signup remain an
  acceptance check awaiting the owner's chosen recipient. Hosted document upload,
  deletion/recovery and applicant notification checks are not claimed complete.
  Google, Apple and SMS remain disabled.

## Member and operator flows

1. **You → Work → Invite a person.** An active administrator or designated support
   operator can invite an email directly or act on a consented interest-list row.
   Ordinary reviewers cannot read the interest roster. Individual invitations
   are separate from the existing neighborhood/cohort tokens.
2. Invitations last seven days. Repeated creation clicks reuse an active invite.
   Resends preserve its expiry, wait at least one minute, and allow five send
   requests per day. Revoke stops this invitation, including confirmation using
   an earlier email code. It does not revoke a confirmed account or a separate
   legacy/batch invitation. Renewing an expired/revoked invitation starts a new
   seven-day window. Email displays the actual expiry in Redmond time.
3. The person signs in with the invited email, accepts the current documents,
   and submits residency verification. Email/provider confirmation never grants
   residency verification. The owner list distinguishes confirmed accounts,
   pending verification, and verified members.
4. **Work → Verification reviews.** The oldest pending requests appear first,
   25 per page, with ready/waiting/finalizing state. Open a case to prepare a
   one-minute evidence link, ask a question, or deliberately approve/decline.
   Declining requires an explanation. Applicants answer on **Verify residency**.
5. A decision records the human's choice first, deletes any stored evidence,
   confirms cleanup, and then calls `decide_verification`. A failure leaves a
   recoverable case with the original choice. **Finish recorded decision**
   retries it; another reviewer cannot change that choice mid-cleanup. A retry
   after a lost success response does not duplicate the decision or audit entry.
6. **You → Sign-in methods** connects Google or Apple to the same signed-in
   account. First-time Apple users with a private relay address should first
   sign in through their invited email, then connect Apple. No app-side merge
   based on a typed email, name, or phone is performed.

The Work area retains distinct database permissions for invitations, reviews,
moderation, and bug reports. Making someone a support operator does not make
them a residency reviewer. The owner account must already have an appropriate
reviewer/admin role to decide cases. Do not automatically grant roles on email match.

## Local changes to ease of use

- The website neighborhood field is preserved as optional text for owner review;
  entering it does not assert residency or set `in_area=true`. Migration 0036
  provides its storage column. Interest intake saves it independently of the
  member-workflow switch, including when those screens are paused. Duplicate
  email submissions leave the existing record unchanged; they are not an
  authenticated way to update someone else's neighborhood.
- Explicit website links for joining the interest list, accepting a batch
  invitation, and signing in. Individual email invitations go straight to sign-in.
- Verification next-step card under You, applicant questions/replies, and last
  update time. No promised review deadline until operations can meet one.
- Work groups operator tools under You; the four main navigation destinations remain.
- My activity lists the member's posts, RSVPs, and bug reports, with pagination.
- Help routes account questions, verification status, and personal reports.
- Exchange draft fields stay in memory through returned validation errors;
  post return links carry the current filters/search, without storing search history.
  Browser Back retains the browser's normal scroll restoration; the explicit
  return link restores filters, not a separately saved scroll offset.
- Installation banner waits until verification; the existing manual install row
  remains available. No new notification channel or ineffective preference toggle.
- New UI copy is available in English and Spanish. Sensitive documents and
  private drafts are never persisted in browser storage by these changes.

## Release order and configuration

For a new environment, review the patch and verify a preview before release.
Owner production SQL is manual: `CLAUDE.md` requires migrations to be applied
“by hand in the SQL editor, as the owner, at a stop-gate.” Never run test fixtures,
the test harness, or synthetic consent/approval operations against production.

1. Verify the existing schema through 0034 and the bug-report migration 0035.
2. Deploy this code with member/provider flags off. The legacy review action
   refuses migrated cases before deleting any evidence, protecting old browser tabs.
3. During a brief review maintenance window, apply **0036_individual_invitations.sql**
   then **0037_verification_review_workflow.sql**, refresh the Supabase API schema,
   and enable `MEMBER_PIPELINES_ENABLED=true` in the same release window.
   **0037 changes the decision contract.** Do not leave 0037 installed with only
   the old UI, or roll back to old decision code. Keep new recovery code available
   for any finalizing cases. Disabling the member flag pauses the new screens;
   it is not a database rollback. Invitation Auth gates remain active in SQL.
4. Configure server-only values in the app deployment's environment settings:

   ```dotenv
   MEMBER_PIPELINES_ENABLED=true
   AUTH_GOOGLE_ENABLED=false
   AUTH_APPLE_ENABLED=false
   MEMBER_REVIEW_NOTIFY_TO=reviewer@example.com
   ```

   `MEMBER_REVIEW_NOTIFY_TO` falls back to `BUG_REPORT_NOTIFY_TO` when absent.
   Reuse `RESEND_API_KEY`, `CONTACT_FROM`, and the canonical `NEXT_PUBLIC_SITE_URL`.
   Keep provider switches false until each hosted flow passes its checks.
   Keep the existing authenticated `/api/support/maintenance` scheduler running
   for retries and retention, even when intake is disabled. No scheduler was
   created by this patch. Preview environments must use isolated data and mail.
5. Verify the intended owner can open Work and the interest list, and a normal
   member cannot. Test real delivery only with a recipient explicitly approved
   for that hosted smoke test. This implementation did not send real invitations.

### Google and Apple activation

- Configure each provider in Supabase and its provider console, with Steppe's
  approved application/domain configuration and identity-only scopes.
- Provider redirect: the exact Supabase Auth callback shown by the dashboard.
  App redirect allowlist: the canonical `/auth/callback` URL; add explicit preview
  URLs only for isolated preview environments. Do not use broad wildcard redirects.
- Enable manual identity linking in Supabase before offering Connect buttons.
  The callback uses Supabase PKCE and a short-lived HTTP-only initiation cookie.
  Linking verifies that the returned account ID is the original member ID.
- Test same-email provider entry, already-confirmed account access, expired and
  revoked invites, cancellation, missing initiation cookie, existing-account
  linking, and Apple relay-address linking. Verify profile, memberships, and
  residency status are unchanged by linking. Test normal and installed browsers.
- Configure Apple relay mail delivery and calendar ownership for the web OAuth
  secret's six-month rotation. Verify email-code fallback still works before
  enabling either provider. Use current provider branding assets for production
  button approval; the local controls are plain labeled buttons.

References: [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking),
[Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google),
[Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple).

### Deferred decisions

SMS remains off: provider, supported regions, spending/resend limits, and recovery
for changed/lost numbers have not been selected. Phone-only joining is explicitly
blocked by the email invitation gate. Adding SMS requires a separate compatible
invitation/recovery design, not just a provider switch.

Optional notification preferences, a guided first-use walkthrough, and broader
form/empty-state polish remain follow-ups. Essential service notices are the only
new email category; no optional broadcast system is introduced. JotForm workflow
choices remain in the private information-pipeline audit, not in authentication
or document verification.

## Delivery, retention, and limits

- Invitation creation and its notification are one database transaction. Delivery
  leases claim up to 20 jobs, with a five-minute lease and up to eight attempts;
  failed sends stay pending, with a 15-minute delay before another attempt.
- Work shows pending deliveries. Invitation retries use the invitation controls;
  verification notices have a retry action. An absent mail key does not mark mail sent.
- Service emails contain a link/reference, not evidence, questions, replies, or
  the decision explanation. Those remain behind the member/reviewer session.
- New verification updates supersede older unsent updates for the recipient;
  final decisions cancel stale pending case notices. A send already in flight can
  still arrive after revoke/update; database gates and current case state remain
  authoritative. Delivery is at-least-once, with provider idempotency keys.
- Notices expire after 30 days; invitation rows are removed 180 days after expiry.
  A confirmed active account can still sign in after its invitation is removed.
  Clarification text is cleared on the final decision; evidence is deleted before
  finalization. The short decision explanation remains on the member's case and
  in their export. Deleted accounts are excluded from new member notifications.
- The application does not validate a postcard code automatically. A human
  coordinates the existing alternative verification method and decides the case.
- Local SQL tests exercise real PostgreSQL roles/RLS and the Auth creation trigger.
  Browser tests use a local Auth fixture, not hosted GoTrue or real OAuth providers.
  Actual hosted email, OAuth, Apple relay, and installed-app returns remain release checks.

## Verification

Run from `steppe/`: `npm run test:member-pipelines`, `npm run lint`, and the
production build. Database tests require explicit loopback URLs with exact
disposable database names; they never load `.env.local`. This pass passed 85 tests, lint, TypeScript, and the production build. The local
owner/applicant clarification and final decision were verified in a browser;
invitation layout was checked on desktop and 402×872 mobile in English/Spanish.
See the accompanying private implementation handoff for limitations and release checks.
