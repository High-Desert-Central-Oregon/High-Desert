# Accessibility follow-up fixture

From `steppe/`, run `./node_modules/.bin/vite --config tests/fixtures/accessibility-followups/vite.config.mjs`
and open `http://127.0.0.1:8770`. Uses the installed Vitest toolchain. All actions are
replaced with inert stubs; no credentials, real records, email, or database clients.
Fonts use system fallbacks. Next navigation is stubbed, so this is not a routing test.

Manual regression checks (English and Spanish):

- Posts, events, groups, settings, proposals: change every field, including select values and
  advanced group options. Submit with validation and server errors. The draft must remain.
  Only settings supports the synthetic success result; values should remain after saving.
- Review: keyboard-open Approve and Decline, then Cancel. Focus returns to the initiating
  button. Confirm a synthetic failed decision (returned failure and thrown failure) and
  check focus return plus status feedback. This never makes a real decision.
- Messages: the options disclosure exposes expanded/controls, Tab reaches its controls,
  and Escape closes it and returns focus. It does not claim to be an ARIA menu.
- Exchange: at 320px and 390px, the full timestamp wraps without page overflow.
- Calendar: September 20 exposes the current agenda day on its link. Check the selected
  border and event marker in forced colors, and keyboard focus on the day link.

## Groups and governance follow-up

At 320px and 390px, failed group creation, settings saves and proposal creation
must focus the visible error. Tab returns to the first editable field. Names,
descriptions, category, preset/advanced choices and proposal dates must remain
intact. Repeat in Spanish and with validation/server-error outcomes.
Details and select controls use 16px mobile text and visible outlines in forced
colors. Settings success appears next to Save as a status message, clears after
an unsaved edit, and returns after a successful retry.

Vote starts with a synthetic saved Yes. Choose No or Abstain and submit: the
deliberate local failure must retain that attempted choice, show no success
receipt and focus the error. Tab returns to the checked radio. Repeat failures
and Spanish. All vote actions are inert; this is not a hosted ballot test.
The delayed fixture responses exercise the real pending/settled action states.

## Message and support follow-up

The day/night toggle applies the member app's real `.dark` token class.
At 320px and 390px, check English and Spanish appeal, support, message menu,
composer and bug-report controls. Editable text is 16px on mobile. Keyboard
focus must remain visible in both themes and forced colors.

- Appeal: submit failures repeatedly. The statement remains and the error gets
  focus. Synthetic success replaces the form with a focused status receipt.
- Support: returned and thrown failures keep the selected status and note and
  focus the error. Success clears only the saved note. Editing either field
  removes the old receipt. Retrying email must preserve an unsaved note.
- Bug report: the local endpoint returns 503, preserves the draft, and focuses
  the visible error inside the dialog. Tab goes to Send; Close/Escape returns to
  the launcher. Use exactly `Synthetic success` in Expected to test the focused
  success receipt. These responses never create a report or email anyone.

Authentication subscriptions are inert. Starting or reporting a conversation
uses no-op fixture actions; this does not test real messaging redirects, draft
retention across navigation, or server permissions. Native Safari keyboard,
browser zoom, installed PWA and screen-reader speech remain separate checks.

Server read-failure branches are covered separately by `accessibility-load-failures.test.ts`.
Public landmarks and skip navigation should be checked in the actual Next site, including
both legal pages. Complete native browser zoom and assistive-technology checks separately.
