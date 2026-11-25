# 0016. Maps: MapLibre with OpenFreeMap tiles

- Status: Accepted (owner decision, 2026-11-25)
- Date: 2026-11-25

## Context

AGENTS.md: "Maps: MapLibre with OpenStreetMap-compatible tiles. No paid map
provider in the MVP", and field registration with a "GPS pin (manual
adjustment)". Until now pins were typed in as numbers, and nobody could see
fields on a map.

The owner decided:

1. **Tiles:** OpenFreeMap (hosted OpenStreetMap vector tiles).
2. **Scope:** show field pins and boundaries, pick a pin on a map, and an
   admin overview of a region's fields.

## Decision

- **Library:** `maplibre-gl` 6 (BSD-3-Clause), the one new dependency.
- **Tiles:**
  - style `https://tiles.openfreemap.org/styles/liberty`: no API key, no
    usage limits, commercial use allowed
  - overridable with `NEXT_PUBLIC_MAP_STYLE_URL`
  - the attribution (OpenFreeMap, OpenMapTiles, OpenStreetMap) stays visible
- **Loading, for low-end phones:**
  - MapLibre is imported only when a map scrolls into view, or when a
    collapsed "Show map" on a pilot's job card opens
  - pages without a visible map never download it
  - maps use cooperative gestures: one finger scrolls the page, two move the
    map
- **Worker:**
  - MapLibre 6 loads its web worker from beside its own module file, which
    bundling moves
  - `scripts/copy-map-worker.mjs` copies the worker to `public/vendor/`
    before `dev` and `build`; the copy is git-ignored
  - the app calls `setWorkerUrl("/vendor/…")`
  - the locale proxy skips `vendor/`
- **Where maps appear:**
  - **Farmer page:** the farmer's fields, with boundaries where recorded
  - **Add field:** a pin picker. Tap or drag to set the pin. It stays in step
    with the latitude/longitude inputs and "Use my location"; the inputs
    remain the source of truth and the fallback.
  - **Booking page:** the booked fields (snapshot pins)
  - **Pilot job card:** a collapsed map of the job's fields
  - **Field map** (`/dashboard/map`): for organization admins (any region)
    and regional admins (their regions). Active fields of a region, coloured
    by booking: open booking, sprayed in the last 30 days, or neither.
    Capped at 1,000 fields per view.
- **Boundaries:**
  - PostgREST returns geography as hex EWKB, so the computed column
    `boundary_geojson(fields)` returns GeoJSON
  - it is security invoker, so it adds no access (pgTAP:
    `supabase/tests/maps.test.sql`)
- **Fallback:** without WebGL, or if tiles fail, the map shows a message.
  Coordinates stay listed as text on every page.

## Alternatives considered

- **Self-hosted Protomaps (PMTiles):** fully independent, but needs a large
  India extract built, hosted, and refreshed. It remains the path if
  OpenFreeMap becomes unsuitable: only the style URL changes.
- **openstreetmap.org standard tiles:** their usage policy doesn't allow
  app-level traffic.
- **Paid providers (Mapbox, Google, MapTiler):** excluded by AGENTS.md for
  the MVP.

## Consequences

- **Third-party dependency:** OpenFreeMap is a free service without an SLA.
  If it's down, maps show the fallback message, and booking and field entry
  keep working.
- **Privacy:** the browser fetches tiles for the area being viewed directly
  from OpenFreeMap. That reveals the approximate area and the viewer's IP
  address to the tile host, but no farmer names, phone numbers, or ids.
  Revisit with self-hosting before production if this is unacceptable.
- **No satellite basemap:** there is no free satellite imagery with
  suitable terms, so pins are placed on a street/landuse map. Field
  boundary drawing remains out of MVP scope (AGENTS.md).
