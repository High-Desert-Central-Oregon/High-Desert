# Redmond neighborhood reference map

The neighborhood picker offers a native disclosure with a static overview and the
original PDF. Explore map loads a self-hosted detailed raster and Leaflet 1.9.4.
The member can pan/zoom, find a printed label, or explicitly choose Street map or
Compare to load OpenStreetMap tiles. Browsing does not save a neighborhood; the
existing radio list and Save neighborhood remain the only selection workflow.

## Source and limits

- Source: `aerial_redmond_april2019.pdf`, prepared April 3, 2019 for Western Title
  Company by Fidelity National Title; supplied for this feature. The same map is
  linked by [Enjoy Bend Life's neighborhood map page](https://www.enjoybendlife.com/redmond/neighborhood-map/).
- Data: Deschutes County, State of Oregon, Esri. Imagery: Esri, DigitalGlobe,
  GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN,
  GIS User Community. The original footer and full credit text remain available.
- This is historical subdivision reference imagery, not a current boundary
  authority or survey. Plats were omitted in the source; labels can be abbreviated.
- 31 manually checked label centers are matched to the seeded names. They are
  reference points, not polygon centroids, boundaries, or inferred residences.
  Cinder Butte Village, Eagle Crest, Rimrock West Estate, and Village at Ridgeview
  have no confident source-label match. The UI says so and leaves them selectable.
  Eagle Crest remains in the seed; this map covers central Redmond only.
- No migration, address lookup, device location, member marker, or automatic
  neighborhood assignment is involved.

## Georeferencing and rebuilding

The GeoPDF carries a `Plats` viewport `[18,18,1206,1566]`, geographic corner
coordinates, and a NAD83 Oregon South State Plane international-feet projection.
`steppe/scripts/maps/build-redmond-map.py` fits the PDF-to-source-projection affine
transform, checks its maximum corner residual is below 2 meters, and resamples
through that projection into Web Mercator. An axis-aligned overlay without this
reprojection would shift the rotated source. The current fit residual is about
0.33 meters; this is an internal fit check, **not a claim of positional accuracy**.
The corner coordinates in the PDF are rounded and the imagery is historical.

Requirements: Python with NumPy, Pillow, pypdf, pyproj; Poppler's `pdftoppm`.
From the `steppe/` application directory:

```sh
python scripts/maps/build-redmond-map.py /path/to/aerial_redmond_april2019.pdf
```

Generated files in `steppe/public/maps/redmond-2019/`:

- `overview.webp`: full-page static overview (~193 KiB), lazy-loaded when visible.
- `aerial.webp`: 4609 × 6000 transparent-edge Web Mercator raster (~5 MiB),
  loaded only after Explore map. This preserves legible small subdivision labels.
- `source.pdf`: unchanged original (~3.1 MiB), opened only from its link.
- `map.json`: source SHA-256, date, bounds, transform residual, label locations.

## Network, accessibility, and maintenance

The picker initially loads no Leaflet JavaScript, detailed raster, or street tiles.
A native details element, readable form list, static image alt text, and PDF link
remain useful without the interactive library. Loading failures return to the
static overview. English and Spanish ship together. Native select, named zoom
buttons, arrow-key panning, pinch zoom, visible focus, and non-color status text
provide alternate controls. Scroll-wheel zoom is off to avoid trapping page scroll.

Street/Compare explicitly request `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
with visible copyright attribution and a normal browser referrer. Browser HTTP
caching is unchanged; idle updates and zero extra tile buffer minimize requests.
No prefetch, bulk download, service-worker tile caching, or offline tile pack.
See [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
The external provider sees ordinary tile requests, not profile data or GPS.
For traffic beyond the small beta, review provider capacity before expanding use.

The supplied map's printed text remains in its source language; surrounding UI and
status/help text are translated. Map browsing is optional and never replaces the
accessible list or the human follow-up for None of these fit.

## Verification

Use the real-component local fixture at `/?screen=neighborhoods`; it includes
confident labels plus absent names without contacting a database. Verify the
closed disclosure and overview, Explore, label lookup, layer comparison, missing
labels, keyboard navigation, Spanish/mobile, and save retention. Inspect alignment
at the US 97 / Highland Avenue interchange and the northern US 97 interchange;
label markers should land on the corresponding printed words.
