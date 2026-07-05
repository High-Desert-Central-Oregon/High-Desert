# Design-source provenance

`GenerativeLandscape` (`steppe/app/(site)/_components/generative-landscape.tsx`) was
ported from **`steppe-generative-landscape-v5.html`** — the standalone generative-landscape
prototype: the full weather shader (cloud / overcast / wet / snow mood response), the real
synodic phased moon, and the `dawn / day / golden / dusk / night` palettes + weather presets.

Earlier commit messages and the component's comment originally cited
`steppe-landscape-v5.html`. That path (added by commit `218ea1f`, _"add landscape dhero
design v5"_) held a **byte-identical copy of this same generative prototype** — it was the
correct port source all along, just under an ambiguous name. It has been renamed to
`steppe-generative-landscape-v5.html` so the provenance is unambiguous going forward. (The
old commits are immutable and still reference the former name; this note resolves them.)

A **separate** artifact — the three-direction _"Steppe — Product directions"_ landing-aesthetic
comparison (Charter / Console / Commons over a stripped 3-palette atmosphere shader, with no
weather and no moon) — lives at `steppe-product-directions.html`. It is **not** the port
source.

These `_design-source/*.html` files are reference artifacts only; nothing imports them at
build or runtime.

---

## Addendum (2026-07-04) — page canon, type system, and the preview export

- **Landing source of truth:** `steppe-align-broadsheet-mix.html` (the Broadsheet × Plate
  mock; commit `6487458` named it so). The implemented landing is
  `steppe/app/(site)/page.tsx` + `broadsheet.css`. `steppe-landing.html` and
  `steppe-landing-v5.html` are superseded for the landing; v5 survives in subpage hero
  language and tokens.
- **Page pairs:** the `-v5` / `-v2` / `-v3` files supersede their unversioned siblings
  (`steppe-landing`, `steppe-partners`, `steppe-preview`).
- **Type system:** the site migrated to **Besley / Schibsted Grotesk / Martian Mono**
  (commit `60a1d8c`). The subpage design files still name the earlier
  Newsreader / Libre Franklin / DM Mono system — read their type specs as superseded;
  layout/structure/copy remain the reference.
- **The live preview embed** (`steppe/public/preview-app/steppe-exchange.html`) is a
  self-contained Claude Design runtime export with no `_design-source/` counterpart. Its
  canonical copy + extracted tokens live at `docs/design/exchange-preview-2026-07.html`
  (byte-identical, SHA-256 `2e5d4a2d…`) and `docs/design/exchange-design-tokens-reference.css`.
  The old in-page facsimile from `steppe-preview-v3.html` was replaced by this embed; its
  dead CSS was removed 2026-07-04.
