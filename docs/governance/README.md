# docs/governance — Steppe governance & counsel-packet sources

This folder holds the **source documents** behind Steppe's nonprofit governance, conflict-of-interest,
budget, and community-norms work — i.e., the sources the assembled counsel packet
(`/counsel-packet`) is built from. Reorganized here 2026-07-08.

## Source model — CORRECTED 2026-07-31

> ### ⚠ The instruction previously in this section was wrong, and is kept here struck through
> ### rather than deleted, because someone may have followed it.
>
> It read: *"**Markdown (`.md`) is the tracked source-of-truth** and what to edit for legible
> diffs. **`.docx` are the editable / signature copies** … Superseded originals live in
> `superseded/`."* It also corrected an *earlier* note by asserting that the `.docx` were tracked
> and only Word lock files were ignored.
>
> **What was wrong with it:** it reasoned only about *diffability* — which format is nicer to
> review — and never asked the prior question of **whether this material belongs in a public
> repository at all.** Read as written, it instructs a contributor to keep governance,
> conflict-of-interest and budget material tracked, in Markdown, forever. That is the opposite
> of the convention now recorded in `CLAUDE.md` → *Do NOT publish*.

**This repository is public on two forges — Codeberg canonical and the GitHub mirror.** The
governing rule for this folder is now `CLAUDE.md` → **Do NOT publish**, which excludes from the
repo entirely:

- **third-party personal data — *unless the person has agreed to that association*.** This is a
  consent rule, not a categorical ban. See the note below on the COI register, which stays.
- dollar figures, compensation, and operating budgets,
- pre-counsel drafts of legal instruments,
- non-public funder or partner posture.

Material in those categories belongs in **`~/dev/steppe-private/`**, in whatever format is
convenient — the `.md` / `.docx` / `.pdf` question is a formatting preference and was never the
important one.

### The COI register stays here, deliberately

`steppe-coi-register-v2.md` and its dated PDF are **tracked, published, and meant to be.** The
register records facts about people who have **consented to public association with Steppe** in
the ways it describes. It is not third-party data published without consent, and a
conflict-of-interest register that nobody can read discloses nothing — publishing it is the
transparency posture working.

An earlier pass of this cleanup briefly removed it, on a reading of the rule that was
categorical rather than consent-based. **The categorical phrasing was the defect, not the file.**
The rule now turns on consent and on proportionality — no granularity beyond what the disclosure
requires — and the register satisfies both.

Note the distinction that pass blurred: a **draft governing instrument** stays out because a
reader cannot tell it from the ratified thing. A **disclosure log** is not a draft, and does not
carry that problem.

**What that does not do.** `.gitignore` does not untrack anything already tracked, and removing
a file from HEAD does not unpublish it — the content remains in history on both public forges.
Files already published here are a **per-document decision**, not a cleanup, and were handled
individually — some moved to `steppe-private/`, the COI register reviewed and **retained**. The
Contents table below lists what this folder has held; where an entry is no longer tracked, the
table is a record of what was published rather than a claim about what is here now.

**Still appropriate for this folder**, and unaffected: community-facing norms and process drafts
that are meant to be read by members — ballot drafts, the moderation policy draft — where
publication is the point.

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
