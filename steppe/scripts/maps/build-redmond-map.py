#!/usr/bin/env python3
"""Render and reproject the supplied GeoPDF; never fetch street tiles.
Requires pdftoppm, numpy, Pillow, pypdf, pyproj. See docs/redmond-neighborhood-map.md.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

import numpy as np
from PIL import Image
from pypdf import PdfReader
from pyproj import CRS, Transformer

# Manually checked source-label centers in PDF points (x, top-down y).
# These locate printed labels, not polygon centroids or authoritative boundaries.
LABELS = {
    'Braydon Park': (664, 447),
    'Canyon Crossing': (876, 302),
    'Canyon Rim Village': (752, 484),
    'Cascade View Estates': (369, 1265),
    'Cascade West': (621, 322),
    'Deer Crossing': (511, 671),
    'Diamond Bar Ranch': (1100, 199),
    'Echo Rim Estates': (660, 144),
    'Emerald View Estates': (236, 1127),
    'Evansville': (686, 333),
    'Fieldstone': (598, 1200),
    'Greens at Redmond': (527, 1391),
    'Maple Meadows': (604, 484),
    'Maplewood': (779, 194),
    'McKenzie Rim Estates': (700, 222),
    'Meadowbrook Estates': (475, 754),
    'Megan Park': (603, 532),
    'Mountain Glenn': (650, 218),
    'North Rim': (815, 267),
    'Obsidian Trails': (381, 977),
    'Pine Tree Meadows': (880, 120),
    'Pleasant View': (696, 343),
    'Red Hawk': (672, 488),
    'Red-Bar Estates': (1108, 345),
    'Sterling Pointe': (667, 187),
    'Summit Crest': (162, 1190),
    'Triple Ridge': (381, 1468),
    'Vista Meadows': (759, 114),
    'West Canyon Estates': (674, 283),
    'Wildflower': (700, 358),
    'Windsong': (688, 313),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--output', type=Path, default=Path('public/maps/redmond-2019'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    page = PdfReader(args.pdf).pages[0]
    viewport = page['/VP'][0].get_object()
    measure = viewport['/Measure']
    bbox = list(map(float, viewport['/BBox']))
    assert bbox == [18, 18, 1206, 1566], 'Review changed viewport before regenerating'
    gps = np.asarray(measure['/GPTS'], dtype=float).reshape(4, 2)
    source_crs = CRS.from_wkt(str(measure['/GCS']['/WKT']))
    to_source = Transformer.from_crs(source_crs.geodetic_crs, source_crs, always_xy=True)
    to_mercator = Transformer.from_crs(source_crs, 3857, always_xy=True)
    from_mercator = Transformer.from_crs(3857, source_crs, always_xy=True)
    to_geo = Transformer.from_crs(source_crs, 4326, always_xy=True)
    # PDF top-down coordinates paired with embedded LL, UL, UR, LR coordinates.
    corners = np.array([[18, 1566], [18, 18], [1206, 18], [1206, 1566]], dtype=float)
    source_xy = np.column_stack(to_source.transform(gps[:, 1], gps[:, 0]))
    design = np.column_stack([corners, np.ones(4)])
    affine = np.linalg.lstsq(design, source_xy, rcond=None)[0]
    residual_m = np.max(np.linalg.norm(design @ affine - source_xy, axis=1)) * source_crs.axis_info[0].unit_conversion_factor
    assert residual_m < 2, f'Georeference residual {residual_m:.2f}m exceeds tolerance'
    inverse = np.linalg.inv(affine[:2, :])
    # Sample the whole viewport edge, so a curved projected edge cannot be clipped.
    t = np.linspace(0, 1, 101)
    edges = np.concatenate([corners[i] + t[:, None] * (corners[(i + 1) % 4] - corners[i]) for i in range(4)])
    projected_edges = np.column_stack([edges, np.ones(len(edges))]) @ affine
    edge_m = np.column_stack(to_mercator.transform(projected_edges[:, 0], projected_edges[:, 1]))
    west, south = edge_m.min(axis=0)
    east, north = edge_m.max(axis=0)
    height = 6000
    width = round(height * (east - west) / (north - south))
    with tempfile.TemporaryDirectory() as tmp:
        prefix = Path(tmp) / 'source'
        subprocess.run(['pdftoppm', '-scale-to', '6000', '-singlefile', '-png', str(args.pdf), str(prefix)], check=True)
        original = Image.open(prefix.with_suffix('.png')).convert('RGB')
        preview = original.copy()
        preview.thumbnail((720, 960))
        preview.save(args.output / 'overview.webp', quality=78, method=6)
        pixels = np.asarray(original)
        sx = original.width / float(page.mediabox.width)
        sy = original.height / float(page.mediabox.height)
        output = np.zeros((height, width, 4), dtype=np.uint8)
        mx = west + (np.arange(width) + .5) * (east - west) / width
        for start in range(0, height, 128):
            end = min(start + 128, height)
            my = north - (np.arange(start, end) + .5) * (north - south) / height
            xx, yy = np.meshgrid(mx, my)
            px, py = from_mercator.transform(xx, yy)
            pdf_xy = (np.stack([px, py], axis=-1) - affine[2]) @ inverse
            valid = ((pdf_xy[..., 0] >= 18) & (pdf_xy[..., 0] <= 1206) &
                     (pdf_xy[..., 1] >= 18) & (pdf_xy[..., 1] <= 1566))
            ux = np.clip(pdf_xy[..., 0] * sx - .5, 0, original.width - 1.001)
            uy = np.clip(pdf_xy[..., 1] * sy - .5, 0, original.height - 1.001)
            x0, y0 = ux.astype(int), uy.astype(int)
            dx, dy = (ux - x0)[..., None], (uy - y0)[..., None]
            color = ((pixels[y0, x0] * (1 - dx) + pixels[y0, x0 + 1] * dx) * (1 - dy) +
                     (pixels[y0 + 1, x0] * (1 - dx) + pixels[y0 + 1, x0 + 1] * dx) * dy)
            output[start:end, :, :3] = color.round().astype(np.uint8)
            output[start:end, :, 3] = np.where(valid, 255, 0)
        Image.fromarray(output).save(args.output / 'aerial.webp', quality=88, method=6)
    geo_from_mercator = Transformer.from_crs(3857, 4326, always_xy=True)
    sw = geo_from_mercator.transform(west, south)
    ne = geo_from_mercator.transform(east, north)
    anchors = {}
    for name, point in LABELS.items():
        xy = np.array([*point, 1]) @ affine
        lon, lat = to_geo.transform(*xy)
        anchors[name] = [round(lat, 7), round(lon, 7)]
    metadata = {
        'date': '2019-04-03',
        'sourceSha256': hashlib.sha256(args.pdf.read_bytes()).hexdigest(),
        'bounds': [[sw[1], sw[0]], [ne[1], ne[0]]],
        'width': width, 'height': height,
        'georeferenceResidualMeters': round(float(residual_m), 3),
        'anchors': anchors,
    }
    (args.output / 'map.json').write_text(json.dumps(metadata, indent=2) + '\n')
    (args.output / 'source.pdf').write_bytes(args.pdf.read_bytes())
    print(json.dumps({'size': [width, height], 'residualMeters': residual_m,
                      'anchors': len(anchors)}, indent=2))


if __name__ == '__main__':
    main()
