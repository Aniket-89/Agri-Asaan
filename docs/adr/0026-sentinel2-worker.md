# 0026. Real Sentinel-2 crop monitoring: the satellite worker

- Status: Accepted (owner decisions, 2026-11-27)
- Date: 2026-11-27
- Supersedes: the simulated data in ADR 0025

## Context

ADR 0025 built crop monitoring on simulated data. The owner asked for real
satellite imagery, and decided:

1. **Host:** GitHub Actions on a schedule, with a manual "run now".
2. **Database access:** a dedicated, limited Postgres role, not the
   service-role key.
3. **Pixels:** real per-pixel maps in a private Storage bucket.
4. **Simulation:** stop it and delete the simulated rows.

AGENTS.md requires an ADR for worker hosting and significant dependencies.

## Decision

- **Data:** Sentinel-2 L2A from **Earth Search v1** (Element 84's public
  STAC catalogue of the AWS open data copy). No account or key. Bands: B04
  red and B08 NIR (10 m), B05 red edge and B11 SWIR (20 m, resampled to the
  10 m grid), and the SCL scene classification (20 m) for cloud masking.
  Reflectance = DN × scale + offset from each asset's `raster:bands`
  (processing baseline 04.00 and later carry an offset).
- **Processing** (`services/worker`, Python 3.12):
  - For each active field with a boundary, find passes since the last stored
    one; a new boundary gets the last 60 days (`BACKFILL_DAYS`).
  - Read only the window around the field from the cloud-optimised GeoTIFFs.
  - Clear pixels are SCL vegetation, bare soil, water and unclassified;
    everything else (cloud, shadow, cirrus, snow, no data) is masked.
  - The cloud share is measured over the field's own pixels: 60% or more (or
    fewer than 3 clear pixels) is `cloudy` with no values; 20% or more is
    `partly_cloudy`; otherwise `good`.
  - NDVI, NDRE and NDMI means use clear pixels at least half inside the
    boundary.
  - Each pass stores one `field_observations` row (source
    `sentinel-2-l2a`, processing version `s2-l2a-v1`) and, unless cloudy,
    a pixel file: every 10 m pixel clipped to the boundary, in lng/lat, with
    its three values (null where masked). About 25 KB for a 3.5-acre field.
  - Neighbouring tiles of one acquisition are stored once. One failing field
    is recorded in `field_scan_status` and never stops the others. Farmers
    can read that table, so it stores only a fixed category (such as
    `storage_failed`); the full error stays in the worker log. Logs carry
    field ids, never coordinates.
- **Running:** `.github/workflows/crop-scan.yml` builds the worker image and
  runs one scan every 3 hours (minute 17) and on demand. The run is skipped
  until its secrets exist. CI checks the worker (ruff, mypy, pytest) and
  builds the image on every pull request. No Docker Compose or Redis: the
  worker is a one-shot job, not a service.
- **Database access:** the `crop_worker` role, created without login. An
  operator enables login with a password on each hosted project. Its column
  grants and policies allow only:
  - reading id, tenant and boundary of active fields that have one
  - inserting Sentinel-2 observations for those fields (and reading them)
  - writing `field_scan_status`

  It cannot read farmers, names, phones, bookings or users, change or delete
  observations, change boundaries, or use the Storage tables. It works across
  tenants by design: it is a system process that sees only geometry.

- **Storage:** the private `field-rasters` bucket, paths
  `<tenant>/<field>/<UTC time>-s2-l2a-v1.json`. Users can read a file only
  when they can read its field. The worker uploads with a Storage S3 access
  key, because Storage does not accept a database login. That key can reach
  every bucket (including brand assets), but no database table. It lives
  only in GitHub secrets.
- **App:** the dashboard card and field page draw the real pixels (grey
  where masked) and show the source, processing version, cloud share and
  age. A field waiting for its first scan says so, with the last check time.
- **Simulation removed:** the trigger is dropped, simulated rows are deleted,
  and the source check now accepts only `sentinel-2-l2a`.

## Alternatives considered

- **Microsoft Planetary Computer:** the same imagery, but asset URLs must be
  signed with short-lived tokens. Earth Search needs nothing.
- **Always-on host (Fly.io, Render):** results within minutes instead of
  hours, but a new account, secret store and cost. Revisit if farmers need
  near-instant first results.
- **Service-role key for the worker:** simpler, but a leak would expose
  every table and bypass RLS.
- **Field averages only:** no Storage key needed, but the map would not be
  real.

## Consequences

- **Delay:** a new boundary shows "waiting" until the next run, at most
  about 3 hours (GitHub may delay scheduled runs at busy times). Passes
  arrive every few days (three Sentinel-2 satellites), usually within a day
  of acquisition.
- **Resolution:** 10 m pixels (about 40 per acre); small fields look blocky,
  and edge pixels mix in roads or neighbours.
- **Clouds:** the monsoon months will have many cloudy passes; screens say
  so rather than guessing.
- **Thresholds:** health labels still use ADR 0025's rough, crop-agnostic
  thresholds.
- **Operations:** if the scan fails for every field the workflow fails and
  GitHub emails the repository owner. Scheduled workflows are paused after
  60 days without repository activity.
- **Manual setup per hosted project:** the `crop_worker` password, a Storage
  S3 key, and the GitHub secrets and variables.
