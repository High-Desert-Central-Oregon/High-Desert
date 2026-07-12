# Preview navigation model — extraction + adoption spec (v1)

| | |
|---|---|
| **Status** | READ-ONLY extraction — decision-ready spec, uncommitted; no app changes |
| **Date** | 2026-07-11 |
| **Source** | `public/preview-app/steppe-exchange.html` (`93a0c926…`), decompiled as in `preview-parity-audit-v1.md`; citations are `inner.html:<line>` in the decompiled source |
| **Companion** | `preview-parity-audit-v1.md` (X1/M1/GR1 absences referenced below) |

---

## 1 · NAV MODEL — what the bundle actually depicts

**Bottom tab bar** (inner.html:1132-1140): bone ground, **2px ink top rule**, 72px incl. an 18px home-indicator inset (`--tab-h`, :382), four equal-width tabs, z-above sheets/toasts.

| # | Key | EN label | ES label | Icon |
|---|---|---|---|---|
| 1 | `exchange` | EXCHANGE | INTERCAMBIO | **none — the tab bar is typographic** |
| 2 | `groups` | GROUPS | GRUPOS | none |
| 3 | `govern` | GOVERN | GOBERNANZA | none |
| 4 | `you` | YOU | TÚ | none |

(order/keys :1880; labels :1560/:1612, rendered UPPERCASE mono 10px `.1em` :1881-1883)

- **No icons anywhere in the tab bar.** Each tab = a 7px rust **blaze triangle** (drawn in CSS, active only; inactive tabs reserve the same 7px transparent so labels never shift) above the mono label (:1882).
- **No tab badges.** The only indicator in the shell is the **unread DOT** on the header **Messages** icon (:452-454) — "quiet signals only — unread is a DOT, never a number" (:1518). Open votes get no tab indicator; participation status (VOTED / NOT-YET chips) lives inside Govern content (:1502).
- **Messages is not a tab** — it sits behind a round header icon beside search (:446-455; "Tab bar — Exchange · Groups · Govern · You — + Messages behind the header icon" :1534).
- **No Home tab.** Exchange is the root (initial state `tab:'exchange', route:'feed'` :1151-1152); the **You** tab is the profile surface — masthead becomes the member's name, dateline their neighborhood + member-since, voice the privacy line (:1914-1917). You-tab sections, in order (:2013): Posts · Saved · Groups · Governance (private) · Membership · Data export · Settings · **Sign out** (rust, :1451).
- Per-tab shell: one compacting masthead nav; masthead/dateline/voice swap per tab; **search shows on Exchange + Groups only** (:1904-1917). The Govern dateline/voice carry the CD-1 + anti-bandwagon language verbatim (:1911-1912).

## 2 · STATE BEHAVIOR

- **Active tab:** ink label + rust blaze; inactive ink-soft (:1882-1883).
- **Tab tap — including re-tap of the active tab:** `goTab()` has no same-tab guard; every tap **pops to that tab's root and resets everything** — route→feed, closes messages/compose/search/detail/ballot/fund/event/edit-public/ics, clears query, resets scroll (:1720-1722, :1469). Re-tap-to-reset comes free; adopt it.
- **Gating: none.** All four tabs are always tappable — the bundle depicts a **verified-member world only** (no intake/verify screens exist in it; see parity audit scope note). `tabSoon` ("Lives in the full app" :1560) is defined but **never rendered** — vestigial.

## 3 · ROUTE MAP — preview destination → app reality

| Preview destination | App route today | Status | Recommendation |
|---|---|---|---|
| Exchange (tab 1) | — | **ABSENT** (X1, closed-beta build; no schema) | **Omit the tab at beta start; Events takes slot 1** (below). A placeholder tab violates the bundle's own "never a dead button" ethos (:1455) |
| Groups (tab 2) | `/protected/groups` | ✅ live (phase 1b) | Adopt as-is |
| Govern (tab 3) | `/protected/governance` | ✅ live | Adopt; nav label already "Govern" |
| You (tab 4) | `/protected/account` (+ home status content) | **Partial** (Y1/Y4: no per-field visibility, no saved/posts) | Adopt the tab with today's account + status content; sections fill in as X1/M1 land |
| Messages (header icon) | — | **ABSENT** (M1, in scope, no schema) | **Omit the icon until M1 ships** — an unread-dot affordance with no inbox is a dead button |
| Group feed/events inside groups | about+members only | **ABSENT** (GR1, explicitly phase-deferred) | No nav impact now; lives inside Groups when built |
| Search (header, Exchange/Groups) | groups directory search only | Partial | Keep in-page search; add the header affordance when Exchange ships |

