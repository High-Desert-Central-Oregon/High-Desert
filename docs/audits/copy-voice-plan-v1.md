# Copy & voice rewrite plan — v1

| | |
|---|---|
| **Status** | Plan only — nothing implemented; awaiting founder approval |
| **Date** | 2026-07-10 |
| **Basis** | `copy-voice-audit-v1.md` (finding numbers below refer to it) |
| **Ground rules** | String keys and i18n structure unchanged · every EN edit lands with its ES pair · `/privacy` + legal texts COUNSEL-GATED (zero changes) · `/preview` untouched except approved CANON-DEFECT fixes, which land **first** · one logical DCO-signed commit per group |

**Changelog**
- v1 (2026-07-10): first plan, from audit v1.

---

## Section A — CANON-DEFECT fixes (require explicit approval; land before all conforming rewrites)

### CD-1 · /preview vote-weight claim vs the live product — **founder decision required**

`preview.votedP` and `preview.capGovernP` say every vote counts the same at launch; the shipped schema weighs by tenure now (1×–3×, provisional pending cohort ratification), and `governance.resultsNote` says so. Two honest resolutions — pick one:

**Option 1 (recommended): make /preview match the product.**
> **Before** (`messages/en.json:422`): "No one can see how you voted. At launch every member's vote counts the same; members can later vote to weight by tenure."
> **After:** "No one can see how you voted. Ballots are weighted a little by how long you've been a member — the founding members vote on whether that stays."
>
> **Before** (`:449`): "Your ballot is secret, and at launch everyone's counts the same."
> **After:** "Your ballot is secret, and results are shown only as totals."

Satisfies R7 (flat facts) and R9 (honest hedging about the product — the weights are provisional and the copy says so). ES pair updated in the same commit.

**Option 2: make the product match /preview** — set all tenure weights to 1× at launch and let the cohort vote weighting in. That is a governance/config change (out of copy scope, one line in `vote_weight_for()` config), not a rewrite; this plan only records it as the alternative.

*Until CD-1 is decided, no other copy on the governance surfaces changes.*

### CD-2 · "Joined ✓" glyph (cosmetic, optional)
No change proposed. If you want one state vocabulary: `preview.joined` → "Member" (matches `en.ts:202`). Recorded only.

---

## Section B — Conforming rewrites (before → after, each citing its contract rule)

### Group 1 · Launch surfaces (`/welcome`, verify, `/join`) — **commit 1**

**#1 · `welcome.draftNotice` (en.ts:83-84) — BLOCKING, conditional on the reviewed docs being seeded**
> **Before:** "Draft for review — pending Oregon legal review. The final wording may change before public launch."
> **After (replace):** "Version {version}. Plain language on purpose — this is the wording you're agreeing to."
>
> R7 (flat fact), R9 (honest, about the document). Ships **in the same deploy** that seeds the legal-reviewed v1.0 `documents` rows — never before. If v1.0 isn't seeded by launch, the notice stays.

**#2 · `verify.forget` (en.ts:319-320)**
> **Before:** "We delete your document the moment a reviewer decides. We keep only that you're verified and which method you used — never the document itself."
> **After:** "We delete your document the moment a reviewer decides. We keep only that you're verified, the date, and the method — never the document itself."
>
> Matches the counsel-aligned enumeration verbatim (`privacy.cCB`: *"we keep only that you're verified, the date, and the method"*). R7.

**#3 · `join.fsub` (messages/en.json:231)**
> **Before:** "We're getting Steppe ready to open in Redmond. Leave your email and we'll tell you the moment it does. And don't worry, we will scale to all of Central Oregon."
> **After:** "We're getting Steppe ready to open in Redmond. Leave your email and we'll tell you the moment it does. Central Oregon comes next."
>
> Drops reader-directed reassurance (R9) and "scale" (R3). Register from canon: *"Marketplace · later, by vote"* — future stated as plain fact. ES: "…El resto del centro de Oregón viene después."

**#4 · `join.step2B` (messages/en.json:224) — cosmetic, rides along**
> **Before:** "…Pay once a year or by bank transfer or take the hardship waiver. It's yours, no questions asked."
> **After:** "…Pay once a year or by bank transfer, or take the hardship waiver. It's yours, no questions asked."
>
> R1 rhythm; punctuation only.

### Group 2 · First-run (auth + home) — **commit 2**

**#5 · `auth.subtitle` (en.ts:60-61)**
> **Before:** "New here? Use the same form — we'll create your account. We email you a secure link, so there's no password to remember or leak."
> **After:** "New here? Use the same form — we'll create your account. We email you a sign-in link that works once, so there's no password to remember or leak."
>
> R7: the concrete fact ("works once") replaces the adjective ("secure"). Canon line it borrows from: *"The link works once and expires soon."*

