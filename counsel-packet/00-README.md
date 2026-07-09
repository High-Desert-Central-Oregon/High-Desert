# Counsel Packet — Steppe (Trust & Safety · Verification Retention · Governance · COI · Budget)

Prepared 2026-07-08; governance & COI documents added the same day. A consolidated bundle for
Oregon nonprofit / platform-liability counsel. **Every document here is DRAFT pending counsel
review — none is a legal instrument, and none has force until adopted.**

## 1. Alignment status: **EXECUTED** (2026-06-27)

The privacy/terms alignment to the verify-then-forget posture was carried out in two
commits, both dated **2026-06-27**:

- **`d6db153`** — `docs(privacy): align /privacy copy with verification-retention posture`
  (edited `steppe/messages/en.json` + `es.json`, "privacy" namespace)
- **`8f13a3f`** — `docs(terms): add /legal/terms aligned with the trust & safety posture`
  (added `steppe/content/legal/terms.md` + the `/legal/terms` page)

Both surfaces state the posture correctly:

| Requirement (decision record §1, §7) | /privacy | /legal/terms |
|---|---|---|
| Evidence deleted immediately | ✓ "we delete what you sent" / "then delete the proof" | ✓ "the proof is deleted the moment that check is made" / "deleted immediately after the residency check" |
| Retain flag / date / method only | ✓ "keep only that you're verified, the date, and the method" | ✓ "we retain only the verified status, the date, and the method" |
| "Can't disclose" scoped to verification, not all data | ✓ "Because we don't keep the proof, we can't produce or disclose it" | ✓ same, **and explicit** that "account details and content within their retention window do exist and may be subject to lawful disclosure" |

## 2. Documents in this packet

**Trust & safety / verification retention:**

| # | Document | Source path | Last commit (content) |
|---|---|---|---|
| 01 | **/privacy** page | `steppe/app/(site)/privacy/page.tsx` + `steppe/messages/en.json` ("privacy" namespace) | copy aligned **`d6db153`** (2026-06-27); component `aae429a` (2026-06-22) |
| 02 | **/legal/terms** page | `steppe/content/legal/terms.md` | **`8f13a3f`** (2026-06-27) |
| 03 | **Decision record** (canon) | `docs/decisions/steppe-ts-verification-decision-record.md` | **`bfb4fb4`** (2026-07-04) |
| 04 | **Consent / membership agreement** ("Terms of Membership" + Privacy, `documents` table v0.1, rendered at `/welcome`) | `seed/documents-terms-privacy-v0.1.sql` | **`38ccbc9`** (2026-07-08) |

**Governance & entity (nonprofit / 501(c)(3)):**

| # | Document | Source path | Status |
|---|---|---|---|
| 05 | **Governance Charter & Bylaws** (ORS 65 / intended 501(c)(3); Business Plan v12 basis) | `docs/governance/Steppe-Governance-Charter-v0.2-DRAFT.md` (+ `.docx`) | Working Draft v0.2 — **NOT YET ADOPTED** |
| 06 | **Conflict-of-Interest Disclosure Packet** (board + founder disclosures & signable forms) | `docs/governance/Steppe-COI-Disclosure-Packet-v1.4.md` (+ `.docx`) | **v1.4** (2026-07-08: Chism–Cobb relationship confirmed via Three Canyon; Weimer + IEF spousal disclosure added) — working draft for counsel |
| 07 | **COI Register** | `docs/governance/steppe-coi-register-v2.md` | **v2** (2026-07-08) |

> **Source model (corrected 2026-07-08):** the governance sources now live in **`docs/governance/`**.
> The real `.docx` are **tracked** (`.gitignore` only ignores Word lock files `~$*.docx`) — the earlier
> "gitignored" note was wrong. Markdown (`.md`) is the tracked source-of-truth; the `.docx` are the
> editable/signature copies, regenerated from the markdown via `pandoc`. Superseded originals are in
> `docs/governance/superseded/`. See `docs/governance/README.md` for the folder index and the
> **firm-vs-living document status** classification.
>
> **This review pass (2026-07-08)** updated: 05 (§4.2 verification; §8.9 honoraria note) → **v0.2**;
> 06 (Three Canyon confirmed; Weimer + IEF disclosure) → **v1.4**; 07 (Entry 002) → **v2**; 08 (sponsor
> confirmed IEF + honoraria resolution). The charter/COI `.docx` were regenerated from the updated
> markdown; 09 (Schedule of Defaults) and 10 (review annex) were added.

**Financial:**

