#!/usr/bin/env bash
# Render a markdown file to a brand-styled Word doc. Run from the repo root.
#   docs/brand/word/build-docx.sh <input.md> <output.docx>
set -euo pipefail
pandoc "$1" --reference-doc=docs/brand/word/steppe-reference.docx -o "$2"
echo "wrote $2"
