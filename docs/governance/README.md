# docs/governance — Steppe governance & counsel-packet sources

This folder holds the **source documents** behind Steppe's nonprofit governance, conflict-of-interest,
budget, and community-norms work — i.e., the sources the assembled counsel packet
(`/counsel-packet`) is built from. Reorganized here 2026-07-08.

## Source model (correction)

Earlier notes said the governance `.docx` were *gitignored*. That is **wrong** — `.gitignore` only
ignores Word lock files (`~$*.docx`); the real `.docx` are tracked. Going forward:

- **Markdown (`.md`) is the tracked source-of-truth** and what to edit for legible diffs.
- **`.docx` are the editable / signature copies**, regenerated from the markdown (via `pandoc`).
  When you edit a `.md` here, regenerate its `.docx` (`pandoc file.md -o file.docx`) or hand-edit the
  Word copy and keep the two in sync.
- Superseded originals live in `superseded/`.

## Contents

| File | What it is |
|---|---|
| `Steppe-Governance-Charter-v0.2-DRAFT.md` / `.docx` | Governance Charter & Bylaws — updated (§4.2 verification wording aligned to canon; §8.9 honoraria amendment note) |
| `Steppe-COI-Disclosure-Packet-v1.4.md` / `.docx` | Conflict-of-Interest disclosures + signable forms — updated (Three Canyon↔Redmond Compass relationship confirmed; Weimer + IEF disclosure added) |
| `steppe-coi-register-v2.md` | Conflict-of-Interest Register — Entry 002 (Weimer↔IEF) added |
| `steppe-operating-budget-v1.md` | Operating Budget (v1.1) — sponsor confirmed IEF; honoraria resolution |
| `Steppe-Schedule-of-Defaults-v0.1.md` | Member-governed community norms (new) |
| `superseded/` | Prior `.docx` originals (Charter v0.1, COI v1.2) |

The **Trust & Safety / Verification Decision Record** stays at `docs/decisions/` (its established home).
The **Terms/Privacy** surfaces live in the app (`steppe/…`) and `seed/`.

---

# Document status — firm vs. living

Greg asked for an explicit call on which documents must **stay firm (pending counsel + named required
updates)** and which are **living**. "Firm" = becomes authoritative/binding, must not silently drift,
and needs counsel sign-off before adoption / signature / publication. "Living" = planning, strategy, or
fundraising material that is expected to be revised and re-versioned over time.

## FIRM — pending counsel; do not let these drift

| Document | Why firm | Named required updates before it's final |
|---|---|---|
| **Governance Charter & Bylaws** (v0.2) | The constitution; adopted under Article XII | Map async e-voting to ORS 65 (§5.3/§5.4 quorum/written-ballot); anchor tenure-weighting **and** the Founder Concurrence right in the Articles; ratify + insert the **§8.9 honoraria** amendment; fill brackets (Founder-Protection term 5–7 yr, board size/terms, review cadence); reconcile canon basis **v11→v12**; acknowledge the **IEF** fiscal sponsorship |
| **COI Disclosure Packet** (v1.4) | Signable forms + policy language; §4958 exposure | Fill brackets (Cobb's separate-business legal name; Three Canyon engagement start date); **supply the standalone COI Policy** (referenced but missing); **seat a 4th independent director**; obtain signatures; counsel to confirm the §4958 approving-body / recusal map |
| **COI Register** (v2) | Canonical related-party record (its *entries* are living, its standing recusals are firm) | Board to formally receive Entries **001 & 002**; confirm Articles-vs-policy home for person-specific recusals; add engagement start date |
| **Terms of Membership + Privacy** (formal `/legal/terms`, consent-gate v0.1, and the formal Privacy Policy) | Published legal terms; enforceable | Reconcile the **two Terms** (age, governing law/venue, liability); fill entity/service-area/age; stand up the **TAKE IT DOWN** NCII process (live now); verify the end-to-end **verification-evidence purge** before the "can't produce it" claim; update the Privacy Policy sponsor **Aspiration→IEF**, add **Resend + Supabase**, name the payment processor; Spanish governing version |
| **Trust & Safety / Verification Decision Record** (`docs/decisions/…`) | Adopted canon (superseded, never edited in place) | None; keep the five verification surfaces in lockstep |
| **Articles of Incorporation** *(not yet in repo)* | Foundational | Draft/obtain; must carry the entrenched commitments, asset-lock, dissolution-to-501(c)(3), tenure-weighting authorization, and the Founder Concurrence right |
| **IEF Fiscal Sponsorship Agreement** *(not yet in repo)* | Defines who holds funds / contracts / controls data during sponsorship | **Execute**; approved by the disinterested directors with **Weimer recused** (related party) |

## LIVING — revise and re-version freely

| Document | Status | Suggested updates (not blocking) |
|---|---|---|
| **Operating Budget** (v1.1) | Living; PROPOSED planning numbers | Ratify the honoraria resolution; replace estimates with actuals as invoices land |
| **Schedule of Defaults** (v0.1) | Living; member-governed, amendable by vote | Ratify the initial `[cohort to confirm]` defaults; settle the Exchange-goods/jobs vs. "no commercial solicitation" line |
| **Business Plan v12** | Living canon-strategy | Name the confirmed sponsor **(IEF)** in place of "national Model C sponsor" and verify IEF's profile; mark Weimer's board seat **confirmed** (was "invitation pending") |
| **Funder Eligibility Reference v3** | Living | **Updated this pass:** sponsor **Aspiration → Ignite Empowerment Foundation**. Remaining: confirm the "Model C" framing fits IEF |
| **Funding Strategy v3** *(titled "High Desert")* | Living fundraising | **Rebrand High Desert → Steppe**; name the sponsor **IEF** (currently generic "local/national fiscal sponsor") |
| **Grant Pack v3** *(titled "High Desert")* | Living fundraising | **Rebrand**; name sponsor **IEF**; the fiscal-sponsorship *inquiry* (Document F) is largely **moot now that IEF is secured** — retire or repurpose it |
| **Master Case v1.2** *(titled "High Desert")* | Living fundraising | **Rebrand**; attribute the 8% fiscal-sponsorship admin line to **IEF** |
| GTM organizing plan, governable-spaces strategy, sponsors landscape, spec docs (`Steppe-Spec-v3…`, `…Groups-Calendar-Exchange…`), brand assets | Living | Not counsel-gated; keep naming consistent (Steppe; "High Desert Connect" is the *intended program-arm name*, **not** a rename leftover — leave it) |

## Two cross-cutting consistency items (named)

1. **Fiscal sponsor = Ignite Empowerment Foundation (IEF).** Confirmed. Previously appeared as
   "Aspiration" (fixed this pass in Funder Eligibility v3) and as a generic "national Model C sponsor"
   (Business Plan, Funding Strategy, Grant Pack, Master Case — flagged above). Note the related-party
   angle: **Director Weimer is the spouse of IEF's founder**, so all Steppe–IEF terms are interested-party.
2. **"High Desert" → "Steppe" rename** is incomplete in the three funding `.docx` (Funding Strategy,
   Grant Pack, Master Case), which still carry "HIGH DESERT" titles. Preserve **"High Desert Connect"**
   (the deliberate program-arm name) when rebranding.

*Prepared 2026-07-08. Not legal advice; the FIRM documents require review by licensed Oregon counsel before adoption, signature, or publication.*
