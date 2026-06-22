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
