# Preview ↔ app parity audit — v1

| | |
|---|---|
| **Status** | READ-ONLY findings — nothing changed, nothing committed with this doc |
| **Date** | 2026-07-11 |
| **Bundle** | `public/preview-app/steppe-exchange.html` (`93a0c926…`, the CD-1 re-export) — decoded to its virtual files (token layer, component/interaction/constraint inventory, EN/ES strings, demo data) |
| **App** | live routes/components at `6537738` |
| **Method** | bundle decompiled and read in full; app surfaces mapped by two read-only sweeps (govern/verify/account/nav + groups/events/join); schema checked directly |

**Changelog** — v1 (2026-07-11): first parity pass, three layers (tokens / screens / promises).

**Standing mitigation:** the /preview page frames the bundle honestly — *"A preview, not the finished product"*, *"Everything here is the shape of the first version."* That materially lowers the severity of shown-but-absent items **on /preview**. It does NOT cover promises made on unhedged surfaces (/privacy, /partners), which are called out below.

**Scope note:** the bundle depicts a **post-verification member experience only** — it contains **no join/intake, no verify, no onboarding screens** (routes: Exchange · Groups · Govern · You + Messages/events/compose). So the July-23 `/join` surface has no bundle counterpart to diverge from; its findings are token-layer only.

---

## Layer 1 — Brand tokens

Fonts: **match** (Besley / Schibsted Grotesk / Martian Mono on both sides since `88a7cf7`). Core palette: **match** — paper/bone/ink/ink-soft/rust/juniper/sage/sage-deep/ochre/basalt are hex-identical to `tokens.css`. The divergences are structural, not chromatic:

| # | Token axis | Bundle (its own stated doctrine) | App | Verdict | Sev |
|---|---|---|---|---|---|
| T1 | **Primary action** | juniper-**deep** `#2B4733` fill, pressed `#22382A`; `#36563D` reserved for links/titles (inner.html:349, CONSTRAINTS: "Primary action = juniper-deep fill") | `--primary` = `#36563d` (globals.css:49) | App off-canon (one HSL swap + hover) | should-fix |
| T2 | **Surface model** | one **paper** sheet, hairline dividers `rgba(42,46,44,.22)`, bone = pressed/raised; **no cards** | bone page + paper **cards** (`rounded-lg border bg-card`) everywhere | Different vocabulary; bundle is canon for in-app | should-fix |
| T3 | **Radii** | square-first: `--r-flat:0` surfaces, 2px markers, 14px message bubbles only (inner.html:385) | `--radius: 0.5rem`; `rounded-md/lg/xl` throughout; join.css 18/10/11px | App off-canon in-app; /join is marketing-side (its 18px also ≠ the marketing `--r:14px`) | should-fix |
| T4 | **Elevation** | "no drop shadows in-app" — letterpress inset only (inner.html:389-390) | `shadow`/`shadow-sm` on Card/Button/Input; join.css `0 18px 42px -24px` | App off-canon in-app; /join shadow is marketing-side license | should-fix |
| T5 | **Focus/accent discipline** | rust = accent ONLY (markers/active/chevron/drop-cap/sun); inputs focus **juniper** border (.bp-in:403) | `--ring` = rust; input border sage-deep | Divergent focus language | cosmetic |
| T6 | **Dividers** | ink-alpha hairline | sage-soft `#c3cdb6` borders | Green-tint vs ink hairline | cosmetic |
| T7 | **Type vocabulary** | Besley roman titles 40/26/24; mono UPPER kickers `.12em`; mono bylines + verified glyph; italic = voice lines only | h1 `text-2xl font-serif`; no kicker/dateline/byline/masthead vocabulary in member app | App lacks the broadsheet register the preview establishes | should-fix |
| T8 | New bundle tokens | `--goods #8C6A45`, `--vote-pass/fail/abstain`, `--turnout-track/fill`, `--quorum-mark` | absent (features absent) | Fold into tokens.css when Exchange/Govern build-out ships | note |

**Fix direction (T1–T7):** a member-app retheme pass — `--primary`→`#2B4733`, `--radius`→0 with hairline borders, drop shadows→flat/letterpress, add kicker/masthead utility classes. One tokens-level commit plus a sweep of `rounded-*`/`shadow-*` usages; no per-page overrides.

