# Steppe — Repo Health Check v1 (Phase A, read-only triage)

**Date:** 2026-07-14 · **Branch at audit:** `feat/landing-what-its-for` · **Scope:** the six
areas requested (branch/merge, migration integrity, dead code, test coverage, consistency,
security). **Method:** one git/analysis pass by the lead + five parallel read-only
investigators, each finding cross-checked against source before inclusion.

**No files were changed.** This document is the only output. Findings are ranked by severity;
each carries evidence (`path:line` / commit / command) and a **fix-shape**
(schema-vs-code, safe-vs-gated). Four investigator claims were found wrong on verification and
are corrected inline (see *Corrections* at the end) — they are **not** propagated as findings.

Bottom line: **security and data-purge posture are strong; no data-loss or RLS-bypass risk was
found.** The real debt is in **process/deploy governance** (unreviewed direct-to-main +
mirror-driven deploy) and **release hygiene** (migration apply-ledger, a duplicate commit, repo
pollution). Nothing here blocks the July 23 launch by itself, but H1–H3 should be decided before
the next production push.

---

## Severity ledger

| # | Finding | Area | Severity | Fix-shape |
|---|---------|------|----------|-----------|
| H1 | No review gate on `main`; unreviewed commits auto-deploy | 1 | High | Process (gated) |
| H2 | Migration apply-ledger missing; 0019 buried in a UI commit | 2 | High | Doc + verify (gated) |
| H3 | Deploy runs off a GitHub **mirror**; sync unverifiable from canonical | 1 | High | Ops/verify (gated) |
| M1 | Duplicate-subject landing commit on the feature branch | 1 | Medium | History (safe) |
| M2 | Governance thresholds hardcoded as display literals, no config of record | 5 | Medium | Code+config (safe) |
| M3 | Two parallel i18n dictionary systems can drift | 3 | Medium | Refactor (gated) |
| M4 | Stray / duplicate brand assets (root, public/brand, docs/brand) | 3 | Medium | Delete (mostly safe) |
| M5 | DCO defect on `main` HEAD + 139-commit merge debt on preview branch | 1 | Medium | Process (partly gated) |
| L1 | 0019 post-author appeal branch has no dedicated refusal-matrix row | 2/4 | Low | Test (safe) |
| L2 | Hardcoded color hex off the token law (marketing layer) | 5 | Low | Refactor (safe) |
| L3 | `select("*")` in account-export; `admin.ts` docstring lists 3 of 5 uses | 6 | Low | Cleanup (safe) |
| L4 | `MIN_TURNOUT = 5` hardcoded in schema (marked provisional) | 5 | Low | Doc (safe) |

Plus a **Verified-good** register (things confirmed correct, so they are not re-litigated).

---

## Area 1 — Branch / merge state

**Mergeability (clean).** `feat/landing-what-its-for` is **7 ahead / 0 behind** `main`, with `main`
(`b474598`) as the merge-base → a **clean fast-forward, zero conflicts** (`git merge-tree` produced
no conflict hunks). It merges cleanly today.

### H1 — `main` has no review gate; commits ship straight to production
Every recent `main` commit is **single-parent** (no merge commits, no PR trail):
`b474598 5ce78fb b529418 d3ecd37 ef6d507 ab03bb8 …` all have exactly one parent. Combined with H3,
this means **unreviewed, directly-pushed commits auto-deploy**. CLAUDE.md reserves deliberation for
consequential actions; the deploy path has none.
**Fix-shape:** process/branch-protection on `main` (require a reviewed merge). Gated — org decision.

