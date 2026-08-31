# Steppe preview app (embedded)

`steppe-exchange.html` is the interactive Steppe app shown on the /preview page.
It's a self-contained Claude Design export (fonts + runtime inlined, no external
dependencies), embedded in an `<iframe>` by `components/preview-embed.tsx`.

It is the complete intended-state facsimile: every planned beta destination and
feature is represented with sample people and content so the experience can be
reviewed without an authenticated account. It is not a production-data session.

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
- Don't hand-edit steppe-exchange.html — it's a generated bundle. Change it in
  Claude Design and re-export.
- Always use the self-contained / offline export; a non-offline export may rely
  on external fonts/scripts that break inside the iframe.
- If a redeploy doesn't show the update (caching), bump a version query on the
  iframe src in PreviewEmbed.tsx (e.g. ?v=2026-06-22).
