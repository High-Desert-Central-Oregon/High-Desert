# Steppe brand PDF toolkit

Turns any Markdown (or `.docx`) into a brand-styled PDF: **Besley** headings in
sage-deep green, **Schibsted Grotesk** body, **Martian Mono** labels, cream paper.

## Use (run from the repo root)

```bash
docs/brand/pdf/build.sh <input.md|.docx> <output.pdf>
```

Requires `pandoc` + `tectonic` (tectonic auto-fetches the LaTeX packages on first run).
Fonts come from `docs/brand/fonts/`; the palette matches `steppe/app/(site)/tokens.css`.

- `steppe-brand.tex` — the pandoc header (brand colors + fonts).
- `sample-decision-record.pdf` — an example render of the T&S decision record.

## PDF vs Word — which format for which document

- **Living documents** (edited / ratified over time — Governance Charter, Business Plan,
  COI Disclosure Packet, Funder Eligibility Reference, Operating Budget, Schedule of
  Defaults) stay editable in **Word / Markdown**, brand-themed there.
- **Finalized / distribution documents** (funder-facing pitch — Funding Strategy, Grant
  Pack, Master Case) are the **PDF** candidates. Apply `docs/funder-pack-corrections-v1.md`
  before rendering — as of this writing those source docs still carry the old "High Desert"
  brand, "$2/month" dues, and Business Plan v11 references.
