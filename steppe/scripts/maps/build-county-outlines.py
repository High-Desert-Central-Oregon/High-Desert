#!/usr/bin/env python3
"""Build a public, address-free Redmond subdivision snapshot. Python stdlib only.

Fetches fixed public county sources; never accepts a home address or credentials.
Refreshes geometry/catalog, but prints proposed missing choices rather than
writing a migration, changing existing IDs, or contacting Steppe's database.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
SOURCE = 'https://maps.deschutes.org/server/rest/services/Hosted/Subdivisions/FeatureServer/0'
UGB = 'https://maps.deschutes.org/server/rest/services/Hosted/Urban_Growth_Boundary/FeatureServer/0'

def request(url, params=None):
    body = urllib.parse.urlencode(params).encode() if params else None
    return json.load(urllib.request.urlopen(urllib.request.Request(url, data=body), timeout=30))

def key(name):
    return re.sub('[^a-z0-9]', '', name.lower())

def slug(name):
    return re.sub('[^a-z0-9]+', '-', name.lower()).strip('-')

def display_name(raw):
    name = raw.title()
    name = re.sub(r"'S\b", "'s", name)
    name = re.sub(r'(\d+)(St|Nd|Rd|Th)\b', lambda m: m[1] + m[2].lower(), name)
    name = re.sub(r'\bIi\b', 'II', name)
    name = re.sub(r'\b(At|The|Of)\b', lambda m: m[1].lower() if m.start() else m[1], name)
    return name

def base_name(raw):
    name = raw.splitlines()[0].strip()
    name = re.sub(r'\s+711-.*', '', name)
    # Preserve original full labels below. Strip record suffixes only from the
    # grouped display name; explicit spelling/name exceptions live in aliases.
    name = re.split(r'\s*[,;-]?\s+(?:PHASES?\b|REPLAT\b|SUPPLEMENTAL\b|PART\b|STAGE\b|NO\.?\s+\d|P\.?U\.?D\.?)', name, flags=re.I)[0]
    return re.sub(r'\s*\(VACATION PLAT\)\s*$', '', name, flags=re.I).strip(' ,-')

def round_coordinates(value):
    if isinstance(value, list):
        return [round_coordinates(v) for v in value]
    return round(value, 6)

def points(geometry):
    def visit(value):
        if len(value) == 2 and isinstance(value[0], (float, int)):
            yield value
        else:
            for child in value:
                yield from visit(child)
    return list(visit(geometry['coordinates']))

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--input', type=Path, help='Previously fetched, public county GeoJSON')
    args.add_argument('--date', default=datetime.now(timezone.utc).date().isoformat())
    args = args.parse_args()
    if args.input:
        source = json.loads(args.input.read_text())
    else:
        footprint = request(UGB + '/query', {'f': 'json', 'where': "city = 'REDMOND'", 'outFields': 'city', 'outSR': '4326'})
        if footprint.get('error') or len(footprint.get('features', [])) != 1:
            raise ValueError('Expected one Redmond UGB; existing snapshot preserved')
        query = {
            'f': 'geojson', 'where': 'surveytypes IN (1,3,7)',
            'outFields': 'objectid,name,record_date,surveytypes,csnum',
            'geometry': json.dumps(footprint['features'][0]['geometry']),
            'geometryType': 'esriGeometryPolygon', 'inSR': '4326',
            'spatialRel': 'esriSpatialRelIntersects', 'outSR': '4326',
            'orderByFields': 'objectid', 'resultRecordCount': '2000',
        }
        source = request(SOURCE + '/query', query)
        count = request(SOURCE + '/query', {**query, 'f': 'json', 'returnCountOnly': 'true'})
        if count.get('error') or count.get('count') != len(source.get('features', [])):
            raise ValueError('Incomplete source count; existing snapshot preserved')
    if source.get('error') or source.get('exceededTransferLimit') or not source.get('features'):
        raise ValueError('Failed/incomplete source; existing snapshot preserved')
    aliases = json.loads((ROOT / 'scripts/maps/county-name-aliases.json').read_text())
    historical = json.loads((ROOT / 'scripts/maps/source-labels.json').read_text())
    historical += [{'slug': slug(n), 'name': n} for n in ['Cinder Butte Village', 'Eagle Crest', 'Rimrock West Estate', 'Village at Ridgeview']]
    known = {key(n['name']): n for n in historical}
    groups = {}
    features = []
    seen = set()
    for record in source['features']:
        p, geometry = record['properties'], record['geometry']
        if record.get('type') != 'Feature' or not isinstance(p['objectid'], int) or p['objectid'] in seen:
            raise ValueError('Invalid or repeated source ID')
        seen.add(p['objectid'])
        if p['surveytypes'] not in [1, 3, 7] or geometry['type'] not in ['Polygon', 'MultiPolygon']:
            raise ValueError('Unexpected survey or geometry type')
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        if not polygons or any(not rings or any(
            len(ring) < 4 or ring[0] != ring[-1] or any(
                len(point) != 2 or any(not isinstance(v, (float, int)) or not math.isfinite(v) for v in point)
                for point in ring
            ) for ring in rings
        ) for rings in polygons):
            raise ValueError('Invalid polygon rings; existing snapshot preserved')
        base = base_name(p['name'])
        name = aliases.get(base.upper(), known.get(key(base), {}).get('name', display_name(base)))
        canonical = known.get(key(name), {'name': name, 'slug': slug(name)})
        coords = points(geometry)
        if not coords or any(not (-121.35 <= lng <= -121.08 and 44.18 <= lat <= 44.4) for lng, lat in coords):
            raise ValueError('Unexpected coordinates; inspect source before changing scope')
        row = groups.setdefault(canonical['slug'], {**canonical, 'platNames': set(), 'sourceIds': [], 'bounds': [90, 180, -90, -180]})
        if row['name'] != name:
            raise ValueError('Display-name collision')
        plat = re.sub(r'\s+', ' ', p['name']).strip()
        row['platNames'].add(plat)
        row['sourceIds'].append(p['objectid'])
        south, west, north, east = row['bounds']
        row['bounds'] = [min(south, min(x[1] for x in coords)), min(west, min(x[0] for x in coords)), max(north, max(x[1] for x in coords)), max(east, max(x[0] for x in coords))]
        features.append({'type': 'Feature', 'properties': {'sourceId': p['objectid'], 'name': name, 'slug': canonical['slug'], 'platName': plat, 'recorded': p['record_date']}, 'geometry': {**geometry, 'coordinates': round_coordinates(geometry['coordinates'])}})
    catalog = []
    for row in sorted(groups.values(), key=lambda row: row['name'].lower()):
        row['platNames'] = sorted(row['platNames'])
        row['sourceIds'].sort()
        row['bounds'] = [round(v, 6) for v in row['bounds']]
        catalog.append(row)
    b = [min(r['bounds'][0] for r in catalog), min(r['bounds'][1] for r in catalog), max(r['bounds'][2] for r in catalog), max(r['bounds'][3] for r in catalog)]
    out = ROOT / 'public/maps/redmond-current'
    out.mkdir(parents=True, exist_ok=True)
    geojson = json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')) + '\n'
    meta = {'date': args.date, 'source': SOURCE, 'copyright': "Deschutes County — Surveyor’s Office", 'scope': "Plats intersecting Redmond's urban growth boundary; survey types 1, 3, 7", 'sourceFeatureCount': len(features), 'geometrySha256': hashlib.sha256(geojson.encode()).hexdigest(), 'bounds': [[b[0], b[1]], [b[2], b[3]]], 'neighborhoods': catalog}
    (out / 'outlines.geojson').write_text(geojson)
    (out / 'catalog.json').write_text(json.dumps(meta, indent=2) + '\n')
    # A compact static preview uses the same shapes, requiring no JavaScript or
    # external provider. SVG is generated only from validated numeric coordinates.
    south, west, north, east = b
    width, height = 720, 860
    def xy(point):
        lng, lat = point
        return f'{24+(lng-west)/(east-west)*(width-48):.1f},{height-24-(lat-south)/(north-south)*(height-48):.1f}'
    paths = []
    for f in features:
        polygons = f['geometry']['coordinates'] if f['geometry']['type'] == 'MultiPolygon' else [f['geometry']['coordinates']]
        for polygon in polygons:
            d = ' '.join('M' + ' L'.join(xy(p) for p in ring) + ' Z' for ring in polygon)
            paths.append(f'<path d="{d}"/>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="#f8f3e8"/><g fill="#c6d7ca" stroke="#234c39" stroke-width="0.7" fill-rule="evenodd">'+''.join(paths)+'</g></svg>\n'
    (out / 'overview.svg').write_text(svg)
    missing = [r for r in catalog if key(r['name']) not in known]
    print(json.dumps({'features': len(features), 'groups': len(catalog), 'geometryBytes': len(geojson.encode()), 'newChoices': [{'slug': r['slug'], 'name': r['name']} for r in missing]}, indent=2))

if __name__ == '__main__':
    main()
