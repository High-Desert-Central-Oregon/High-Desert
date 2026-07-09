#!/usr/bin/env bash
# Render a markdown (or .docx) file to a brand-styled PDF. Run from the repo root.
#   docs/brand/pdf/build.sh <input.md|input.docx> <output.pdf>
set -euo pipefail
in="$1"; out="$2"
pandoc "$in" -o "$out" --pdf-engine=tectonic \
  -H docs/brand/pdf/steppe-brand.tex \
  -V geometry:margin=0.9in -V linkcolor=steppesage -V fontsize=11pt
echo "wrote $out"
