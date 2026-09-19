# Color accessibility audit — 2026-09-18

## Summary

The verification screenshot exposes a real contrast failure shared by every verification method. Selecting a method places ordinary dark text on a rust fill: the title measures **2.58:1** and the instructions **1.29:1**, against a **4.5:1** requirement. Hover instructions also fail at **3.10:1**.

The underlying paper/ink palette is generally readable. The recurring problems are foreground/background pairs in selected and hover states, decorative borders reused for inputs, and focus indicators that are too faint. Website night mode adds several additional failures.

**Recommended order:** verification choices → shared app fields and keyboard focus → website form and button colors → secondary text and regression checks. Preserve the brand palette; define safe uses and pairs instead of replacing the whole palette.

This section records the original audit before repairs. Implementation and verification results are recorded below under **Repair pass**; production activation remains separate.

## Scope and method

- Source revision: `ea804399783159c92a931cb8845e73b6f8153c67`.
- Read the root layout, shared app tokens, Tailwind configuration, UI primitives, login/terms/verification/neighborhood steps, verification review/reply, invitations/removal, profile choices, exchange forms/rows, calendar, messages, governance choices, bug reporting, and public website styles.
- Live browser inspection: `/protected/verify` in its current pending-review state; bug-report dialog; public `/`, `/join`, and `/contact` in light mode. No submissions, review decisions, uploads, downloads, invitations, or bug reports were made.
- The original verification choices were no longer present in the live session. Reproduced their exact classes and nested text styles in a local static page compiled with the repository's Tailwind configuration and `globals.css`. Inspected selected, hover, and keyboard-focus states in the browser.
- Reproduced website form/button states using the actual `tokens.css`, `site-base.css`, `join.css`, and `pledge.css`. Inspected both website themes and the light-theme button hover. These are component/style reproductions, not full authenticated end-to-end tests.
- Read computed browser colors and font sizes. Calculated WCAG sRGB relative luminance, compositing translucent backgrounds/borders over their surfaces. Ratios below are rounded for display; thresholds must be evaluated without rounding. HSL source conversions can differ slightly from browser-rounded RGB values.
- Automatic candidate extraction was manually interpreted: native control rendering, decorative marks, hidden honeypots, gradients, and ancestor opacity need separate handling. A checkmark redundant with nearby text was not reported as a normal-text failure.
- The member app is **forced light** by `app/layout.tsx`. Its dormant `.dark` token block is not an available member theme and is not represented as a live failure. Website night mode is independently enabled by `data-theme` and the root time-of-day initialization.

This is not a claim of full WCAG conformance. Every route, dynamic server error, browser-native file picker, mobile breakpoint, forced-colors mode, translated layout, screen reader, and zoom setting was not exercised. The current unverified session was not changed to reach privileged/member-only screens.

## Standards used

- [WCAG 2.2 SC 1.4.3 — Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): ordinary text, including help and placeholder text, needs 4.5:1; qualifying large text needs 3:1. Disabled controls are exempt, but readable explanations are still useful.
- [SC 1.4.11 — Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): visual information needed to identify authored controls and states needs 3:1 against adjacent colors. Decorative separators are not required to meet the control-boundary threshold.
- [SC 1.4.1 — Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html): color must not be the sole way important information is conveyed.

## Findings

### CA-01 · High · Selected verification choices lose readable text

**Evidence:** `steppe/app/protected/verify/verify-form.tsx:114–133`; color values in `steppe/app/globals.css:43–58`. User screenshot plus browser reproduction with compiled repository CSS.

| State / content | Computed foreground | Background | Ratio | Required |
| --- | --- | --- | ---: | ---: |
| Selected method title, 14px / weight 500 | `#2a2e2c` | `#a8532c` | 2.58:1 | 4.5:1 |
| Selected method help, 12px | `#5f5a4e` | `#a8532c` | 1.29:1 | 4.5:1 |
| Unselected method help while hovered | `#5f5a4e` | 50% rust over paper | 3.10:1 | 4.5:1 |

