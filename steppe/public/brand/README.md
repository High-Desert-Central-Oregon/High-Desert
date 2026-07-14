# Brand marks — which file the app actually uses

Two visual families of the Strata seal live here. This note exists so a future
maintainer doesn't find two seal files and guess which is live.

**In use by the app (do not remove):**
- `steppe-strata-seal.svg` — footer, join form, governance vote
- `steppe-strata-seal-mono.svg` — CSS mask
- `steppe-strata-seal-512.png` — transactional email shell

**Intentional but unwired (present on purpose, not referenced by any code yet):**
- `steppe-strata-seal-drawn.svg`
- `steppe-strata-seal-drawn-mono.svg`
- `steppe-strata-drawn-512.png`

The hand-drawn `-drawn` marks are staged for a future look. Swapping the app
over to them is a separate, deliberate change — not scheduled. Until then the
plain `-seal` files remain canonical; the `-drawn` files are safe to keep and
should not be treated as dead assets.
