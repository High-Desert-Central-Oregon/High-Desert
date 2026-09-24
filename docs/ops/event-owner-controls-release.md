# Event owner controls

Event creators can edit an existing event or permanently delete it from its detail page. Editing reuses the creation form, prefilled in Pacific time, with the same venue search and character limits. Existing RSVPs remain unchanged. An unchanged time preserves its exact stored instant, including the second occurrence of the autumn daylight-saving hour.

Deletion requires a separate confirmation explaining that the event and its RSVPs will be removed. Failed edits keep the draft; failed deletions show an error. Server actions require a verified creator, use the normal RLS client, and cannot change ownership, group, or moderation status. Moderation history remains intact.

## Release

- No migration or new environment variables required.
- Event details, lists, groups, and calendar settings are revalidated after changes. Calendar feeds read current rows.
- Subscribed calendars refresh on their own schedule. Previously imported calendar copies may require manual editing or removal.
- Editing does not notify attendees; the form asks organizers to tell attendees when the time or place changes.

## Validation (2026-09-24)

- TypeScript, production build, and full test suite passed: 308 passed, 134 skipped, 7 todo. The skipped integration tests require their separate fixtures; they are not counted as passed.
- Lint passed with the existing color-accessibility fixture warning.
- Disposable local PostgreSQL checks exercised nonowner denial, immutable ownership, RSVP preservation, targeted cascade deletion, live calendar-feed data, and moderation-history preservation. Run `tests/fixtures/account-removal-database.mjs`, then `tests/fixtures/event-owner-local.mjs`, against the guarded local `steppe_pipelines_test` database only.
- Browser fixture checks covered prefilled Pacific dates and venue, retained draft on failed save, successful save, cancel deletion with no write, failed deletion, successful deletion action, and Spanish mobile layout. Fixture actions are synthetic; database behavior was tested separately.
- The previously merged individual calendar Copy buttons were checked on the deployed app.

## After deployment

Verify the signed-in creator's edit route, saved details after reload, updated calendar details, and absence of owner controls for another member. Use a disposable event to confirm deletion and a missing detail page afterward. Production edits/deletion for this release have not yet been verified.