---

## Layer 2 — Screen parity (launch-priority order)

### /join intake (July-23 surface) — **no bundle counterpart; healthy**
Bundle depicts no intake. The app's `/join` (fields, honeypot, success/dup states, QR A/B) is fully built and matches its own marketing layer. Only finding: **J1 (cosmetic)** — join.css radii (18/10/11px) sit outside both token systems (marketing 14px, in-app 0); align when convenient.

### Verify — **no bundle counterpart; consistent**
Bundle carries only the "verified, then forgotten" profile label + "Verified neighbor" glyphs; the app's five-method human-review flow and its copy match that posture. **V1 (cosmetic):** app has no "Verified neighbor" byline glyph vocabulary yet (no bylines at all until Exchange).

### Govern — richest divergence
| # | Bundle shows | App reality | Verdict | Sev |
|---|---|---|---|---|
| G1 | **Turnout-toward-quorum while open** — ruled track to the 15% tick, "never the yes/no split" (anti-bandwagon, CONSTRAINTS:1526); VOTED/NOT-YET chip | Nothing shown while open ("No tally is shown here", governance/[id]/page.tsx:211); `proposal_results` is closed-only | Shown-but-absent. **App should change**: an aggregate open-turnout count is secrecy-safe (count ≠ choices) but needs a deliberate DB surface (e.g. a `proposal_turnout` security-definer view/RPC) — schema change, flag before building | **CD** |
| G2 | **Candidates ballot** (board election, "choose up to two") | `vote_choice` enum = yes/no/abstain only | Shown-but-absent. Fork: charter (05, stewards/recall) implies the app eventually needs it → **app should change (post-launch phase)**; until then **preview over-promises** | **CD** |
| G3 | **Ranked-choice community fund** ($8,400, drag-to-rank, "Ranking recorded · change until close") | No surface, no schema | Shown-but-absent — but `/partners` **publicly promises** "Members allocate it yearly by ranked-choice vote" (p4b), so this is product roadmap, not preview invention. **App should change (phase)**; preview acceptable under its disclaimer | **CD** |
| G4 | **Fixed thresholds as UI** — "To pass 60%", 75% foundational, 15% quorum, 60% recall; outcome chips PASSED/FAILED with % | Deliberately none: numbers are provisional config for the cohort to ratify; outcome is human-read (invariant 5; CLAUDE.md open items) | **Bundle-side defect**: presents provisional numbers as fixed and outcomes as auto-computed. **Preview should change** (label the numbers "proposed defaults · cohort ratifies") — or the cohort ratifies and the app renders them *from config*. Recall exists nowhere in the app | **CD (preview)** |
| G5 | "Reached the ballot by member petition · 142 signatures" | No petition mechanism | Preview over-promises (minor, one line) | should-fix (preview) |
| G6 | The Record — past decisions with outcome chips + % | Closed proposals list + aggregate results (revealed-gated) exists; no chip/% presentation | Partial parity; presentation only | cosmetic |
| G7 | Secret ballot; change-vote-until-close; "Your ballot is recorded"; CD-1 weight line | All implemented verbatim-equivalent (vote-form.tsx:73,90; upsert; voteSaved; resultsNote) | **Parity** ✓ (CD-1 closed) | — |
| G8 | Quorum concept (15% of members) | Privacy floor (ballots ≥ 5 reveals breakdown) — a different mechanism with a similar name | Terminology note for the cohort ratification conversation | note |

### Groups
| # | Bundle | App | Verdict | Sev |
|---|---|---|---|---|
| GR1 | **Group feed** — posts with replies, per-group compose FAB, "3 posts this week" activity line | Explicitly deferred: "Future phases add Posts · Events · Listings · Chat… phase 1b ships About + Members only" ([slug]/page.tsx:257) | Shown-but-absent, **roadmapped** (Spec v2). **App should change (phase)** | **CD** |
| GR2 | Group **events** + RSVP inside groups | Events exist app-wide (neighborhood-first), not per-group | Partial — model divergence to reconcile in the calendar phase | should-fix |
| GR3 | Yours/Discover segments | Directory + search + category filter | Equivalent function, different vocabulary | cosmetic |
| GR4 | Join/Joined/Leave one-tap; member counts | Implemented incl. request/invite policies (richer than bundle) | **Parity+** ✓ | — |