`bg-accent` is a saturated rust background, but neither the title nor the muted child changes to its paired foreground. The global token comment even describes rust as a marker rather than a large fill. Every method runs through the same component, and both language dictionaries use those same styles.

**Recommended fix:** use paper/bone for selectable cards, retain dark text, and distinguish selection with a strong outline plus the existing checked radio. For example, existing muted help on the bone surface clears 5.5:1. Add a visible `focus-within`/radio-focus treatment. If a filled selection is retained, explicitly pair both title and help text with a tested foreground; changing only the parent text color leaves the muted child broken.

The native checked radio already provides a non-color cue. This finding is a text-contrast problem, not an assertion that the screenshot relies on color alone.

### CA-02 · High · Shared list-row keyboard focus is too faint

**Evidence:** `components/broadsheet/post-row.tsx:94`, `date-tile-row.tsx:40`, `section-row.tsx:119`, `month-view.tsx:304`; `app/protected/exchange/page.tsx:149`, `messages/page.tsx:128`, and `messages/[id]/thread-menu.tsx:40` (all under `steppe/`).

These seven files use `focus-visible:bg-muted focus-visible:outline-none` without an additional focus ring or underline at the affected control. A keyboard-focused representative row had a transparent outline, no shadow, and only the background change from paper to bone. That change is approximately **1.17:1**.

**Impact:** keyboard users can have difficulty locating the focused exchange row, message, calendar item, or menu action even when its text is readable.

**Recommended fix:** centralize a visible focus treatment with a contrasting ring/outline and spacing from the control; retain the subtle background as a supplementary effect. The app's existing juniper ring token has ample contrast against paper. Do not classify all existing 1px rings as AA failures merely because they are thin: the confirmed problem here is the missing contrasting indicator.

### CA-03 · Medium · Decorative hairlines are reused as form boundaries

**App evidence:** `components/member-pipelines/verification-reply.tsx:42`, `app/protected/people/invitation-controls.tsx:77,86`, `app/protected/people/remove/controls.tsx:109`, and custom message/moderation textareas. Bare `border` inherits the 22%-opacity decorative ink token. On the same paper surface, that boundary is **1.52:1**, and the field fill provides no additional contrast.

**Website evidence:** `app/(site)/join/join.css:118–128`, `contact/contact.css:109–121`, and `n/[slug]/pledge.css:268–277`. Live join/contact controls use a 16%-opacity border and a nearly identical field fill. Measured border contrast against the surrounding form card is **1.38:1**; field fill is **1.08:1**. The isolated night-theme join field is also weak: border **1.21:1**, fill **1.18:1**.

**Recommended fix:** keep subtle borders for decorative rules, but use a dedicated control-boundary token for input, select, and textarea components. The existing app `border-input` implementation is a useful baseline: it measures **3.32:1** on paper. Migrate the recent member-pipeline custom controls to the same shared field components. Supply equivalent light/dark website field tokens and explicit placeholder colors.

### CA-04 · Medium · Website action labels fail on hover and at night

**Evidence:** `app/(site)/site-base.css:796–813`, `tokens.css:102`, `join/join.css:163–185`, and `contact/contact.css:149–168`. Browser-reproduced with actual CSS; `.btn-rust` is used by the live homepage's beta calls to action.

| Action state | Text / fill | Ratio |
| --- | --- | ---: |
| Homepage rust button, light-theme hover | white / `#c26b3e` | 3.84:1 |
| Homepage rust button, night theme | white / `#c26b3e` | 3.84:1 |
| Join/contact filled submit style, night theme | paper / `#c26b3e` | 3.59:1 |

These 14–15px labels require 4.5:1. The light-theme join submit passes at **4.95:1** before any disabled-state opacity.

**Recommended fix:** separate the rust color used as text on a dark surface from the rust used as a button fill. Keep a sufficiently dark fill with light text, or deliberately use a dark on-fill foreground for a lighter fill. Verify hover independently; the current lightening on hover is itself a regression.

### CA-05 · Medium · Neighborhood pledge actions use surface tokens as text