**#5b · `auth.checkEmailBody` (en.ts:67-68)**
> **Before:** "If that address can join, we sent a secure sign-in link to {email}. Open it on this device to continue. The link expires soon."
> **After:** "If that address can join, we sent a sign-in link to {email}. Open it on this device to continue. The link works once and expires soon."
>
> Same rule; the anti-enumeration lead ("If that address can join") is **kept verbatim** — it's a security property, not style.

**#6 · `home.nextBody` (en.ts:104-105)**
> **Before:** "Verifying that you live in Redmond unlocks neighborhood events and the community vote."
> **After:** "Verify that you live in Redmond to join neighborhood events and the community vote."
>
> Kills the corpus's only stock-vocab hit (R3) and moves to direct imperative (R2). Register from canon: *"Tap any entry to open it and reach that neighbor directly."*

### Group 3 · Member-app vocabulary + groups — **commit 3**

**#7 · `nav.governanceLink` (en.ts:37)**
> **Before:** "Proposals" → **After:** "Govern"
>
> Canon tab vocabulary (*tabGovern*, *governH*). Page titles inside ("Proposals & votes") stay — the nav names the place, the page names the artifacts.

**#8 · `nav.accountLink` (en.ts:40) — founder's pick, default = keep**
> Option A (canon-exact): "Account" → "You" (*tabYou*). Option B: keep "Account" (clearer beside "Your account"). Plan defaults to **keep**; recorded so the drift is chosen, not accidental.

**#9 · `groups.intro` (en.ts:184-185)**
> **Before:** "Community groups — boards, calendars, and more. Browse by category or search by name."
> **After:** "Community groups — boards, calendars, events. Browse by category or search by name."
>
> R3/R9: enumerate or stop; never "and more."

**#10 · `groups.confirmLeave` (en.ts:208) — cosmetic, rides along**
> **Before:** "Leave this group? You'll lose access to members-only content."
> **After:** "Leave this group? You'll lose access to its members-only posts and events."
>
> R3: things, not "content."

### Group 4 · Dead copy + email terminology — **commit 4**

**#11 · `landing.*` block (en.ts:43-56)**
> **Action:** confirm unreferenced (audit found no usage), then **delete the block** from `en.ts` + `es.ts`. If it turns out reachable, instead align its four commitments verbatim to the marketing clause set (`clauseAH/BH/CH/DH` + bodies) — one canonical promise wording, no third variant.

**#13 · invite email (docs/ops/email-templates/generate.mjs:36)**
> **Before:** "…a community-owned civic space for verified Redmond neighbors."
> **After:** "…a community-owned civic commons for verified Redmond neighbors."
>
> Terminology: *commons/civic infrastructure* everywhere, "civic space" nowhere. Regenerate the 5 HTML files in the same commit (`node docs/ops/email-templates/generate.mjs`) + re-paste the invite template into Supabase (ops note, not a code step).

**#12 · promise-wording matrix — no copy change.** The three registers (marketing clauses, partners short forms, app strings) stay; after #11 removes the third app variant, the remaining two are deliberate. Recorded as resolved-by-deletion.

### Deliberately untouched
`neighborhoods.noneConfirmBody`, `contact.heroLead`, `partners.s3B`, `error.*`, `notFound.*`, all of `interestEmail`, and every string not named above — they conform. **COUNSEL-GATED:** `privacy.*`, `/legal/*`, seeded `documents` — zero changes proposed.

---

## Commit sequence (each `git commit -s`, one logical change)

| # | Commit | Contents | Gate |
|---|---|---|---|
| 0 | `fix(preview): correct the vote-weight claim to match the product` | CD-1 Option 1, en+es | **Founder approves CD-1 first** |
| 1 | `fix(copy): launch surfaces — welcome notice, verify enumeration, /join funnel` | #1 (conditional), #2, #3, #4, en+es pairs | #1 ships only with the v1.0 documents seed |
| 2 | `fix(copy): first-run — concrete link facts, drop 'unlocks'` | #5, #5b, #6, en+es | — |
| 3 | `fix(copy): member vocabulary — Govern nav, groups enumeration` | #7, (#8 if chosen), #9, #10, en+es | — |
| 4 | `chore(copy): remove dead landing block; invite says commons` | #11, #13 (+ regenerated email HTML) | confirm #11 unreferenced at build |

Sequencing: 0 first (canon must be right before pages conform to it); 1 next (July 23 surfaces); 2–4 in any order. Every commit builds green (`npm run build`) and keeps `es` structurally identical to `en` (the `Dictionary = typeof en` type makes a missed pair a compile error).
