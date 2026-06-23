# Steppe preview app (embedded)

`steppe-exchange.html` is the interactive Steppe app shown on the /preview page.
It's a self-contained Claude Design export (fonts + runtime inlined, no external
dependencies), embedded in an <iframe> by components/PreviewEmbed.tsx.

## Updating the preview
1. In Claude Design, re-export as a self-contained ("offline"), APP-ONLY build —
   just the phone, with NO board background, tokens sheet, caption, or A/B
   comparison (transparent or #FBF7EE background is ideal).
2. Overwrite public/preview-app/steppe-exchange.html (keep the filename).
3. Commit and redeploy (Vercel). No code changes needed.

## Notes
- Don't hand-edit steppe-exchange.html — it's a generated bundle. Change it in
  Claude Design and re-export.
- Always use the self-contained / offline export; a non-offline export may rely
  on external fonts/scripts that break inside the iframe.
- If a redeploy doesn't show the update (caching), bump a version query on the
  iframe src in PreviewEmbed.tsx (e.g. ?v=2026-06-22).
