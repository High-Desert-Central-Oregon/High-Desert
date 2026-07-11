# Copy & voice audit — v1

| | |
|---|---|
| **Status** | Audit only — no copy changed |
| **Date** | 2026-07-10 |
| **Source of truth** | `/preview` (`steppe/messages/en.json` → `preview` namespace, which carries the page copy and mirrors the embedded export's UI strings) |
| **Corpus audited** | `steppe/messages/en.json` (site), `steppe/lib/i18n/dictionaries/en.ts` (member app), `docs/ops/email-templates/generate.mjs` (5 auth emails), `interestEmail` namespace, `/welcome`, auth pages, `/not-found`, error page, QR routes `/q` `/p` |
| **Companion** | `copy-voice-plan-v1.md` (the rewrite plan) |

**Changelog**
- v1 (2026-07-10): first full audit. Contract extracted from /preview; every other user-facing surface graded against it.

---

## Part 1 — The voice contract (extracted from /preview)

Every rule cites lines quoted verbatim from `messages/en.json → preview`.

- **R1 · Short declaratives.** One idea per sentence; most under ~15 words. *"Nothing is ranked or boosted."* · *"Your ballot is secret, and at launch everyone's counts the same."*
- **R2 · Second person, present tense, direct.** *"Join what you like. You can leave any time."*
- **R3 · Concrete vocabulary.** neighbor, member, ballot, listing, group, vote. Never platform-speak (*users, content, engagement*) or marketing adjectives.
- **R4 · CTAs are bare concrete imperatives, 1–3 words.** *"Post" · "Send" · "Join" · "Cast your ballot" · "Post listing" · "Add to your calendar."* No "Get started," no "Learn more."
- **R5 · Headings are clipped phrases or short sentences, sentence case, often with a terminal period.** *"One honest feed." · "Groups you choose." · "Private until you say so."* No colon headlines, no title case.
- **R6 · States are factual and calm; empty states may add one gentle nudge.** Empty: *"Nothing in this category yet."* · *"No messages yet. Say hello."* Loading: *"Loading the preview…"* Success: *"Ballot recorded, and secret."*
- **R7 · Promises are stated as flat facts, never hype.** *"Messages stay inside Steppe. Your email and phone are never shared."*
- **R8 · Meta/receipt lines use `·` separators.** *"No ads · no tracking · messages stay inside Steppe."*
- **R9 · Hedging is honest and about the product, never the reader.** *"A preview, not the finished product." · "Marketplace · later, by vote."*
- **R10 · Warmth by content, not punctuation.** Contractions yes (*"it's your call"*); **zero exclamation marks**, zero emoji (one `✓` state glyph).

### CANON-DEFECT items (defects inside /preview itself — approval required, fixed first)

| ID | Where | Defect | Class |
|---|---|---|---|
| **CD-1** | `messages/en.json:422` (`preview.votedP`): *"At launch every member's vote counts the same; members can later vote to weight by tenure."* and `:449` (`capGovernP`): *"at launch everyone's counts the same."* | **Contradicts the shipped product.** The live schema weights votes by tenure now (1×/1.5×/2×/3×, Business Plan v12, provisional pending cohort ratification), and the member app says so: `lib/i18n/dictionaries/en.ts:446-447` (`governance.resultsNote`): *"Tenure-weighted totals, aggregate only."* One of the two must change; that is a founder/governance decision, not a copy edit. `es.json` mirrors the same claim. | Content accuracy (blocking-class, approval-gated) |
| CD-2 | `messages/en.json:408` (`preview.joined`): *"Joined ✓"* | Only glyph in the system; the member app uses the word *"Member"* for the same state (`en.ts:202`). Harmless — recorded only so the state vocabulary is chosen deliberately. | Cosmetic |

No AI tropes were found in /preview. The canon is otherwise clean.

---

## Part 2 — Findings by surface

Graded against R1–R10 plus the trope list. Launch surfaces first. **B** = blocking, **SF** = should-fix, **C** = cosmetic.

### Launch surface: /welcome (Terms gate)

| # | File:line | Current | Finding | Sev |
|---|---|---|---|---|
| 1 | `lib/i18n/dictionaries/en.ts:83-84` (`welcome.draftNotice`) | *"Draft for review — pending Oregon legal review. The final wording may change before public launch."* | **Stale content.** Legal review is complete (confirmed 2026-07-10). Showing final terms under a "draft" banner misstates their status at the gate where consent is recorded. Must be removed/replaced when the reviewed v1.0 documents are seeded. (The gate chrome is app copy, not the counsel-gated legal text itself.) | **B** (at launch) |

Everything else in `welcome.*` conforms (R1, R6, R10 — *"Thanks for reading to the end."* is warmth by content).

### Launch surface: verification flow (/protected/verify)

| # | File:line | Current | Finding | Sev |
|---|---|---|---|---|
| 2 | `en.ts:319-320` (`verify.forget`) | *"We keep only that you're verified and which method you used — never the document itself."* | **Inconsistent promise enumeration.** The privacy page (canonical, counsel-aligned) enumerates three retained facts: *"you're verified, the date, and the method"* (`messages/en.json:272`, `:294`). This surface omits **the date**. The verify screen is where the promise matters most; the enumeration must match everywhere. | **SF** |

The rest of `verify.*` is canon-grade (the `postcard_code` hint is a model of R3/R7).

### Launch surface: QR landing (/q, /p → /join)

| # | File:line | Current | Finding | Sev |
|---|---|---|---|---|
| 3 | `messages/en.json:231` (`join.fsub`) | *"…And don't worry, we will scale to all of Central Oregon."* | Two contract breaks in one clause: *"don't worry"* is reader-directed reassurance filler (R9 violation) and *"scale"* is startup vocabulary (R3). The es mirror carries both (*"Y no te preocupes, llegaremos a…"*). This is the first sentence-cluster a QR scan reads. | **SF** |
| 4 | `messages/en.json:224` (`join.step2B`) | *"Pay once a year or by bank transfer or take the hardship waiver."* | Double-"or" chain; one comma fixes the rhythm (R1). | C |

`/q` and `/p` themselves are copy-free redirects; `/join` is their landing copy. The rest of `join.*` conforms — `term2B` (*"What you can pay never decides whether you belong."*) is canon-grade.

### First-run: auth (login / sign-up)

| # | File:line | Current | Finding | Sev |
|---|---|---|---|---|
| 5 | `en.ts:60-61` (`auth.subtitle`) + `en.ts:67-68` (`auth.checkEmailBody`) | *"…We email you a secure link…"* / *"…we sent a secure sign-in link to {email}…"* | *"Secure"* is a reassurance adjective; the canon states concrete facts instead (R7: *"The link works once and expires soon"*). Both sentences already carry the concrete fact — the adjective is the only non-canon residue. Note: `checkEmailBody`'s *"If that address can join…"* is deliberate anti-enumeration phrasing — keep its meaning untouched. | **SF** |

### First-run: home (/protected)

| # | File:line | Current | Finding | Sev |
|---|---|---|---|---|
| 6 | `en.ts:104-105` (`home.nextBody`) | *"Verifying that you live in Redmond **unlocks** neighborhood events and the community vote."* | The corpus's **only stock-vocabulary hit** (*unlock* — gamification verb, on the trope list). | **SF** |

### Member app: navigation vocabulary

| # | File:line | Current | Finding | Sev |
|---|---|---|---|---|
| 7 | `en.ts:37` (`nav.governanceLink`) | *"Proposals"* | Vocabulary drift from canon: the /preview tab set is **Exchange / Groups / Govern / You**. The canon name for the surface is *"Govern"* (also `preview.governH`). *"Proposals"* names the artifact, not the place. | **SF** |
| 8 | `en.ts:40` (`nav.accountLink`) | *"Account"* | Same drift class: canon tab is *"You"* (`preview.tabYou`, `capYouK`). Weaker than #7 — *"Account"* is arguably clearer next to "Your account" page copy. Founder's call; recorded as drift. | C |

### Member app: groups

| # | File:line | Current | Finding | Sev |
|---|---|---|---|---|
| 9 | `en.ts:184-185` (`groups.intro`) | *"Community groups — boards, calendars, **and more**."* | *"And more"* is vague filler (hedged-filler class); the canon never trails off — it enumerates or stops. | **SF** |
| 10 | `en.ts:208` (`groups.confirmLeave`) | *"You'll lose access to members-only **content**."* | *"Content"* is platform-speak (R3); the things are posts and events. | C |

### Member app: four-promises wording

| # | File:line | Current | Finding | Sev |
|---|---|---|---|---|
| 11 | `en.ts:43-56` (`landing.*`) | Entire block (*"A neighborhood you can trust."* + 4 commitments) | **Apparently dead copy.** No reference to `landing.*` found anywhere in `app/`, `components/`, or `lib/` outside the dictionaries — the (site) marketing landing replaced it. It carries a divergent tagline and a third variant wording of the entrenched promises, which can resurface if reused. Confirm and remove (or align if actually reachable). | **SF** |
| 12 | cross-surface | Marketing clauses (`messages/en.json:68-75`), partners short forms (`:139-143`), app commitments (`en.ts:50-55`) | The entrenched promises exist in **three variant phrasings** (e.g. *"then forget the documents"* / *"then instantly delete what you sent"* / *"Residency verified, then forgotten"*). Variation reads as intentional register-shifting per surface and none misstate the promise — but there is no single canonical short form to reuse. | C (recorded; resolve via plan, not per-page edits) |

### Emails (Supabase auth + interest)

| # | File:line | Current | Finding | Sev |
|---|---|---|---|---|
| 13 | `docs/ops/email-templates/generate.mjs:36` (invite) | *"…a community-owned **civic space** for verified Redmond neighbors."* | Terminology drift: everywhere else says *civic infrastructure* or *commons* — never "civic space." | C |

`magic-link`, `confirm-signup`, `email-change`, `reauthentication`, and the interest confirmation all conform (R1/R4/R6/R7; the magic-link security note mirrors the canon's fact-style reassurance).

### Minor register notes (no action urged)

- `en.ts:131-132` (`neighborhoods.noneConfirmBody`): *"Your response is noted."* — mildly bureaucratic beside the otherwise warm block. C.
- `messages/en.json:326` (`contact.heroLead`): three-option opener is a genuine option list, not rhythm filler. No action.
- `partners.s3B` triad (*"ad-free, privacy-respecting, and impossible to acquire"*): three distinct properties, funder register; deliberate. No action.
- `error.*` / `notFound.*` (`en.ts:546-556`): *"That's on us, not you."* and *"back to familiar ground"* — canon-grade; keep.

### Trope sweep — clean bill

Checked across all catalogs + email copy: **0** exclamation marks, **0** emoji (one deliberate `✓`), **0** "not just X, it's Y" frames, **0** grandiose openers ("Imagine…", "In a world…"), **0** "Whether you're X or Y" / "designed to help you" hedges, **0** hits for *seamless / empower / elevate / journey / vibrant / robust / delve / foster / harness / thrive / dive in / effortless / game-changing*. **1** stock-vocab hit total (*unlocks*, finding #6). No colon-headline or em-dash-headline patterns; heading style is uniformly R5.

---

## COUNSEL-GATED register (flag only — zero proposals)

| Surface | Why gated |
|---|---|
| `messages/en.json:260-322` (`privacy.*` — the /privacy plain-language page) | Aligned with the legal-reviewed policy; its enumerations (e.g. *"verified, the date, and the method"*) are the canonical promise wording other surfaces must match — it must not itself be edited outside counsel review. |
| `/legal/privacy`, `/legal/terms` page bodies + the seeded `documents` rows | The legally reviewed text. Style/layout only, zero copy changes. |
| `welcome.*` gate chrome | NOT gated (app copy), except it must never paraphrase the legal text it frames. Finding #1 applies. |

---

## Severity summary

| Severity | Count | Items |
|---|---|---|
| **CANON-DEFECT** (approval first) | 1 (+1 cosmetic) | CD-1 vote-weight contradiction (with es mirror); CD-2 `✓` glyph note |
| **Blocking** | 1 | #1 `welcome.draftNotice` stale after legal-final |
| **Should-fix** | 7 | #2 verify enumeration · #3 join "don't worry / scale" · #5 auth "secure" ×2 · #6 "unlocks" · #7 nav "Proposals"→"Govern" · #9 groups "and more" · #11 dead `landing.*` block |
| **Cosmetic** | 6 | #4, #8, #10, #12, #13, register notes |

`es.json` / `es.ts` mirror every finding key-for-key; the plan treats ES as paired edits, never independent rewrites.
