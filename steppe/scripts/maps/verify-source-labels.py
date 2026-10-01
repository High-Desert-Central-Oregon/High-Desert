#!/usr/bin/env python3
"""Check the complete catalog against the supplied PDF's subdivision text layer.
Uses pypdf; road text (other fonts/transforms), credits and duplicate parent
XObject text are excluded. Printed aliases are retained, including abbreviations.
"""
import hashlib
import json
from pathlib import Path
import re
from pypdf import PdfReader

root = Path(__file__).resolve().parents[2]
source = root / 'public/maps/redmond-2019/source.pdf'
rows = json.loads(Path(__file__).with_name('source-labels.json').read_text())
labels = []
def visit(text, _cm, _tm, font, size):
    if text.strip() and font and 'Verdana-Bold' in str(font.get('/BaseFont', '')) and 6 <= size <= 7 and len(text) < 200:
        labels.append(re.sub(r'\s', '', text))
PdfReader(source).pages[0].extract_text(visitor_text=visit)
assert len(labels) == 263
assert sorted(labels) == sorted(re.sub(r'\s', '', row['printed']) for row in rows)
assert len({row['slug'] for row in rows}) == len(rows)
metadata = json.loads((root / 'public/maps/redmond-2019/map.json').read_text())
assert metadata['sourceSha256'] == hashlib.sha256(source.read_bytes()).hexdigest()
assert set(metadata['anchors']) == {row['name'] for row in rows}
print('263 of 263 printed subdivision labels accounted for; catalog, map and source agree.')
