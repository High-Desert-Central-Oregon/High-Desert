# Isolated member usability browser fixture

From `steppe/`, run:

```sh
npx vite --config tests/fixtures/member-usability/vite.config.mjs
```

Open `http://127.0.0.1:8771`. This mounts the actual Event, Post, Profile, RSVP, DeletePost and AddToCalendar components with synthetic records. All actions and location responses are local fixtures. No real user, email, provider or database is contacted. It is excluded from the application build.

Use Screen/Language to switch views and Fail saves to exercise errors. Successful writes counts only successful fixture actions. Verify no write before profile Save, saved privacy restoration after failure, RSVP save/cancel/reset, multi-tag edit prefill, draft retention and delete confirmation. Calendar copy/download use the real implementation. The calendar screen shows the last successfully copied clipboard value and can simulate clipboard failure. Check individual field copies, full details, English/Spanish feedback, keyboard access and manual-copy fallback.

Local database proof uses a disposable loopback database named `steppe_pipelines_test`. First run `tests/fixtures/account-removal-database.mjs`, then `tests/fixtures/post-tags-local.mjs`, both with `MEMBER_PIPELINE_TEST_DB_URL` pointing at that empty local database. Both reject non-loopback URLs. Never use a hosted database.

## Provider error recovery

Open `http://127.0.0.1:8771/auth-error-callback#error=server_error&error_code=identity_already_exists&error_description=do-not-display`.
The local redirect reproduces fragment inheritance from an OAuth callback. The
real AuthNotice should show the account-conflict explanation and a fixed link to
Sign-in methods, replace the raw fragment with `issue=identity-linked`, and retain
the explanation after reload. Switch Language to Spanish and check keyboard focus
on the recovery link at mobile width. Use `error=access_denied` instead to check
generic feedback and fragment cleanup. No raw description should appear.

## Neighborhood selection retention

Open `http://127.0.0.1:8771/?screen=neighborhoods`. This renders the real picker
with two synthetic neighborhoods and no database or email access. The local
action deliberately leaves `currentId` unchanged until Reload saved profile, so
the check also covers a delayed server refresh.

- Starting at None of these fit, choose A and save. After the success message,
  A must remain checked and the optional note must stay hidden. Before the fix,
  the form's automatic native reset checked None while reporting success.
- Save again without changing the choice, then choose B and save. B must stay
  checked. Reload saved profile remounts with the last successful stored choice.
- Turn on Fail saves, pick A and save. The error must restore the committed B
  choice. A failed write must not increment Successful writes.
- Turn off Fail saves and choose None. Saving must show the existing confirmation
  card. Reload saved profile must select None and show the optional note.
- Repeat in Spanish at mobile width and check radio arrow-key navigation.

This proves browser form retention; hosted database persistence is still checked
by the server action's read-back and the separately gated local Postgres suite.

## Redmond neighborhood map

The neighborhood fixture serves the real local map assets. Expand the native map
disclosure to see the static overview, then Explore map to load the detailed
GeoPDF-derived image and Leaflet. Check Braydon Park, Diamond Bar Ranch and Greens
at Redmond label markers, Street map / Compare, named zoom controls, keyboard
arrows and +/−, Show whole map, and Return to overview. Missing names such as
Cinder Butte Village and Eagle Crest must display the no-confident-match message.
Browsing must leave Successful writes unchanged and the radio choice unchanged.
Selecting a radio can locate its label, but only Save neighborhood may write.
Repeat at 390px in Spanish and check focus, wrapping and no horizontal overflow.

Open `/?screen=neighborhoods&map-image-failure=1` and Explore to force a local
503 for the detailed raster. The real error handler must restore the static
overview, show an alert, and leave the PDF link and picker usable. This intentionally
produces one failed-resource console entry. No database is contacted. Street tiles
are external and load only on a deliberate Street map / Compare choice.