### H3 — Deploy source is a GitHub mirror; canonical≠mirror is unverifiable here
Canonical remote is **Codeberg** (`git@codeberg.org:steppe-community/steppe.git`, the only remote).
Production builds come from **Vercel watching a GitHub mirror** — confirmed by
[.woodpecker/ci.yml](.woodpecker/ci.yml): *"Vercel keeps building off its GitHub Git integration
(the mirror)"*, with the Woodpecker→Vercel deploy step intentionally **disabled**. So "does canonical
== what the mirror will deploy?" cannot be answered from this clone: the Codeberg→GitHub push-mirror
is a **server-side** setting, not a local remote, and **no CI step checks mirror freshness**. If the
mirror lags or is paused, Vercel deploys stale `main`.
**Fix-shape:** ops — verify the push-mirror is live, or move the deploy trigger into Codeberg CI
(the commented `VERCEL_DEPLOY_HOOK` step). Gated.

### M1 — Duplicate-subject landing commit on the branch
The 7 branch commits include **two commits with the identical subject** *"landing: add 'What it's
for' resident-utility section (EN/ES)"*: `7f79306` (the section) and `d90651e` (the nav follow-up).
They differ only in `messages/{en,es}.json`. Merges fine, but a reviewer can't tell them apart.
**Fix-shape:** squash the two before merge (`git rebase` with a fixup; interactive rebase is
unavailable in this harness, so do it by hand or with `--autosquash`). Safe.

### M5 — DCO defect on `main` HEAD + long-lived merge debt
- **`b474598`** (current `main` HEAD, the retheme commit, and the merge-base) has its sign-off
  **mashed into the subject line** ("…handdrawn designs Signed-off-by: Greg Chism …") rather than a
  trailer — it has **no valid `Signed-off-by` trailer** (`git commit -s` was not used). Violates the
  CLAUDE.md DCO rule. Rewriting published `main` history is itself risky, so treat as *note going
  forward* rather than *rewrite*. Partly gated.
- **Merge debt:** `feat/preview-embed-app` is **139 commits ahead** of `main` (large drift/rebase
  risk); `c1-terms-calendar-links` 13 ahead; `m1-terms-messaging` 6 behind / 1 ahead (stale). None
  orphaned (all have `origin` refs), but the preview branch's divergence should be triaged.

*Working tree note:* at audit time the tree is dirty with this session's uncommitted footer/contact
WIP (`site-footer.tsx`, `contact/*`, `site-base.css`) — not a repo defect, but the branch tip ≠ the
working tree.

---

## Area 2 — Migration integrity (0017–0022)

**delete_my_account() coverage — CLEAN.** Every table added since 0017 that holds a **secret or user
capability** is purged (verbatim from the 0022 body):
- `calendar_feeds` (holds the **256-bit bearer token** — a real secret) → `delete … where member_id`
  (added 0020, [migrations/0020_calendar_feeds.sql](migrations/0020_calendar_feeds.sql)). **Covered.**
- `reports` (private intake, ≤2000 chars + `quoted_excerpt`) → `delete … where reporter_id` (0021).
  **Covered.**
- `thread_state` (read cursor / mute / leave) → `delete … where member_id` (0022). **Covered.**
- `member_blocks` (both directions) → `delete … where blocker_id = v_uid or blocked_id = v_uid`
  (0022). **Covered.**
- `posts` and `messages` **bodies are intentionally kept** (co-owned content; sender tombstones to
  "Former member") — ratified in DECISIONS.md **M-G2 (2026-07-13)**. Not a gap.
- `consents` **kept** (append-only permanent record). A pre-existing bug — `delete from consents`
  left over from 0009 and **refused by the 0012 append-only trigger for every role, breaking account
  deletion for everyone past the terms gate** — was **repaired in 0020** and regression-tested
  (`matrix-0020.sql` case 15b). Confirmed fixed.

