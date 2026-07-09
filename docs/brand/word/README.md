# Steppe brand Word reference

`steppe-reference.docx` is a pandoc **reference document** rebranded to Steppe:
**Besley** headings (sage-deep green), **Schibsted Grotesk** body, **Martian Mono**
code, palette matched to `steppe/app/(site)/tokens.css`. It's the Word counterpart to
the PDF toolkit in `docs/brand/pdf/` — use it for the **living documents** that stay
editable in Word (Governance Charter, Business Plan, COI packet, Funder Eligibility).

## Two uses

1. **Markdown → branded Word** (from the repo root):
   ```bash
   docs/brand/word/build-docx.sh input.md output.docx
   # or: pandoc input.md --reference-doc=docs/brand/word/steppe-reference.docx -o output.docx
   ```
2. **Theme an existing Word doc:** open `steppe-reference.docx` in Word — the brand
   styles (Normal, Title, Heading 1–6) live in its Styles pane. To apply them to a
   living document, copy the styles across with Word's **Manage Styles → Import/Export**
   (the Organizer), or start the doc from this file as a template.

## Requires the brand fonts installed

Word displays the styles' font *names*; it can't render **Besley / Schibsted Grotesk /
Martian Mono** unless they're installed on the machine. Install the TTFs from
`docs/brand/fonts/` first (double-click each → Install), or Word will substitute.

## Format guide

- **Living** (edited/ratified) → brand **Word** (this reference).
- **Finalized / distribution** (funder pitch) → brand **PDF** (`docs/brand/pdf/`).
