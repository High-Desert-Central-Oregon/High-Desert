# Steppe accessibility and usability follow-up

Date: 2026-09-19. Baseline: `276972c35898c9b6dd8e25d4616d5946c2f3e48b` (PR #64 merged).

## Scope and method

Read-only production inspection of the public home/join pages and signed-in exchange,
new-post form, account, groups, inbox, calendar, owner Work, interest/invitation pages,
support queue, and verification queue. Production's displayed bug-report release
matched the baseline. No invitations, reports, messages, calendar subscriptions,
verification decisions, or removals were submitted. Verification evidence was not opened.
The owner separately reported checking the verification pipeline.

Used DOM/accessibility-tree inspection, keyboard interaction, computed text-contrast
candidates, desktop and 320/390px viewport checks, and selected night-mode checks.
Error and consequential-action UI checks used the real React components in an isolated
local Vite fixture with synthetic records and inert server actions. This exercises UI
behavior, not hosted authorization, email delivery, or database outcomes.

This is a targeted audit, not a WCAG conformance certification. Computed contrast scans
do not cover every gradient, image, transition, state, or route. No actual screen-reader
speech or physical-device testing was completed. Native 200% browser zoom remains
unverified: native browser control was deferred while the owner was using Comet.
Narrow viewport tests do not substitute for that zoom check.

## Findings and recommended order

### 1. High: mobile bug launcher intercepts the compose action — fixed in PR #65

On the live exchange at 390×844, New post occupied x238–370, y712–756; the bug launcher
occupied x280–390, y700–744. The element at the center of New post was the bug button.
Clicking New post there actually opened the bug dialog. The same overlap was visible
at 320px.

Source: `steppe/components/bug-reports/reporter.css` and
`steppe/components/broadsheet/fab.tsx`.

Requested repair: an icon-only, 44×44px launcher fixed to the right edge at 50% of
viewport height. Its translated label appears on pointer hover and keyboard focus;
the pointer can move onto the label, and Escape dismisses it without moving focus.
The button retains its accessible name in English and Spanish.

Local verification used the real BugReporter and Fab components:

- At 390×844, launcher y400–444; New post y712–756; no overlap.
- At 320×740, launcher y348–392; document width remained 320px.
- At 1440×900, launcher remained 44×44px and vertically centered.
- Keyboard focus shows the label; Escape hides it; Enter opens the labeled dialog.
- Pointer hover shows the label, including when moving onto the label itself.
- Spanish accessible name is “Reportar un error.”
- Forced-colors emulation retained a visible icon, border, and 3px focus outline.
- Focused lint and bug-report suite passed: 92 tests passed, eight database tests skipped.

PR #65 is merged. A follow-up live check at 390×844 confirmed the icon-only launcher
at y400–444, New post at y712–756, and the hover label hidden at rest.

### 2. High: rejected event/group submissions erase the entered draft

`EventForm` and `CreateGroupForm` use React form actions with uncontrolled inputs.
An action returning an error state completes the action and resets those inputs.

Reproduced locally with the real components and synthetic input:

- Event: filled title, date/time and details; stub returned `when-required`.
  The error alert appeared, but the entered values were blank afterward.
- Group: filled name and description; stub returned `name-taken`.
  The error alert appeared, but both fields were blank afterward.

Source: `steppe/app/protected/events/new/event-form.tsx:35` and
`steppe/app/protected/groups/new/create-group-form.tsx:42`.

Repair: retain the draft across rejected submissions, following the controlled draft
pattern already present in `exchange/new/post-form.tsx`. Reset only after success.
Also review group settings and proposal forms for this pattern; those were not
runtime-validated in this pass. Retest English and Spanish, validation and server errors.

### 3. Medium: exchange metadata overflows at 320px

Live exchange document width was 372px at a 320px viewport. An event timestamp extended
to x372 because the metadata row does not wrap and the timestamp cannot shrink.
This is distinct from the category rail's intentional internal scrolling.

Source: `steppe/components/broadsheet/post-row.tsx:98`–105.

Repair: wrap the metadata or place the complete timestamp on its own line when space
is limited. Keep the date readable. Retest long English/Spanish timestamps at 320px
and 200% browser zoom. Relevant criterion: [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

### 4. Medium: canceling a review decision loses keyboard focus

The confirmation correctly puts initial focus on Cancel. Activating Cancel unmounts
that button and leaves focus on `body`, rather than returning it to Approve/Decline.
Reproduced with the real ReviewControls component and inert actions; no live decision.

Source: `steppe/app/protected/review/[id]/review-controls.tsx:29`–32 and 60.

Repair: restore focus to the initiating control after cancellation or a failed decision.
Verify keyboard sequence and error announcement together.

### 5. Medium: some failed reads appear as an empty collection

Source-confirmed; production failures were not injected. Groups ignores its directory
query error and converts missing data to an empty array. Calendar ignores membership,
RSVP and event-query errors and can show an empty or incomplete agenda without an error.

Sources: `steppe/app/protected/groups/page.tsx:74`–75;
`steppe/app/protected/account/calendar/page.tsx:97`–110 and 129.

Repair: distinguish successful empty results from failed/partial loads. Provide a
clear error and a read-only retry. Preserve the current filters and any draft.
The owner Work, people, support and review queues already have explicit error branches;
use that distinction consistently in member screens.

### 6. Medium: conversation popup advertises menu behavior it does not implement

The trigger has `aria-haspopup="menu"`, but the panel is a plain div with buttons and
details elements, without menu/menuitem roles. Local inspection confirmed no menu role.
Tab reaches the actions and Escape returns focus correctly; this is not a keyboard trap.

Source: `steppe/app/protected/messages/[id]/thread-menu.tsx:71`–89.

Repair: use disclosure semantics for this mixed form/details panel, or implement a
complete menu pattern. Do not add menu roles alone without the matching keyboard behavior.
Relevant criterion: [name, role, value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html).

### 7. Low: selected calendar day has no programmatic selected/current state

The selected day gets a bottom border and background, and its agenda has a dated heading.
The day link's accessible name announces the date and presence of events, but not that it
is selected. `aria-current="date"` exists on today's cell, which is a different concept.
Confirmed in the real MonthView local fixture with a selected synthetic event day.

Source: `steppe/components/broadsheet/month-view.tsx:281`–308.

Repair: expose the currently displayed agenda day on its link, keeping “today” separate.
Retest the selected border and event marker in forced colors as well as screen-reader speech.

### 8. Low: public home/join lack a main landmark and skip link

The live public pages had zero main landmarks and no skip link, unlike the member app.
Headings/regions provide some structure, so absence of a skip link alone is not treated
as a demonstrated WCAG failure.

Source: `steppe/app/(site)/layout.tsx:41`–45 and its page children.

Repair: provide one main landmark and a keyboard-visible skip link; reconcile pages
such as legal pages that already supply their own main element to avoid nesting them.

## Positive checks and limits

- The sampled post-PR64 text scan found no failing text pairs on the exchange, owner
  Work/people/support/review pages, groups, inbox and calendar in the states inspected.
  Groups and inbox also passed the sampled night-mode scan. This is not all-state coverage.
- Public home/join fit at 320px; join was checked in light and night themes.
- Work/people/support/review, groups, inbox and calendar fit the sampled 320/390px widths.
- New-post category radios expose labels and checked state. Member pages expose a main
  landmark and skip link. Bug dialog exposes its name and initially focuses Close.
- Removal preview has labeled reason/confirmation controls and a disabled final action
  until its conditions are met, checked with synthetic data only.
- Existing private message threads were not opened because opening them updates read
  state. ThreadMenu was tested locally. A local rendering of copied message bubble and
  composer markup fit at 320px; that is not a live thread or send-flow verification.
- The join honeypot is offscreen, hidden from assistive technology, and removed from
  keyboard order; it is not a reported finding. Decorative checkmarks are not normal text.
- Remaining acceptance work: real 200% browser zoom, VoiceOver or equivalent speech,
  physical mobile/Safari behavior, and broader forced-colors coverage. Use the
  [resize-text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) and
  [keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) criteria for those checks.

## Delivery sequence

1. Merge/release the narrow launcher repair and verify it on the live exchange.
2. Preserve event/group drafts and repair the exchange timestamp wrap.
3. Restore review focus and correct conversation disclosure semantics.
4. Distinguish read failures from empty results; expose calendar selection and public landmarks.
5. Repeat the affected flows, then complete native zoom and screen-reader acceptance.

The initial audit delivery included item 1's implementation. The follow-up below
records work on the remaining findings.


## Implementation follow-up — 2026-09-19

Branch: `codex/a11y-followups`, based on merged PR #65 (`1de24db`).
Findings 2–8 are implemented for review; production verification awaits deployment.
No database migration or production submission is part of this change.

- **Drafts:** event, group, group settings, proposal, and exchange forms retain text,
  radio choices and select values after a returned action error. A shared DraftForm
  dispatches in a transition without React's automatic form reset. Controlled selects
  were observed resetting too, so controlled text state alone was insufficient.
  Native validation and the form action remain; successful creation still follows the
  existing server redirect, and successful settings saves retain the saved values.
- **Reflow:** exchange metadata wraps; at phone widths the complete timestamp gets its
  own line. The real PostRow fit at 320px with English and Spanish timestamps.
- **Review/disclosure:** Cancel returns focus to Approve or Decline. Returned and thrown
  decision failures were checked with inert actions and restored the initiating control.
  The conversation panel now uses disclosure semantics, retaining Tab access and Escape.
- **Read failures:** groups and calendar distinguish failed queries from successful
  empty results. A document GET retry preserves search/category or month/day parameters.
  Supporting membership, category, moderation, feed and feed-name errors also stop an
  incomplete view. This avoids displaying incorrect membership actions or offering to
  create a feed merely because its read failed.
- **Calendar:** the selected agenda-day link exposes `aria-current`; today remains a
  separate cell state. The event dot has a visible border in forced colors and navigation
  chevrons use the current text color and shared focus outline.
- **Public pages:** a translated skip link targets one focusable main landmark in the
  shared layout. Legal content uses article elements, avoiding nested main landmarks.
  Home, join, terms and privacy were checked in the real local Next site. The skip link
  was visible on keyboard focus and moved focus to main; Spanish text was verified.

### Reproducible verification

- `tests/fixtures/accessibility-followups/README.md` documents the browser fixture. It
  imports real components and replaces all action imports with inert synthetic stubs.
- Browser checks reproduced returned validation/server errors in event and group forms,
  rejected and successful group-settings saves, proposal validation errors, and a Spanish
  exchange error. Entered values and dropdown selections remained intact.
- Review controls passed keyboard cancellation from both decisions and focus return after
  returned/thrown synthetic failures. Thread disclosure passed Tab/Escape checks.
- Calendar selection and event-marker borders remained visible in forced-colors emulation.
- `tests/accessibility-load-failures.test.ts` renders the real server-page results with
  mocked reads, exercising failures and successful empty results without hosted access.
- Full local tests passed: 268 passed, 134 hosted-database tests skipped, 7 todo.
  Lint and TypeScript passed; lint retains the one existing anonymous-default-export
  warning in the earlier color fixture.

The fixture does not verify hosted writes, successful creation redirects, server refresh
races, or notification delivery. Native 200% browser zoom, actual screen-reader speech,
and physical mobile/Safari acceptance remain pending. These are not inferred from
viewport emulation or accessibility-tree inspection.
