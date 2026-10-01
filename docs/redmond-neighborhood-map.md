# Redmond neighborhood reference map

The neighborhood picker opens in **Map** mode with a lightweight static overview.
**List** is an equally visible alternative, with alphabetical radios and search by
full names or the PDF's abbreviated labels. Both modes share one selection and the
same explicit Save neighborhood action. The compact chooser beneath Map uses the
same database rows as List. Browsing the map never saves a choice.

Address suggestions appear after three characters and a 650ms pause in typing;
Find address or Enter can also search immediately. Selecting a result fills the
address field, cancels pending searches and closes the suggestions. Arrow keys and
Enter choose a result, while Escape dismisses suggestions. Selecting a covered result loads Leaflet and the detailed
self-hosted raster, with a labeled address marker. Explore map also loads it on
request. Address search is a visual reference: it never infers membership in a
boundary, assigns a neighborhood, verifies residency, or persists a home address.

## Source and limits

- Source: `aerial_redmond_april2019.pdf`, prepared April 3, 2019 for Western Title
  Company by Fidelity National Title; supplied for this feature. The same map is
  linked by [Enjoy Bend Life's neighborhood map page](https://www.enjoybendlife.com/redmond/neighborhood-map/).
- Data: Deschutes County, State of Oregon, Esri. Imagery: Esri, DigitalGlobe,
  GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN,
  GIS User Community. The original footer and full credit text remain available.
- This is historical subdivision reference imagery, not a current boundary
  authority or survey. Plats were omitted in the source; labels can be abbreviated.
- All **263 printed subdivision/plat labels** are accounted for in
  `steppe/scripts/maps/source-labels.json`. Each row retains the printed alias,
  expanded display name, stable slug and PDF label center. This includes the
  source's named nonresidential plats; it is a catalog of that map's labels, not
  a promise of present-day neighborhood boundaries or residential eligibility.
- Cinder Butte Village, Eagle Crest, Rimrock West Estate, and Village at Ridgeview
  have no confident source-label match. They remain selectable, giving **267 total
  choices**. Existing IDs, names and member references are preserved, including
  Eagle Crest outside city limits. Marker points locate printed labels, not
  polygon centroids or boundaries.

## Release order

Apply `migrations/0040_redmond_map_neighborhoods.sql` in the owner's production SQL
editor **before merging the app release**. It inserts the 232 missing rows and
ignores existing slugs; a repeat applies no additional rows. It changes no RLS,
trust columns, profiles, or existing neighborhood IDs. The production application
always reads the database catalog; until this migration is applied it continues
to show the existing 35 choices. Fresh local databases receive all 267 in schema.sql.

After applying it, this read-only check should show 267 (or more if additional
neighborhoods were deliberately added):

```sql
select count(*) as neighborhood_options from public.neighborhoods;
```

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
- `map.json`: source SHA-256, date, bounds, transform residual, all label locations and aliases.

## Network, accessibility, and maintenance

The picker initially loads no Leaflet JavaScript, detailed raster, or street tiles.
A native chooser, readable form list, static image alt text, and PDF link
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

Address lookup uses the existing Photon provider through authenticated POST
`/api/neighborhood-address`. Unlike event-venue suggestions, it permits signed-in
members before verification, because this is part of onboarding. Queries are
limited to 200 characters / 1 KiB bodies and 30 requests per member per ten-minute
server instance window. Only the query and language reach Photon, with a fixed
Redmond-area search box; identity, cookies, GPS and request headers do not. Response
coordinates are checked, queries/results are uncached and are not stored or logged.
The UI describes the provider before submission. Typed address values and markers
are cleared on leaving Map or clearing the search. Outside-image results produce
an explicit coverage message, with no misleading marker at the map's edge.
[Photon API documentation](https://github.com/komoot/photon/blob/master/docs/api-v1.md)
supports search, location bias and bounding-box filtering. Its public instance is
best-effort and may throttle; provider failures leave Map/List usable. For a wider
release, review geocoder capacity alongside the tile provider.

The supplied map's printed text remains in its source language; surrounding UI and
status/help text are translated. Map browsing is optional and never replaces the
accessible list or the human follow-up for None of these fit.

## Verification

Use the real-component local fixture at `/?screen=neighborhoods`; it supplies
all catalog rows and synthetic address results without a hosted database. Check
Map first, List filtering (including `GLN`), selection retention across modes,
explicit save from each mode, failed saves, reload, keyboard access and Spanish at
390px. Address Enter must search without submitting the neighborhood form. Choosing
a result must add a marker without a write; clearing removes it. Check the
outside-map result, `&address-empty=1`, `&address-failure=1`, and
`&map-image-failure=1` fallbacks. Street tiles are external and load only on explicit
Street map / Compare choice.

Run the source-text coverage check with pypdf installed:

```sh
python scripts/maps/verify-source-labels.py
```

It checks all 263 individual subdivision text blocks (excluding road text and
credits) against the catalog's preserved printed labels and source hash. Metadata
can be regenerated without re-rendering the raster by adding `--metadata-only` to
the builder command. The source raster/PDF remain unchanged in the catalog release.
The route/parser tests exercise authentication, bounds, payload limits, provider
failure, privacy and catalog/seed/migration parity. A disposable local Postgres
migration check confirms 232 first inserts, zero on replay, 267 final rows and
unchanged IDs/names/member references for all original 35 choices.