> **Adoption note (2026-07-11):** the You surface ships without the bundle's
> Posts / Saved / Membership / Settings rows — deliberately absent pending
> their features (Exchange X1, bookmarks, dues, settings). No dead rows.

**Slot-1 recommendation:** launch tab set **EVENTS · GROUPS · GOVERN · YOU**. Rationale: Events is today's chronological, participation-first surface — the closest live analog to the Exchange feed's role (the temporal heart of the app); it preserves the bundle's 4-slot geometry and typographic style, and when X1 ships, Exchange takes slot 1 and Events folds into its bundle-native homes (an Exchange category :1189 + per-group Upcoming :1443) — one deliberate migration, no placeholder era.

## 4 · CURRENT-NAV DISPOSITION (today's top nav + drawer → new model)

| Today | Disposition | Rationale |
|---|---|---|
| Events | **Tab 1** (interim, → Exchange later) | above |
| Groups | **Tab 2** | 1:1 |
| Govern | **Tab 3** | 1:1 |
| Account | **Tab 4 "You"** — tab label YOU/TÚ (canon :1560); page h1 stays "Your account" | tab names the place, page names the artifact (same rule as the Govern rename) |
| Home (`/protected`) | **Masthead tap → `/protected`**; its status cards migrate into You over time | bundle has no Home tab; the masthead is the only brand-anchor affordance |
| Neighborhood | **You section** (beside Membership/Settings) | bundle files residency under the profile surface (dateline + field :1312) |
| Transparency | **Govern segment ("the Record")** | the bundle's public record lives inside Govern (:1542, `recordIntro` :1579) — not a top-level destination |
| Reviews (moderator) | **You → role-gated section** (with Appeals) | moderation plumbing, not a primary destination (audit IA concern); the bundle exposes no moderator surfaces at all |
| Appeals (moderator) | same | same |
| Language toggle | **Shell header** — EN|ES segmented control, expanded + compact states (:443-444, :468-469) | exactly where the bundle puts it |
| Sign out | **You → last section, rust** (:1451, :2013) | bundle-native |

Net: the top-nav/hamburger model is replaced on mobile by 4 typographic tabs + a shell header (language, later search/messages); everything else files under You or inside Govern.

## 5 · DESKTOP NOTE (bundle is phone-only — minimal mapping, nothing invented)

- **< 768px:** the tab bar above, replacing the hamburger sheet.
- **≥ 768px:** **retain today's top nav rail** (already aligned to `--content-max`) carrying the same four destinations in the same order + the You/account dropdown; hide the bottom tabs. No sidebar, no second column — the desktop column composition (2586d51-era) already gives the phone sheet room, and the top rail is the existing, shipped desktop pattern.
- One shared source of destination order/labels so tab bar and rail can't drift.

---

## Decision list (each with the recommendation above)

1. **Slot 1 at beta start:** Events (recommended) — not an Exchange placeholder.
2. **Messages icon:** omit until M1 (recommended) — no dead buttons.
3. **Tab 4 label:** YOU/TÚ (recommended; supersedes the copy-plan's "keep Account" default at the *nav* level only — the page keeps its name).
4. **Transparency:** move under Govern as the Record segment (recommended) — one fewer top-level item, bundle-native.
5. **Reviews/Appeals:** role-gated You sections (recommended) — de-clutters primary nav.
6. **Re-tap = pop-to-root + scroll reset:** adopt (recommended) — free behavior from the bundle's `goTab`.

*Implementation is one nav component + route wiring; no schema. Not started — awaiting your calls on 1–5.*
