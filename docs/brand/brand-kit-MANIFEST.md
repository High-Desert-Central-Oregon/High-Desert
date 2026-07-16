# Steppe brand kit — manifest

Generated 2026-07-11. Companion to the Claude Code integration prompt.

## brand/ — logo assets

| file | role | notes |
|---|---|---|
| steppe-strata-seal.png | Strata Seal master (2400 px, transparent) | canonical raster; docs only, do not ship to public/ |
| steppe-strata-seal.svg | Strata Seal vector | near-lossless trace; use for any size ≥96 px |
| steppe-strata-seal-512.png | Seal web raster | screen use where SVG is awkward |
| steppe-strata-seal-mono.png/.svg/-512.png | Seal ink-only variant | single-color contexts: dark mode, stamps, watermarks, small sizes |
| steppe-isomimo-transparent.png | ISoMiMo master (3176×3856, transparent) | canonical raster for screens; docs only, do not ship to public/ |
| steppe-isomimo.svg | ISoMiMo vector | gradients posterize into stepped bands — intended for large-format print, cut vinyl, swag; PNG stays canonical on screen |
| steppe-isomimo-512.png | ISoMiMo web raster | screen use |

## posters/ — production print files (live QRs, do not edit)

1d board 11×17 no-flood v3 · 1e counter 11×17 no-flood v4 · 1c statement 18×24 +0.125" bleed v3 · print pack v4 (pages verified 11×17 / 11×17 / 18.25×24.25). QRs encode www.steppe.community/d /e /c and are decode-verified; those slugs redirect to /join with first-party zero-PII Supabase variants poster_owned / poster_built / poster_common. The transparent posters print ink-direct on Cougar Natural.

## Placement tiers (enforced in the integration prompt)

- **Wordmark** — navigation and headers only. Illustrated marks never appear in nav.
- **Strata Seal (color)** — official moments: site footer, join confirmation, governance surfaces, transactional email footers. Floor 96 px.
- **Seal mono** — single-color and small contexts: dark-mode footer, document/receipt stamps. Floor 48 px.
- **ISoMiMo** — warmth: landing community section, empty states, 404, celebrations, swag. Floor 120 px. Never an icon.
- **Favicon / app icon** — unchanged; stays on the existing appicon/strata-glyph lineage.
