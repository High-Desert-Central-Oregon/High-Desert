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

Server read-failure branches are covered separately by `accessibility-load-failures.test.ts`.
Public landmarks and skip navigation should be checked in the actual Next site, including
both legal pages. Complete native browser zoom and assistive-technology checks separately.
