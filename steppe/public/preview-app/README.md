# Steppe preview app (embedded)

`steppe-exchange.html` is the interactive Steppe app shown on the /preview page.
It's a self-contained Claude Design export (fonts + runtime inlined, no external
dependencies), embedded in an `<iframe>` by `components/preview-embed.tsx`.

It is the complete beta facsimile: shipped destinations and member actions are
represented with sample people and content so the experience can be reviewed
without an authenticated account. It is not a production-data session. Preview
rows must map to a live beta route or action; future or paid features do not get
dead doors here.

## Updating the preview
1. In Claude Design, re-export as a self-contained ("offline"), APP-ONLY build —
   just the phone, with NO board background, tokens sheet, caption, or A/B
   comparison (transparent or #FBF7EE background is ideal).
2. Overwrite public/preview-app/steppe-exchange.html (keep the filename).
3. Confirm its navigation labels, moderation terminology, and privacy promises
   still match the live app dictionaries and current decisions.
4. Bump the version query in `components/preview-embed.tsx`, then commit and
   redeploy.

## Notes
- Re-exporting from Claude Design is the preferred update path. If a small parity
  correction must be made without the design source, parse and reserialize the
  `__bundler/template` JSON payload rather than editing its escaped line by hand,
  then run the preview-consistency test and a browser check immediately.
- Always use the self-contained / offline export; a non-offline export may rely
  on external fonts/scripts that break inside the iframe.
- Keep the direct-preview stage viewport-sized and `overflow: clip`, with the
  phone scaled to fit. A scrollable outer stage lets browser focus handling move
  the whole device when the bottom tab rail is selected.
- If a redeploy doesn't show the update (caching), bump a version query on the
  iframe src in PreviewEmbed.tsx (e.g. ?v=2026-06-22).
