# Isolated member usability browser fixture

From `steppe/`, run:

```sh
npx vite --config tests/fixtures/member-usability/vite.config.mjs
```

Open `http://127.0.0.1:8771`. This mounts the actual Event, Post, Profile, RSVP, DeletePost and AddToCalendar components with synthetic records. All actions and location responses are local fixtures. No real user, email, provider or database is contacted. It is excluded from the application build.

Use Screen/Language to switch views and Fail saves to exercise errors. Successful writes counts only successful fixture actions. Verify no write before profile Save, saved privacy restoration after failure, RSVP save/cancel/reset, multi-tag edit prefill, draft retention and delete confirmation. Calendar copy/download use the real implementation. The calendar screen shows the last successfully copied clipboard value and can simulate clipboard failure. Check individual field copies, full details, English/Spanish feedback, keyboard access and manual-copy fallback.

Local database proof uses a disposable loopback database named `steppe_pipelines_test`. First run `tests/fixtures/account-removal-database.mjs`, then `tests/fixtures/post-tags-local.mjs`, both with `MEMBER_PIPELINE_TEST_DB_URL` pointing at that empty local database. Both reject non-loopback URLs. Never use a hosted database.

## Mobile form error and focus checks

Post messaging permission starts unchecked on `?screen=posts`. Editing reads the
saved fixture value: `?screen=edit&post-messages=on` starts checked; omitting the
parameter starts unchecked. Toggle with the label and keyboard Space. With Fail
saves enabled, submit valid text and verify the chosen permission, title/body and
tags remain after the error; Successful writes must not increase. Check EN/ES
at 320px/390px with no clipped label or helper text. Add `&theme=night` for the
night palette. Database persistence and
authorization use the separately gated post-messaging database suite.

At 320px and 390px, test posts and edit-event with Fail saves enabled.
After submitting, the error must receive focus and be visible without scrolling
back to the top. Repeat the same failed submission: focus must return to the
error again. Tab from the event error reaches Title; Tab from the post error
reaches the first tag. Title, Details, dates, venue, and selected tags must stay
intact and Successful writes must not increase. Repeat in Spanish.

Details and neighborhood controls use 16px text below the desktop breakpoint.
Use Space to toggle post tags: selected tags show checkmarks in addition to
color. In browser forced-colors mode, verify an outline on the focused tag,
text field, Details, neighborhood selector, and submit button. These checks are
desktop browser emulation; physical Safari, software keyboard, browser zoom,
and screen-reader speech need separate acceptance checks.

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
with the full map catalog and no database or email access. The local
action deliberately leaves `currentId` unchanged until Reload saved profile, so
the check also covers a delayed server refresh.

- Starting at None of these fit, choose Braydon Park and save. After the success message,
  Braydon Park must remain selected and the optional note must stay hidden. Before the fix,
  the form's automatic native reset checked None while reporting success.
- Save again without changing the choice, then choose Juniper Glen and save. It must stay
  selected. Reload saved profile remounts with the last successful stored choice.
- Turn on Fail saves, reload the saved profile, pick Braydon Park and save. The error must restore the committed Juniper Glen
  choice. A failed write must not increment Successful writes.
- Turn off Fail saves and choose None. Saving must show the existing confirmation
  card. Reload saved profile must select None and show the optional note.
- Repeat in Spanish at mobile width and check radio arrow-key navigation.

This proves browser form retention; hosted database persistence is still checked
by the server action's read-back and the separately gated local Postgres suite.

## Redmond neighborhood map and address lookup

Map opens first with streets beneath county outlines; the static overview remains
available using Return to overview. List searches full names and printed map
aliases (try `GLN`). Both modes contain the complete 334-choice catalog and share
one selection. Verify saves, failed saves and Reload saved profile in both modes.
Map browsing and address searches must leave Successful writes unchanged.

The address endpoint is a local fixture. Type any three-character query and pause;
suggestions should appear without clicking Find address. Use arrows and Enter or
click the fixed public-park suggestion; its label must fill the input without a
second search, and load the county outlines and its marker. Enter
must search without saving. The second result is outside the 2019 image and must
explain that limitation without an edge marker. Clear address removes the query,
results and marker. Check `&address-empty=1` and `&address-failure=1` messages.
Use `&address-slow=1`, type three characters, wait for Searching, then shorten the
query to two characters. The old response must never populate suggestions. Repeat
with Clear address or switching to List during the request.

Use `&address-county=1` for a synthetic county address point. County attribution
must appear, the selected label must fill the input, and selecting the marker
must leave Successful writes unchanged. Check the bilingual provider disclosure.

The default street map loads Leaflet and county geometry. Choose 2019 aerial to
load the GeoPDF-derived raster. Check Juniper Glen, Braydon Park, Street map / Compare,
zoom, arrows/+/- and Return to overview. Names without outlines must remain selectable. Repeat at 390px
in Spanish and inspect keyboard focus, wrapping and no horizontal overflow.

Open `/?screen=neighborhoods&map-image-failure=1` and choose 2019 aerial to force a
local 503. The alert leaves county outlines, List, the PDF link and chooser usable;
Return to overview restores the static image. This intentionally produces a failed-resource console entry.
No database is contacted. OSM tiles load with the default interactive street view.

## County outline map

The default map should load 551 paths over visible OpenStreetMap street tiles, without the historical raster. County outlines removes street tiles; Return to overview unmounts the interactive map. The native map name selector and polygon click inspect names; a name remains permanently labeled when focused. Choose 121 West must update the draft selection with Successful writes unchanged; only Save writes. Confirm retention after Map/List switching and Reload saved profile. Filter List by a county phase/replat alias and check that it finds the grouped choice. Address fixtures use synthetic points; check the containing-plat chips and no-match help without an automatic selection. At 320px and 390px, the search input must occupy its own row above the button, the short placeholder must fit, and the full selected label must wrap below the input in both languages.

`&outline-failure=1` forces geometry failure; the alert, static overview, List and 2019 aerial must remain usable. `&map-image-failure=1` fails only the optional historical raster: county geometry remains displayed. Repeat at 390px in Spanish, including controls, status, selection and save/reload.

## Group messaging and requests

`?screen=group-contact` renders the real preferences form with receiving off and
acknowledgment unchecked. Save cannot submit until acknowledgment is checked.
Check it with keyboard Space, optionally allow requests, Save and verify choices
stay selected. Fail saves must retain both choices and focus the error. The
synthetic counter records only confirmed writes. `&stale=1` shows changed rules,
receiving previously on, acknowledgment required again. Turn off requests must
work without acknowledgment, retaining the unchecked acknowledgment and showing
Last successful action: disabled. `&rules-off=1&stale=1` retains that off control.

`?screen=group-rules` renders the actual 2,000-character rules editor. Save/error
retention, clearing to disable and keyboard focus must work. `?screen=message-request`
renders real Accept/Decline/Block controls. Each successful action must show its
own name in Last successful action; failures must show the focused generic error
without a successful write. Check EN and ES at 320px/390px, including night palette,
without horizontal overflow. These isolated actions never contact a real member.
Database state transitions, current rules/membership/blocks, privacy, pending cap,
rate cap and concurrency use the separately guarded real local Postgres suite.
