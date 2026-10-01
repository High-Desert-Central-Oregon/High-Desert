# Redmond neighborhood reference map

The neighborhood picker opens in **Map** mode with OpenStreetMap streets beneath
the county outlines. A lightweight static overview appears while the map library
loads and remains the initial view when the browser reports offline, Save-Data,
or a 2G connection. Members can also return to it at any time.
**List** is an equally visible alternative, with alphabetical radios and search by
full names, county plat names, or the PDF's abbreviated labels. Both modes share one selection and the
same explicit Save neighborhood action. The compact chooser beneath Map uses the
same database rows as List. Browsing the map never saves a choice.

Address suggestions appear after three characters and a 650ms pause in typing;
Find address or Enter can also search immediately. Selecting a result fills the
address field, cancels pending searches and closes the suggestions. Arrow keys and
Enter choose a result, while Escape dismisses suggestions. Selecting a covered
result opens the street map and self-hosted county outlines with an address marker.
Open street map also loads them on request from the static overview. The detailed
2019 raster loads only after choosing its background. On phones, the address field
uses its own full-width row with a short placeholder; the selected address also
appears in full as wrapping text below it. Address search is a visual reference: it never infers membership in a
boundary, assigns a neighborhood, verifies residency, or persists a home address.

## County outline source and catalog

