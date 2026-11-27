# 0025. Crop monitoring with drawn field boundaries (simulated data for the demo)

- Status: Accepted (owner decision, 2026-11-27)
- Date: 2026-11-27

## Context

The owner asked for crop monitoring as a main farmer feature, next to
booking a spray, with a simulated multispectral workflow for the demo:

- A farmer who draws a field boundary (optional) sees that field's crop
  health; a field without one invites the farmer to draw it.
- Farmers and staff (mitras, regional and organization admins) can draw
  boundaries and see crop health.
- Three layers: NDVI (vegetation), NDRE (chlorophyll) and NDMI (moisture).
- Results appear immediately with a short history of past passes.

**Conflicts with AGENTS.md, decided by the owner:** AGENTS.md describes MVP
crop monitoring as "team-only" and lists "farmer-facing crop reports" as
out of scope. ADR 0016 also left boundary drawing out of the MVP. The owner
has chosen to show crop health to farmers and to add minimal drawing. The
other AGENTS.md rules still apply: show observation date, source, cloud and
quality limits and data freshness, and do not present estimates as
diagnoses.

## Decision

- **Drawing (minimal):** tap corners in order, with undo and start again,
  and a live area. No vertex dragging, import or refinement (still V1).
  - `set_field_boundary(field, GeoJSON)` is SECURITY INVOKER, so the update
    runs under the existing `fields_update` RLS policy (the farmer themself,
    or staff who manage the farmer). The only new grant is UPDATE on
    `fields.boundary`.
  - The `check_field_boundary` trigger validates every boundary however it
    arrives: one simple ring, 0.05 to 1,000 acres, at most 100 corners,
    within 500 m of the field's pin. Moving the pin away from its boundary
    is rejected too. The screen checks the same limits while drawing.
- **Observations:** `field_observations`, one row per field, acquisition,
  source and processing version, with cloud cover, quality and the field
  means of NDVI, NDRE and NDMI (null on cloudy passes).
  - Read access follows the field: a row is visible when its field is.
  - No API writes. Updates are rejected by a trigger (append-only, AGENTS.md
    rule 14); rows go only when their field is deleted.
- **Simulated data:** when a field gets a boundary, a SECURITY DEFINER
  trigger adds the last eight passes on a 5-day Sentinel-2-like cadence,
  `source = 'simulated-demo'`, `processing_version = 'demo-sim-1'`.
  - Values are deterministic per field and date. Each field follows one of
    three trends (improving, steady, declining), one pass is cloudy, and the
    rest have light or partial cloud.
  - Redrawing only adds missing passes; history is never rewritten.
  - The per-pixel heatmap is generated in code (`simulatedIndexGrid`) from
    the pass's field mean, clipped to the boundary. No rasters are stored.
- **Screens:**
  - **Farmer dashboard:** a Crop health section after the hero, one card per
    active field: an NDVI thumbnail (SVG, no map library), a health label, the
    pass date and age, a trend line, and a "Demo data" badge. Fields without a
    boundary get a "Draw boundary" card.
  - **Field page** (`/dashboard/fields/[id]`): NDVI / NDRE / Moisture tabs
    (links, so they work without JavaScript), the index map over the street
    map (with the SVG as fallback), a legend, the source, cloud cover and
    processing version, notices when the latest pass was cloudy or the data
    is stale (over 12 days), a trend, and a table of passes.
  - **Boundary page** (`/dashboard/fields/[id]/boundary`): drawing, save and
    remove.
  - Links from My farm and the staff farmer page.
- **Labels:** health labels (Healthy / Needs a look / Stressed) use rough,
  crop-agnostic thresholds, and every screen says the data is simulated and
  that readings are estimates, not a diagnosis.

## Alternatives considered

- **Real Sentinel-2 now:** needs the Python worker, STAC access, cloud
  masking and object storage. Too much for the demo; the table and screens
  are shaped so the worker can add `sentinel-2-l2a` rows later.
- **Simulate in the browser only:** less work, but breaks the append-only
  time series model and would have to be replaced rather than extended.
- **Staged "processing" animation:** more theatrical, more moving parts.
  The owner chose results straight away.

## Consequences

- Simulated rows are generated in every environment where a boundary is
  drawn, including production. Before real farmers use it, the real worker
  must replace the trigger (a new migration drops it), and existing
  simulated rows must be hidden or deleted with the owner's approval.
- Stale data shows honestly: the readings stop at the day the boundary was
  saved, so a field drawn long ago shows a "data is N days old" notice.
- Thresholds are not crop- or stage-aware; tuning them is product work.
- ADR 0016's note that boundary drawing is out of the MVP is superseded for
  minimal drawing.
