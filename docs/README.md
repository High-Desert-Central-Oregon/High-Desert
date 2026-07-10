# docs/ — Steppe documentation

Reorganized 2026-07-09 into topical subfolders, with a single source-of-truth model.

## Source-of-truth model

For governance, funding, and strategy documents:

- **Markdown (`.md`) is the tracked source-of-truth** — edit this; it diffs cleanly and is fully transparent.
- **A versioned + dated PDF (`<name>-<version>-YYYY-MM-DD.pdf`) is the tracked human-readable export** — regenerate it when the markdown changes.
- **Word (`.docx`) are editing/signature convenience copies, regenerated from the markdown and *git-ignored*** (binary, non-diffable). Force-push one only if you must: `git add -f <file>`.

Regenerate the exports from markdown with `pandoc`:

```
pandoc doc.md -o doc-vX-YYYY-MM-DD.pdf --pdf-engine=weasyprint -c docs/_assets/doc.css -s
pandoc doc.md -o doc.docx     # optional editable Word copy
```

(Other documentation types — HTML explainers, brand assets, specs, ops runbooks — are tracked as-is.)

## Layout

| Folder | Contents |
|---|---|
| `governance/` | Charter & Bylaws, COI Disclosure Packet + Register, Operating Budget, Schedule of Defaults, and the **firm-vs-living document status** (see `governance/README.md`). Counsel-packet sources. |
| `funding/` | Funding Strategy, Grant Pack, Master Case, Funder Eligibility Reference, funder-pack corrections, sponsors/partners landscape. `superseded/` holds pre-rename `.docx` originals. |
| `strategy/` | Business Plan v12, governable-spaces strategy, GTM organizing plan. |
| `spec/` | Product specs (Groups/Calendar/Exchange; Identity/Privacy/Exchange). Companions to the repo-root `SPEC.md`. |
| `ops/` | Runbooks and audits (dry-run runbook, launch checklist, portability audit, RLS audit, Codeberg cutover). |
| `decisions/` | Decision records (incl. the Trust & Safety / Verification record). |
| `design/`, `brand/` | Design references and brand assets (logos, fonts, guidelines PDF, Word style reference). |
| `archive/` | Retired/superseded documents kept for history. |
| root | `LICENSE.md`, `SETUP.md`, and current HTML explainers (`Steppe-HowItWorks`, `Steppe-Model-and-Sustainability`) + design materials (`pattern-language`, `dev-framework`, `building-spec`, `steppe-artist-program-v5`). |

## Realignment status (2026-07-09)

The remaining `.docx` were converted to markdown and realigned to current, confirmed canon:

- **Rebrand "High Desert" → "Steppe"** applied to Funding Strategy, Grant Pack, and Master Case (their `.docx` titles still said "HIGH DESERT"). Preserved: **"High Desert Connect"** (the program-arm name) and the lowercase *"high desert"* geographic tagline.
- **Fiscal sponsor = Ignite Empowerment Foundation (IEF).** Funder Eligibility Reference corrected from "Aspiration" → IEF. All funder/strategy docs carry a dated internal banner noting IEF is the confirmed sponsor and that **Director Weimer is the spouse of IEF's founder** (a disclosed related-party matter — see `governance/`).
- **Founding board confirmed: Chism, Cobb, Weimer**, with a fourth independent director planned (Business Plan previously said Weimer "invitation pending").

**Still needs a founder pass (flagged, not auto-rewritten — persuasive/tactical prose):**

- **Funding Strategy** and **Grant Pack** contain fiscal-sponsor *acquisition* tactics ("decision this week," a sponsorship-inquiry letter to Connect Central Oregon). These are **historical** now that IEF is secured — refresh or retire before external use.
- **Business Plan v12** describes the sponsor as a generic "national Model C civic-technology sponsor"; name **IEF** and verify its profile on the next revision.
- Bracketed template fields in the Grant Pack (`[DATE]`, variant blocks) are intentional — fill at submission.

## Firm vs. living

Which documents must stay firm (pending counsel) vs. remain living is classified in **`governance/README.md`**. In short: the Charter, COI packet/register, Terms + Privacy, the Decision Record, and the not-yet-in-repo Articles of Incorporation and IEF sponsorship agreement are **firm**; the Budget, Schedule of Defaults, Business Plan, and all funding materials are **living**.

*Prepared 2026-07-09. Working drafts; the firm documents require licensed Oregon counsel review before adoption, signature, or publication.*
