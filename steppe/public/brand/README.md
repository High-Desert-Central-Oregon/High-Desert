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

## Installed-app launch artwork

The manifest uses `steppe-launch.svg`, derived from the canonical
`steppe-strata-seal.svg` with viewBox `-240 -240 2880 2880`. The extra space
keeps the complete seal away from the image edge. It is vector artwork, with
192, 512, and 1024 px PNG fallbacks rendered directly from the SVG.

The separate `steppe-launch-*-maskable.png` files use viewBox
`-400 -400 3200 3200` on opaque bone (`#EDE6D5`), keeping all seal artwork
inside the centered 80% safe-zone circle. `app/apple-icon.png` is the
180 px opaque rendition of the padded launch artwork for Apple Home Screen.
The older root `icon-*.png` files remain available for existing cached references;
the manifest uses the new filenames to advertise the replacement.

To regenerate these assets from the SVG, run `node scripts/generate-launch-icons.mjs`
from the app directory after installing dependencies. The script uses Next.js's
Sharp image dependency; no new runtime library or external image service is needed.

Installed apps may retain OS-cached artwork after a website deploy. Verify a fresh
Home Screen install on the actual device before judging the launch screen.