**Evidence:** `app/(site)/n/[slug]/pledge.css:286–313,389–405`; callers in `pledge-panel.tsx` and `leave/leave-form.tsx`. Browser-reproduced with actual CSS.

- Night-theme `.pledge-submit`: the override sets text to `--bone`, but that token becomes dark `#22262b`. Against juniper `#36563d`, contrast is **1.85:1**.
- Night-theme copied confirmation: `--ink` becomes light `#ece6da`, while the sage fill remains `#9cad8b`: **1.93:1**.

Both are small button labels and require 4.5:1. The submit style also serves the leave-confirmation action, so this affects both joining and leaving.

**Recommended fix:** define explicit on-juniper and on-sage text colors that remain valid in both themes. Retain the textual copied confirmation. Avoid using theme-changing surface tokens such as `--bone` or `--paper` as an assumed fixed light text color.

### CA-06 · Medium · Several website secondary labels and links miss AA

**Evidence and measurements:**

- Live contact email link (`contact/contact.css:64–66`): rust `#a8542c` on bone `#ede6d5` is **4.25:1** at 15px.
- Live homepage exchange metadata (`broadsheet.css:293–297`): `#6f6a5c` on bone is **4.34:1** at 11px.
- Night-theme join card kicker and privacy link (`join/join.css:84–96,205–208`): rust glow `#c26b3e` on card `#2f343a` is **3.27:1**, reproduced at 11px.

These are ordinary text, not decorative exceptions. A token that passes on paper does not necessarily pass on bone or a raised dark card.

**Recommended fix:** use foreground/secondary-text tokens tested against every surface where they appear. Keep underlines for inline links. Give small rust text a separate theme-aware token from filled-action backgrounds. Replace the fixed homepage byline literal with the tested secondary-text token.

## Additional follow-up risks

- **Bug launcher focus at night:** its fixed green focus outline `#1e5949` is about **2.06:1** against the website's dark paper `#1b1e22` (`components/bug-reports/reporter.css:22–24`). This is source-calculated; the launcher on a full live night page was not keyboard-tested. Make its focus indicator theme-safe while fixing shared focus styles.
- **Unused dropdown sub-trigger:** `components/ui/dropdown-menu.tsx:30` sets a rust focus/open background without its paired foreground. No application call site was found for `DropdownMenuSubTrigger`, so this is a latent component defect rather than a demonstrated live workflow failure.
- **Global token names collide:** marketing `tokens.css` defines `--card` as a hex color and `--border` globally on `html`; app styles consume `--card` as an HSL triplet. Audit client-side website-to-app navigation before declaring the color systems isolated. A production navigation failure was not established in this pass.
- No dedicated contrast/axe/color-accessibility regression suite was found in the inspected tests or package scripts. Existing feature tests do not establish visual contrast coverage.

## What already works

Measured app pairs on paper, using current source colors:

| Pair | Approximate ratio |
| --- | ---: |
| Main body text | 12.87:1 |
| Secondary text | 6.44:1 |
| Secondary text on bone | 5.52:1 |
| Primary button text | 9.56:1 |
| Destructive text | 6.17:1 |
| Success text | 6.02:1 |
| Warning text | 5.97:1 |
| Warning text on its 10% tinted panel | 5.19:1 |
| Shared input boundary | 3.32:1 |

The live bug-report dialog uses explicit light surfaces and dark body/help text; its launcher and submit text pair is about **8.00:1**. The current issue is not a need to invert that whole dialog.

Source review also found useful non-color cues: native verification/vote radios, labeled category markers, textual status/error messages, and checked consent controls. Disabled primary buttons have reduced opacity but are not automatically WCAG contrast failures. The terms gate provides explanatory text while its continue button is disabled. Preserve these behaviors during repairs.

## Implementation and acceptance plan

