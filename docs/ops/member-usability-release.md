# Member usability release

## Deployment order

1. Review the application changes and `migrations/0039_post_tags.sql`.
2. The owner applies **0039** in the Supabase SQL editor before the application is merged/deployed. It adds and backfills `posts.tags`, preserves the primary `category` for existing clients, and retains the existing RLS policies and protected identity columns.
3. Merge the application change, check Codeberg CI and deployment mirror parity, then check the deployed member flows below.

This is additive: rolling the application back can leave the tags column and triggers in place. Do not drop tags to roll back the application. Existing clients can still insert one category and change it.

## Behavior

- Event locations suggest visible existing Steppe event locations and public venues/addresses. Selecting a result fills venue and address together, with editable manual entry.
- Public results use the Photon endpoint backed by OpenStreetMap. The server forwards only the typed query and a fixed Redmond search bias, never the member identity or device location. The field discloses this before searching and credits OpenStreetMap. No API key is required. Provider availability and address completeness vary; preserve manual entry and local results on failures. Review provider capacity before expanding beyond beta. [Photon service documentation](https://github.com/komoot/photon/blob/master/README.md).
- Location search requires a verified member, uses the member's RLS client, excludes moderated locations, debounces input, aborts obsolete requests, and limits requests per server instance. Provider requests have a 3.5-second timeout and responses are private/no-store.
- Text fields have limits: shared text/search inputs default to 200, email to 320 and URL to 2048; existing field-specific caps override these. Event title/details/location are 140/2000/300, Exchange title/body 160/4000, display name 80, and RSVP bringing 120. Core event/post forms display counters. Event/post/RSVP actions also validate their limits on the server.
- Event entry, display, copied details and calendar imports use Pacific time. DST is automatic. Nonexistent spring-forward times are rejected; the repeated fall-back hour uses its first occurrence. Optional end times must follow the start. Copied details are readable lines; ICS imports still use exact UTC instants.
- Profile visibility waits for its Save button. Privacy status describes the confirmed server value while the draft is unsaved and restores that value after an error. Name edits require Save and retain their text on errors.
- Creation does not RSVP the organizer. RSVP starts without a selection, confirms successful saves, supports cancellation, and shows personal status tags in event detail, Exchange and calendar views.
- Exchange supports multiple tags and explains post types. Event composition returns to Exchange. Authors can edit or deliberately confirm deletion of their own posts; database permissions and explicit author filters protect these mutations. Moderation records are unchanged.

## Verification recorded before merge

- Production build and TypeScript passed. Lint passed with the existing anonymous-default-export warning in the color-accessibility fixture.
- Vitest: 297 passed; 134 database/environment-dependent tests skipped; 7 existing todo. The new focused suites cover DST, readable copy, location merging/privacy/outage, limits, author-scoped actions and RSVP behavior.
- Disposable local PostgreSQL 16 database initialized with the existing full account-removal fixture, then tested with `tests/fixtures/post-tags-local.mjs`: backfill, multi-tag edits, old-client compatibility, category consistency, author edit/delete, non-author refusal and identity-column protection passed. No production fixture writes.
- Real components in the isolated browser fixture: keyboard venue selection fills name/address; visibility makes no write before Save; failed privacy save restores confirmed state; RSVP begins empty, saves, cancels and resets; multiple tags remain selected; failed post submission preserves text; edit prefill and delete confirmation work; calendar copy succeeds and Spanish selectable fallback is readable. Mobile checks used a 390-pixel viewport. These are local component checks, not authenticated deployed persistence evidence.
- Public provider smoke returned Sam Johnson Park in Redmond. Not every public venue has a street number; members can complete the meeting point manually.

## Deployed acceptance after migration and merge

- Create an event with a named venue and end time; verify persisted Pacific times, no automatic RSVP, copied prose and imported calendar times.
- Save then cancel an RSVP; reload and confirm personal status tags across detail, Exchange, Upcoming and You/calendar.
- Save profile name and visibility; reload to confirm. Repeat with a failed request and check honest feedback.
- Create a post with two tags; confirm it appears under either filter, edit it, reload, and delete it. A second account must not have mutation controls or permission to mutate it.
- Check venue suggestions, unavailable-service/manual fallback, keyboard path, mobile layout, Spanish labels and field limits on the deployed build.