### H2 — No apply-ledger; 0019 was shipped inside a UI commit
There is **no record of which migrations are confirmed-applied to prod** (DECISIONS.md/DEPLOYMENT.md
describe the by-hand stop-gate convention but name no applied dates). Most migrations carry a
"manual apply" commit marker (`a4d4809` 0018, `d241ff0` 0020, `96c2ee9` 0021, `22370c2` 0022), but:
- **0017** (`69bf781`) has **no "manual apply" marker**.
- **0019** (post appeals) was introduced **silently inside the UI commit `35f486c`** ("feat(exchange):
  the X1 board"), not sequenced as its own migration. 0019 teaches `file_appeal()` to accept
  `target_type='post'`; **if it is not applied in prod, post authors cannot appeal a removed post
  (a P7 breach).**
**Fix-shape:** (1) confirm 0017 & 0019 are live in prod (check for `events.category_id` and test
`file_appeal('post', …)`); (2) add a `MIGRATIONS.md` ledger (migration · commit · date · applied? ·
method). Doc + verify; gated on prod access.

*Append-only & RLS integrity:* 0017–0022 do **not** alter `moderation_actions`, `consents`, or
`audit_log`; the messages RLS enforces the **zero-read pin in policy, not documentation** (no
`is_moderator()` term anywhere in 0022); messages are immutable by privilege determinism (no
UPDATE/DELETE grant or policy). Verified good.

---

## Area 3 — Dead code / dangling

### M3 — Two parallel i18n dictionary systems (drift risk)
The app runs **two** dictionaries: `messages/{en,es}.json` (next-intl) consumed by the `(site)`
marketing pages, and `lib/i18n/dictionaries/{en,es}.ts` consumed by the `protected` member app
(`app/protected/nav-destinations.ts` reads `dict.nav.exchangeLink` etc.). Their nav keys already
diverge (`messages` uses `exchange`/`uses`; the TS dict uses `exchangeLink`/`groupsLink`/…). Both
compile and work today — this is a **maintainability/drift** finding, not a runtime break.
**Fix-shape:** decide one source of truth or add a sync check. Gated (architectural).

### M4 — Stray / duplicate brand assets from the retheme
- **Repo root (misplaced):** `/steppe-strata-drawn-512.png`, `/steppe-strata-seal-drawn-mono.svg`,
  `/steppe-strata-seal-drawn.svg` — duplicates of `steppe/public/brand/` files, not referenced.
  **Safe-delete.**
- **Orphaned in `steppe/public/brand/`:** `steppe-strata-seal-mono.svg`, `steppe-strata-seal-512.png`
  — no `.tsx/.ts/.css` reference post-retheme. (Note `steppe-strata-seal.svg` **is** still live in
  `join-form.tsx:119` and the governance vote pages, so keep it.) **Safe-delete** the two orphans.
- **`docs/brand/`:** ~6 old-theme seal duplicates. **Needs-confirmation** — clarify whether
  `docs/brand/` is a frozen archive (intentional) or should mirror `public/brand/`.

*Components & routes:* no dead components or unreachable routes found. Template-literal i18n keys
(`t(\`bsArt${n}…\`)`, `t(\`bsUse${n}…\`)`, `t(\`step${n}…\`)`) all resolve — **no orphaned keys**
confirmed. `nav.exchange` in `messages/*.json` is unused but **intentionally retained** for a future
Exchange anchor (per the prior task) — leave it.

---

## Area 4 — Test coverage

**Auditable-core coverage — CLEAN.** Every core path has a refusal-matrix row:
- **RLS** — posts/events (`matrix-0018`), feeds (`matrix-0020`), reports (`matrix-0021`),
  messages/blocks (`matrix-0022`).
- **pin** — `matrix-0018` cases 14–17 (authority gates, board constraint, audit, hostage-rule unpin).
- **blocks** — `matrix-0022` case 9 (symmetric freeze, blocker-own read, blocked-sees-nothing,
  reversal, no oracle).
- **feeds** — `matrix-0020` (token isolation, mint/rotate gating, payload service-role-only, feed
  death on status change).
- **reports** — `matrix-0021` (reporter-own vs moderator-all read, immutability, resolve, purge).

0017 (nullable FK, no RLS/trigger) and 0019 (RPC branch, no DDL) legitimately have no matrix.

### L1 — 0019's new appeal branch has no dedicated refusal assertion
0019 adds an authorization branch (post **author** may appeal; non-author refused). It has no
matrix row of its own; the appeal *mechanics* are covered indirectly by `matrix-0018`. Judgment
call — defensible as-is, but a one-line assertion (in `matrix-0018` or a small `matrix-0019`) would
close it. **Fix-shape:** test; safe.

### The 7 todos (reconciled)
Three **code TODOs** — all pre-launch gates:
1. [i18n/request.ts:7](steppe/i18n/request.ts#L7) — localized path routing (`/es/…`) for SEO.
2. [legal/privacy/page.tsx:26](steppe/app/(site)/legal/privacy/page.tsx#L26) — remove `noindex` when
   the privacy policy is counsel-signed + placeholders filled.
3. [legal/terms/page.tsx:26](steppe/app/(site)/legal/terms/page.tsx#L26) — same for Terms.

Four **deferred governance decisions** (DECISIONS.md 2026-07-04, awaiting cohort ratification — not
code tasks): P1 moderator selection/recall, P2 tenure-weight ratification, P3 voluntary restorative
path, P4 hardship-waiver self-attestation. **3 + 4 = 7.**

---

## Area 5 — Consistency

### M2 — Governance thresholds hardcoded, no config of record
[partners/page.tsx:107-110](steppe/app/(site)/partners/page.tsx#L107-L110) prints **`15% / 60% /
75% / 60%`** as literal JSX. CLAUDE.md requires governance numbers be *"config, not hardcoded."*
`lib/governance.ts` exists but holds only proposal-**state** logic (open/closed by clock) — **not the
thresholds.** The tenure multipliers and `MIN_TURNOUT` live in `schema.sql` (enforcement layer),
but **quorum/majority thresholds are enforced nowhere in code yet** — they exist *only* as marketing
display literals, so display and (future) tallying can silently diverge.
**Fix-shape:** extract a `lib/governance-config.ts` of record; have the partners page read from it.
Code+config; safe.

### L2 — Hardcoded colors off the token law (marketing layer only)
`#c26b3e` in [site-base.css:516,522](steppe/app/(site)/site-base.css#L516); `#fbf7ee` / `0xede6d5`
in [weather-layer.tsx:119,123,262](steppe/app/(site)/weather-layer.tsx#L119); six `#fbf7ee` in
`preview/preview.css`. The `protected` app has **no** hardcoded color hex (token-clean).
**Fix-shape:** replace with `var(--…)` / a THREE.js color constant. Safe.

### L4 — `MIN_TURNOUT = 5` hardcoded in schema
[schema.sql:970](schema.sql#L970) hardcodes the 5-ballot reveal floor, self-labeled provisional.
Immutable-via-migration is defensible for the prototype's enforcement layer; just **document intent**
(and list it alongside the M2 config work). Safe.

**Vocabulary — verified good / corrected:**
- **steward → moderator: already normalized.** Schema uses only the `moderator` role /
  `moderation_actions`; the X1 bundle's "stewards" copy is normalized in
  [dictionaries/en.ts:131-133](steppe/lib/i18n/dictionaries/en.ts#L131). No live "steward" in UI.
- **"Gobernar" vs "Gobernanza" is NOT drift** *(corrects the investigator).* EN deliberately uses
  **"Govern"** (verb section heading `governH`, paired with "One open vote right now") vs
  **"Governance"** (nav noun `governanceLink`); ES mirrors this exactly — "Gobernar" (verb) vs
  "Gobernanza" (noun). Correct, not a defect.
- **"G4 thresholds" / "bundle steward copy"** re-export defects: both are references/already-fixed —
  G4 is a governance invariant cited in comments/tests (appealable-not-deletable, enforced), and the
  bundle steward copy is the normalization above. No open defect.

---

## Area 6 — Security posture

**Strong, RLS-first, no critical findings.**
- **Admin/service-role client: 5 sites, all inside the enumerated contract** —
  `api/interest/route.ts` (deny-by-default table), `api/qr/route.ts` (counter RPC),
  `cal/[token]/route.ts` (feed-payload RPC, re-derives owner standing),
  `protected/review/actions.ts` (evidence storage delete after a moderator decision — "verify then
  forget"), `protected/account/actions.ts` (scrub trust fields + anonymize auth on deletion, after
  the RPC erased app data). None **read** another member's data; the admin client is write/RPC-only.
  *Cleanup:* [lib/supabase/admin.ts](steppe/lib/supabase/admin.ts) docstring enumerates **3** uses
  but there are now **5** — update it (L3).
- **Trust writes guarded** — `verified/role/tenure_start` set only via `decide_verification()`
  (SECURITY DEFINER, `is_moderator()`) or the deletion scrub; no client path.
- **Votes stay secret** — no read policy; `proposal_results` view only; export reads own ballot via
  RLS. **Reports** expose `reporter_id` to moderators only (intended); export omits it. **Feed
  tokens** withheld from the member export by explicit column list.

### L3 — `select("*")` in the account-export route (acceptable)
[account/export/route.ts:41-56](steppe/app/protected/account/export/route.ts#L41) uses `select("*")`
across the member's **own** rows (`id/user_id/creator_id = uid`), RLS-gated — not a bypass. Narrow to
explicit columns for future-proofing if desired. **The 0017-era `select("*")` interim is RETIRED:**
[exchange/page.tsx:272](steppe/app/protected/exchange/page.tsx#L272) now selects named columns with
the comment *"Explicit columns (0018 is applied; the 0017 select(\"\*\") interim retires)."*

---

## Verified-good register (do not re-litigate)

- `feat/landing-what-its-for` → `main` is a **clean fast-forward** (0 conflicts).
- `delete_my_account()` covers **every** secret/capability table added since 0017; the 0012
  consents-delete regression is **repaired** (0020) and regression-tested.
- **Zero-read pin** on messages is enforced in **RLS**, not documentation; messages immutable by
  privilege determinism; append-only tables untouched by 0017–0022.
- Security: 5 admin-client sites all within contract; **no RLS bypass**; votes secret; 0017
  `select("*")` interim retired.
- All auditable-core paths (RLS, pin, blocks, feeds, reports) have refusal-matrix coverage.
- steward→moderator normalization complete; Gobernar/Gobernanza intentional.

## Corrections applied to investigator output (not propagated as findings)

1. **"412 orphaned dict keys"** — impossible; `en.json` has **406 leaf keys total**. Discarded; no
   confidently-dead keys found beyond the intentionally-retained `nav.exchange`.
2. **"broken `nav.exchangeLink`"** — false positive; the key exists in
   `lib/i18n/dictionaries/{en,es}.ts` and the protected nav works. Reframed as the two-dictionary
   drift risk (M3).
3. **"Gobernar vs Gobernanza" drift** — false positive; intentional verb/noun split mirroring
   EN "Govern"/"Governance".
4. **"no governance config module exists"** — `lib/governance.ts` exists (state logic only); the
   substantive point (thresholds not centralized) is kept as M2.

---

## Suggested sequencing (for Phase B — your call, not executed)

1. **Decide the deploy/review posture (H1+H3)** before the next prod push — mirror-freshness check
   and/or a review gate on `main`.
2. **Migration ledger + confirm 0017/0019 applied (H2)** — the 0019/appeal risk is the sharpest.
3. **Release hygiene (M1, M4)** — squash the duplicate landing commit; delete the root/public strays
   (confirm `docs/brand/`).
4. **Governance config (M2, L4)** — extract thresholds of record; wire the partners page.
5. **Lower-risk cleanup (L1–L3, M5 note)** — 0019 matrix row, token-ize marketing colors, narrow the
   export `select`, fix `admin.ts` docstring, and note the DCO/merge-debt items.