1. **Repair verification choices first.** Introduce one accessible choice-card pattern; keep title/help readable in unselected, hover, selected, keyboard-focus, and busy states. Preserve native radio semantics and `aria-describedby`. Check every method in English and Spanish, including long help text. No backend change should be needed.
2. **Unify app fields and focus.** Move member-pipeline and other custom fields to a shared boundary/placeholder/focus contract. Add a visible focus indicator to the seven row/menu patterns listed above. Reuse existing passing paper, ink, and input tokens.
3. **Repair website pairs.** Separate accent text from filled-action tokens; fix CTA hover/night colors, join/contact/pledge field boundaries, pledge on-fill labels, and small secondary text. Check the bug launcher's focus indicator on both website themes.
4. **Add state-based regression checks.** Test real components with browser accessibility checks and explicit computed-color assertions for the failing pairs. Include hover, selected, focus, validation error, success, and disabled-with-explanation states; do not treat disabled controls or decorative separators as false failures. Inspect keyboard focus manually as well as with automation.
5. **Verify user journeys before release.** Cover sign-in/code entry → terms → verification choice/upload controls → pending/needs-information/reply; admin invitation/removal controls; exchange/category choices; groups/events/calendar; governance choices; messages; and bug reporting. Use synthetic local/preview data for submissions. Also check website-to-app navigation for token leakage, mobile/reflow, Spanish, and forced-colors mode. Do not upload real residency evidence for an accessibility test.

Completion means ordinary text is at least 4.5:1, qualifying large text and necessary control/state indicators are at least 3:1, selection/error/success remains understandable without hue alone, and the tested keyboard path has a clearly visible focus indicator throughout. Report any remaining manual or environment-specific gaps rather than declaring the entire application compliant from a single scan.


## Repair pass — 2026-09-18

Implemented on `codex/color-accessibility` in an isolated checkout. This is a presentation-only change; authentication, verification submission/review, invitations, removal, and database rules are unchanged.

- **CA-01:** Verification now uses a shared native-radio `ChoiceCard`. Selected and hovered cards use bone, retain dark text, and show a dark selected border and a card-wide keyboard outline. The real English and Spanish method descriptions are preserved.
- **CA-02:** All seven affected list/calendar/menu patterns use a shared visible focus outline. The pale background remains supplementary.
- **CA-03:** The affected invitation/removal/review/reply/support and message/moderation fields use `field-control`, with the existing passing input boundary and explicit focus/placeholder styles. Public join/contact/pledge inputs have dedicated light/dark boundaries.
- **CA-04–06:** Website action fills and on-fill text are now independent of accent text. Hover darkens the fill. Pledge actions keep stable on-juniper/on-sage inks; secondary labels use tested palette values. Small accent and secondary text were checked against paper, bone, sage, and raised dark surfaces.
- The bug launcher uses a two-color focus halo; the unused dropdown sub-trigger now pairs its focus/open fill with its foreground.
- Marketing `--card` and `--border` were renamed to `--site-card` and `--site-border` throughout website CSS. Combined styles in the browser fixture preserve the app's HSL card token, addressing the identified collision risk.

### Validation

- Production build, TypeScript, and ESLint on changed TypeScript/React files passed.
- 58 new color-pair regression tests passed, including text, selected surfaces, hover fills, control boundaries, focus colors, website themes, and app/site token isolation.
- Full unit suite: **256 passed, 134 skipped, 7 todo**. Hosted/local database-dependent suites were not activated for this presentation-only change.
- Browser checks used the actual `ChoiceCard`, `Input`, and `Button` with the real dictionaries and compiled production CSS. Native arrow-key selection worked. Spanish descriptions fit at 390px without horizontal overflow. The list-row focus outline was visibly present. Website light and night compositions were inspected.
- Representative measured results: selected title **11.07:1**, selected help **5.52:1**, app field border **3.32:1**, website join field boundary **5.26:1 light / 4.24:1 dark**, website action text **5.29:1**, night card accent text **5.69:1**, pledge submit **7.69:1**, copied confirmation **5.74:1**.
- Reproduction instructions: `steppe/tests/fixtures/color-accessibility/README.md`. The fixture uses system font fallbacks and does not access production services.

Full hosted journeys, browser-native upload dialogs, screen readers, and forced-colors rendering remain separate acceptance checks. These results do not establish whole-app WCAG conformance. No production data or deployment settings were modified by this repair pass.
