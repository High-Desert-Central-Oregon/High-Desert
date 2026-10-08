# Group archiving

A verified active maintainer can archive a non-system group from **Manage group → Archive group**. The disclosure explains the consequences and requires a confirmation checkbox. Errors retain the confirmation; Cancel closes the disclosure, clears the checkbox and returns keyboard focus. English and Spanish are included.

Archiving removes the group from the directory and group messaging choices. Old group and management links show an archived notice using directory-safe data, without loading the private description or roster. New members, approvals, role changes, posts, events, settings and group contact requests are refused. The Everyone group cannot be archived.

Existing posts, events, RSVPs, memberships, message requests and accepted private conversations remain. Existing conversations retain their acceptance and block protections. Personal calendar feeds retain existing group events; the dedicated group feed returns unavailable. Archiving does not cancel gatherings, delete history or reset messaging choices. Self-service reopening is not included; restoration requires contacting Steppe.

## Release order

1. Apply `migrations/0045_group_archiving.sql` **by hand as owner**, after 0044 and before merging the app release. This is the production stop-gate required by `CLAUDE.md`.
2. Confirm the SQL editor reports success, then merge the pull request and deploy.
3. Check that only a non-system group's maintainer sees the archive control. On a disposable group, confirm the archive, its absence from listings, the archived notice on both old routes, and preservation of existing events and conversations. Physical-phone acceptance remains separate from viewport checks.

No new environment variables are required. The migration creates a session-authorized RPC and a private trigger function. Group row locks serialize archiving with new membership/content writes. Repeating the archive RPC or migration is safe and does not duplicate the archive audit entry. Deletes remain available for existing leave, account-removal and own-content removal paths.

## Validation — 2026-10-07

- Full app suite: **444 passed, 185 skipped, 7 todo**. Skipped integration tests are not counted as passed.
- Separate actual PostgreSQL suite on the guarded loopback `steppe_pipelines_test`: **27 passed**. Covers maintainer-only archival, unverified/anonymous/unrelated-role refusals, Everyone protection, idempotent migration and audit, stale forms, join/archive locking, event/post/RSVP preservation, personal versus group calendars, private conversation preservation, block enforcement and leaving.
- Route/action tests: **9 passed**, including English/Spanish archived notices, early return before private queries, system/nonmaintainer controls, explicit confirmation, session RPC use, sanitized failures and success revalidation.
- TypeScript and production build passed. Lint has zero errors and the existing color-accessibility fixture warning. Build retains existing Sentry configuration/release-token and workspace-root warnings.
- Inert browser fixture checked required confirmation, pending controls, retained confirmation on error, Cancel reset/focus, English at 320px and Spanish dark mode at 390px. Both layouts and the archived notice at 320px had no horizontal overflow. These are viewport checks, not physical-device or deployed acceptance.
- Local Supabase advisors at error level reported the three existing owner-rights views (`groups_directory`, `public_profiles`, `proposal_results`), unchanged by this migration. Their security-definer design predates this release; this check is not a claim that every existing database finding is resolved.

Production migration and live archival through the new app control have **not** been performed for this release. Test harnesses and synthetic fixture SQL must never target production.

### Local browser review

From `steppe/`, run `node_modules/.bin/vite --config tests/fixtures/group-archiving/vite.config.mjs` and open the displayed loopback URL. Add `?lang=es&night=1` for Spanish dark mode or `?view=archived` for the archived notice. Its action returns a synthetic failure and has no database connection.