| # | Document | Source path | Last commit |
|---|---|---|---|
| 08 | **Operating Budget** (staged; **PROPOSED** planning numbers, not commitments) — fiscal sponsor **Ignite Empowerment Foundation**, sponsorship agreement pending signature; companion to Business Plan v12 | `docs/governance/steppe-operating-budget-v1.md` | **`0daa1f1`** (2026-07-04); v1.1 this pass |

**Governance norms & review (added 2026-07-08):**

| # | Document | Source path | Status |
|---|---|---|---|
| 09 | **Schedule of Defaults** (member-governed community norms; fills the gap cited in 03 §3 and 02 §2) | `docs/governance/Steppe-Schedule-of-Defaults-v0.1.md` (new) | Working Draft v0.1 — **NOT YET RATIFIED** |
| 10 | **Annex A — Pre-counsel review notes** (this pass; findings, punch list, and what's missing for counsel) | `counsel-packet/10-pre-counsel-review-notes.md` | Internal review, 2026-07-08 |

## 3. Contradictions / discrepancies vs the decision record

**One material contradiction (governance/COI), addressed in this pass — see Annex A (10).**

- **[06 ↔ 07 — COI financial relationship. RESOLVED 2026-07-08.]** The COI Disclosure Packet (06)
  had stated there was *no* financial relationship between Greg Chism and Holli Cobb and relied on
  that to let each approve the other's interested-person transactions; the COI Register (07, Entry
  001) disclosed the opposite. **Confirmed:** the relationship is real and held by **Three Canyon
  Consulting LLC** (paid engagement with Redmond Compass, Director Cobb's company). 06 was revised
  to **v1.4** and 07 to **v2** — neither director is disinterested as to the other, and a
  disinterested body independent of **both** is required.
- **[Fiscal sponsor + board independence. New 2026-07-08.]** The sponsor is confirmed as **Ignite
  Empowerment Foundation (IEF)** (resolving the earlier IEF-vs-Aspiration discrepancy in favor of
  IEF; the separate privacy-policy draft still says Aspiration and must be updated). **Director
  Brandon Weimer is the spouse of IEF's founder** — a new related-party conflict (07, Entry 002)
  that also means Weimer is not the clean independent director previously assumed. With all three
  directors entangled, **Steppe plans to seat a fourth, fully independent director.** **[COUNSEL:
  §4958 approving-body / recusal map; P0.]**

On the verification-retention posture there remain **no hard contradictions**. Two prior notes:

1. **[RESOLVED 2026-07-08]** The consent-gate **Terms of Membership** (documents v0.1)
   previously enumerated the retained set as *"the fact that you are verified and which method
   you used"* — omitting the date. Both spots (Terms §3 and Privacy §3) were updated to
   *"verified, the date, and … method"* to match the decision record §1 and the aligned pages.
   `CLAUDE.md` invariant 1 was likewise updated (it had said "profiles.verified + the method").
   The `documents` table body in this packet (04) reflects the corrected text.

2. **[CONTEXT]** The consent-gate documents (v0.1, 2026-06-14) **predate** the June 27
   alignment and were **not** part of the alignment commits — but they already carried
   verify-then-forget language from the start ("We verify, then forget… documents are deleted
   as soon as we've checked them"), so they are **substantively aligned**. They remain DRAFT
   v0.1 pending legal review; when counsel returns edits, this consent copy must be updated
   **alongside** the `/legal/*.md` and `/privacy` surfaces so the three don't drift.

**Filename note:** the request referenced `docs/decisions/trust-safety-verification-retention.md`;
the record was filed as `steppe-ts-verification-decision-record.md` (the record itself states the
originally-suggested name "was not used").

## 4. Reviewer annotations (in 02)

`/legal/terms` carries `[CONFIRM …]` blockquotes (claims for counsel to verify) and `[BRACKET]`
placeholders (specifics to fill: effective date, service area, legal entity). The live page
strips `[CONFIRM …]` and stays **noindex** until every placeholder is filled and counsel signs off.

## 5. Governance & COI — status for counsel

- **Charter & Bylaws (05)** is a **working draft, not yet adopted** (adoption is under its own
  Article XII). It carries bracketed items and a Schedule A punch list of decisions still to be
  confirmed. It is written for revision by the founder and review by qualified Oregon nonprofit
  counsel — explicitly *not* a legal instrument or legal advice.
- **COI Disclosure Packet (06)** records the conflict-of-interest disclosures of the three
  individuals in Steppe's founding governance; Parts 2–4 are signable forms with bracketed items
  to complete before signature. To be finalized by counsel before adoption or signature.

---
*All documents are DRAFT pending Oregon nonprofit / platform-liability counsel review — not legal
instruments, no force until adopted. This packet is committed to the repo; the `.docx` originals
behind 05 and 06 are gitignored and are not.*