### Events
| # | Bundle | App | Verdict | Sev |
|---|---|---|---|---|
| E1 | **"A quiet count — no names shared unless a neighbor opts in"** (RSVP) | App lists attendee **names** (+ bringing) to all verified viewers ([id]/page.tsx:259-296) | **Posture divergence — app shares more than the preview promises.** Fork: treat RSVP-with-name as inherent opt-in (then soften the preview line) or make name-sharing opt-in (schema + UI). Founder call | **CD** |
| E2 | Add to calendar — .ics with copyable-details fallback, "never a dead button" | Absent | Small, launch-adjacent win. **App should change** | should-fix |
| E3 | Going/Maybe/**Can't** | Going/Maybe only (+ cancel) | Minor state gap | cosmetic |
| E4 | Message the host | No messaging (→ M1) | rolls into M1 | — |

### The Exchange + Messages — the two headline absences
| # | Bundle | App | Verdict | Sev |
|---|---|---|---|---|
| X1 | **The Exchange** — the bundle's eponymous tab: 6 categories, pinned-by-stewards, compose, search, chronological feed | **No route, no `listings` table** — zero footprint | Shown-but-absent; moved INTO closed-beta scope (DECISIONS 2026-07-04) → **app should change (the next major build)**; until then /preview's disclaimer carries it | **CD** |
| M1 | **Messages** — inbox, threads, in-card compose ("one store, no duplicate channel"), mute/leave/block/report, unread dot | **No `messages`/`threads` table, no UI** | Shown-but-absent; member messages also in closed-beta scope → **app should change (phase)** | **CD** |

### You / Account
| # | Bundle | App | Verdict | Sev |
|---|---|---|---|---|
| Y1 | **Edit-what's-public** — per-field visibility, "Nothing here is shared until you choose it" | No per-field control; fixed policy (public_profiles = display_name only) | Shown-but-absent — and **the live /privacy page promises it unhedged** ("Every field starts hidden. You choose, one at a time"). Fork: build per-field visibility (schema + UI) **or** revise the /privacy promise — which is **COUNSEL-GATED**. Highest-priority CD because the promise is live today | **CD** |
| Y2 | Username/@handle ("@you", "How neighbors find you") | `display_name` only, no handle | Same promise-grade issue: /privacy + /legal/terms say "members are known by a username." Same fork as Y1 | **CD** |
| Y3 | Membership row "$4/mo · hardship waiver available" | No payments in prototype (by design) | Informational only in bundle; fine. Keep no-payments | note |
| Y4 | Sections: Posts · Saved · Groups · Governance · Settings | Account = export + delete; no saved/bookmarks, no activity surfaces | Partial; Posts/Saved depend on X1. (Bundle's own "no counts" constraint vs its "3 active · 5 listings" subs is an internal tension — don't copy the counts) | should-fix (later) |
| Y5 | Data export "Export anytime" | Implemented, thorough (11 tables, evidence excluded) | **Parity+** ✓ | — |

### Navigation / shell
| # | Bundle | App | Verdict | Sev |
|---|---|---|---|---|
| N1 | Bottom **tab bar** (Exchange·Groups·Govern·You) + Messages icon; compacting broadsheet masthead (strata, dateline, italic voice) | Top nav + dropdown; hamburger sheet on mobile | Structural gap; full parity only makes sense when Exchange/Messages exist. Mobile-first invariant favors the tab bar **when the tabs exist** | should-fix (phase-gated) |
| N2 | Empty states: strata art + Besley line + sub ("A quiet column today") | Dashed-border muted text | Vocabulary gap, cheap to adopt | cosmetic |
| N3 | Skeleton shimmer / pull-to-refresh / toasts | Server-rendered; no skeleton/toast vocabulary | Web-vs-native texture; adopt selectively (toasts exist as inline status text) | cosmetic |
| N4 | EN/ES in-shell toggle | Language toggle in nav ✓ | **Parity** ✓ | — |

---

## Layer 3 — Promise matrix

| Capability the preview implies | Status in app | Direction |
|---|---|---|
| Secret ballot, never attributable | **Implemented** (RLS: no votes read policy) | — |
| Change vote until close | **Implemented** | — |
| Tenure weighting 1×–3×, member-amendable, launch-equal at 1× | **Implemented** (CD-1 aligned everywhere) | — |
| Results only after close | **Implemented** (view gate) | — |
| Turnout visible *while open* (toward quorum) | **Absent** | app (G1, schema-touching) |
| Quorum 15% / 60% / 75% / recall as fixed rules | **Different by design** (provisional config, human-read close) | preview (G4) |
| Candidates ballots (elections) | **Absent** | app-later / preview-now (G2) |
| Ranked-choice community fund | **Absent** (publicly promised on /partners) | app-later (G3) |
| Group join/leave one-tap + policies | **Implemented+** | — |
| Group posts/feed + replies | **Absent** (explicitly phase-deferred) | app-later (GR1) |
| Group events | **Partial** (app-wide events) | app-later (GR2) |
| Event RSVP + bringing | **Implemented** | — |
| RSVP "quiet count", names opt-in | **Divergent** (names shown) | founder call (E1) |
| Add to calendar (.ics + fallback) | **Absent** | app (E2, small) |
| The Exchange (listings, 6 categories, chronological) | **Absent** (in closed-beta scope) | app-later (X1) |
| Messages inside Steppe (threads, block/report) | **Absent** (in scope) | app-later (M1) |
| Per-field profile visibility | **Absent** — live /privacy promises it | founder + counsel (Y1) |
| Username/pseudonymity to peers | **Partial** (display_name; no handle) | founder + counsel (Y2) |
| Data export anytime | **Implemented+** | — |
| Verified-neighbors-only participation | **Implemented** (the substrate) | — |
| No ads / no ranking / chronological | **Implemented** (invariants) | — |
| Report → steward, privately | **Partial** (moderation exists; no per-listing report until X1) | app-later |

**Tally: 10 implemented · 4 partial · 9 absent** (of which 6 are roadmapped in-scope phases, 2 are founder/counsel forks, 1 is preview-side).

---

## Severity summary

| Tier | Count | Items |
|---|---|---|
| **CANON-DEFECT class** (shown-but-absent or doctrine conflict) | 9 | X1 Exchange · M1 Messages · GR1 group feed · G1 open-turnout · G2 candidates ballots · G3 fund ranking · G4 thresholds-as-fixed (**preview-side**) · E1 RSVP names posture · Y1/Y2 per-field visibility + username (**promise-grade, /privacy is live and unhedged**) |
| Blocking | 0 | Nothing breaks the July-23 visitor path (/join is healthy; /preview self-discloses) — but Y1/Y2 sit closest to the line because the /privacy promise is live |
| Should-fix | 7 | T1 primary fill · T2 surface model · T3 radii · T4 elevation · T7 type vocabulary · GR2 group events model · E2 .ics · G5 petition line (preview) · N1 tab bar (phase-gated) · Y4 account sections (later) |
| Cosmetic | 7 | T5 focus color · T6 dividers · J1 join radii · V1 byline glyph · GR3 segments · E3 "Can't" · G6 record chips · N2 empty-state art · N3 skeleton/toast |

**The two-fix split, explicitly:**
- **App should change:** T1–T7 retheme; G1 (with schema care); E2; then the roadmapped builds X1 → M1 → GR1/GR2 → G2/G3 (already in closed-beta scope per DECISIONS 2026-07-04).
- **Preview over-promises / preview should change:** G4 (present thresholds as proposed defaults), G5 (petition line), and — pending your E1 call — possibly the RSVP "quiet count" line.
- **Founder + counsel forks (decide before either side changes):** Y1/Y2 (build per-field visibility + handles, or revise the counsel-gated /privacy and terms wording) and E1 (names-on-RSVP posture).

*No fixes were made in this pass. Recommended next step: decide Y1/Y2 and E1 (they gate copy vs. build), then a single token-retheme commit (T1–T7), then the G4 preview copy tweak at the next re-export.*