- [Deschutes County Surveyor’s Office subdivision polygons](https://maps.deschutes.org/server/rest/services/Hosted/Subdivisions/FeatureServer/0), fetched October 1, 2026. The query includes survey types 1 (Subdivision Plat), 3 (Condo Plat) and 7 (Subdivision PM), intersecting the county's [Redmond urban growth boundary](https://maps.deschutes.org/server/rest/services/Hosted/Urban_Growth_Boundary/FeatureServer/0). Records include plats recorded in 2026. This is a dated snapshot, not a continuously refreshed feed.
- **551 source records**, grouped into **319 displayed names**. Phase/replat records retain their full source labels and IDs. Conservative suffix handling and the reviewed `county-name-aliases.json` map spelling variants to existing choices; no fuzzy spatial/name matching changes an existing neighborhood ID.
- **67 additional choices**, for **334 total choices** including all 267 existing names. Broader/outside-area choices such as Eagle Crest stay selectable even without a polygon. Named nonresidential plats remain represented, just as in the original reference catalog.
- The county layer contains recorded plat boundaries, including overlapping phases/replats and vacation records. It does not establish Steppe membership or residency eligibility. The member chooses their neighborhood; a human reviews verification.
- Clicking a polygon or using the native name selector inspects the group. **Choose {name}** updates only the unsaved form choice; Save neighborhood remains explicit. Selected outlines use thicker strokes, a permanent label and text status. Map and List share that choice.
- Address matches are computed in browser memory against the polygons, including holes and multipolygons. All overlapping names are offered for inspection, with duplicates by phase collapsed. No containing plat produces a clear message; no nearest-boundary guess or automatic profile change is made.
- `public/maps/redmond-current/overview.svg` is a static 204 KiB overview. `outlines.geojson` is 474 KiB before HTTP compression (much smaller than the 5 MiB aerial), loaded on request. `catalog.json` records date, scope, source, IDs, aliases and geometry SHA-256. The client requests a hash-versioned geometry URL and validates the complete snapshot; no external county request is made while browsing outlines.

Refresh from the public source with Python standard library only:

```sh
python3 steppe/scripts/maps/build-county-outlines.py
```

The script uses fixed public sources and no member address, login or database. It fails on incomplete downloads, unexpected geometry/coordinates or name collisions, leaving existing outputs intact. Review the new source names and aliases, generated geometry and catalog diff. It prints proposed missing choices; it does not update the database or generate/apply a migration. Update the dated UI text and coverage tests deliberately with each reviewed snapshot. The source SVG is generated from numeric geometry only. Public plat names are rendered with textContent in Leaflet tooltips.

## Historical aerial source and limits

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
  historical choices**. Existing IDs, names and member references are preserved, including
  Eagle Crest outside city limits. Marker points locate printed labels, not
  polygon centroids or boundaries.

## Release order

For this outline release, apply `migrations/0041_current_subdivision_neighborhoods.sql` in the owner's production SQL editor **before merging**. It adds 67 names with `ON CONFLICT (slug) DO NOTHING`; all existing IDs/names, profiles, RLS and trust columns are untouched. After application, the total should be at least 334 (custom additions may increase it). A fresh database receives all 334 from schema.sql. Local Postgres proof confirms the 267 existing IDs/names and a saved profile remain unchanged and a second application adds nothing. An unavailable database choice can still be inspected on the map but cannot be silently selected/saved through the map button.

```sql
select count(*) as neighborhood_options from public.neighborhoods;
-- Expect at least 334 after 0040 and 0041.
```

Historical prerequisite (already introduced with the map/list release): apply `migrations/0040_redmond_map_neighborhoods.sql` in the owner's production SQL
editor **before merging the app release**. It inserts the 232 missing rows and
ignores existing slugs; a repeat applies no additional rows. It changes no RLS,
trust columns, profiles, or existing neighborhood IDs. The production application
always reads the database catalog; until this migration is applied it continues
to show the existing 35 choices. That earlier release seeded 267 choices; the current schema adds the 67 county choices.

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
  loaded only after choosing 2019 aerial or Compare. This preserves legible small subdivision labels.
- `source.pdf`: unchanged original (~3.1 MiB), opened only from its link.
- `map.json`: source SHA-256, date, bounds, transform residual, all label locations and aliases.

## Network, accessibility, and maintenance

The normal Map view loads Leaflet, county geometry and visible street tiles.
Browsers reporting offline, Save-Data or a 2G connection initially use only the
static overview; unsupported connection hints cannot identify every slow network.
A native chooser, readable form list, static image alt text, and PDF link
remain useful without the interactive library. Loading failures return to the
static overview; outline-file failure also leaves the historical background and list usable. English and Spanish ship together. Native select, named zoom
buttons, arrow-key panning, pinch zoom, visible focus, and non-color status text
provide alternate controls. Scroll-wheel zoom is off to avoid trapping page scroll.

The default Street map and optional Compare request `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
with visible copyright attribution and a normal browser referrer. Browser HTTP
caching is unchanged; idle updates and zero extra tile buffer minimize requests.
No prefetch, bulk download, service-worker tile caching, or offline tile pack.
See [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
The external provider sees ordinary tile requests, not profile data or GPS.
For traffic beyond the small beta, review provider capacity before expanding use.

Address lookup uses Deschutes County's public E911 address points for numbered
street addresses, with Photon for places and unmatched addresses, through authenticated POST
`/api/neighborhood-address`. Unlike event-venue suggestions, it permits signed-in
members before verification, because this is part of onboarding. Queries are
limited to 200 characters / 1 KiB bodies and 30 requests per member per ten-minute
server instance window. Only the query reaches the providers (plus language for Photon), with a fixed
Redmond-area search box; identity, cookies, GPS and request headers do not. Response
coordinates are checked, queries/results are uncached and are not stored or logged.
County queries request only street address, postal community, state, ZIP and point
geometry: no owner, taxlot or household fields. Common full-word directions and
street suffixes are normalized to the county's abbreviations; partial addresses
can return up to six suggestions. County results are preferred when present, with
a three-second timeout and best-effort Photon fallback. Photon street centers and
different house numbers are excluded, so they cannot masquerade as a located home.
No new API key, dependency or database migration is required. Address-source
coverage can still be incomplete; the address service does not refresh either map source.
[Deschutes County E911 address points](https://maps.deschutes.org/server/rest/services/Hosted/E911_Address_Points/FeatureServer)
provides the public address locations; availability has no guarantee in this app.
The UI describes the provider before submission. Typed address values and markers
are cleared on leaving Map or clearing the search. Outside-coverage results produce
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
all 334 catalog rows, the actual public county geometry and synthetic address results without a hosted database. Check
Map first, List filtering (including `GLN`), selection retention across modes,
polygon/name inspection, explicit Choose then Save, failed saves, reload, keyboard access and Spanish at
390px. Address Enter must search without submitting the neighborhood form. Choosing
a result must add a marker without a write; clearing removes it. Check the
outside-map result, `&outline-failure=1`, `&address-empty=1`, `&address-failure=1`, and
`&map-image-failure=1` fallbacks. Street tiles are external and load with the default
interactive view. County outlines removes the street layer, and Return to overview
unmounts the interactive map. Check full-width address input and wrapping selected
labels at both 320px and 390px in English and Spanish.

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

## Local catalog migration proof

Create an empty disposable loopback database named `steppe_outlines_test`, then from `steppe/` run:

```sh
SUBDIVISION_TEST_DB_URL=postgresql://localhost/steppe_outlines_test node tests/fixtures/subdivision-catalog-local.mjs
```

The script refuses hosted/non-disposable databases and existing neighborhood tables. It uses a rolled-back transaction, the real neighborhood table definition and the actual migration SQL, verifies all source names, checks old IDs/names and the saved profile, and applies the INSERT twice to prove idempotence. It does not replace the separately gated local Supabase/RLS action tests or hosted acceptance.
