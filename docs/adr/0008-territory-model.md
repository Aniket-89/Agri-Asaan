# 0008. Territory: regions, villages, and coverage

- Status: Accepted (owner approved the defaults on 2026-11-21)
- Date: 2026-11-21

## Context

Fields belong to villages. Bookings route to the regional admin responsible
for a village. Mitras work in specific villages. Before this change, regional
admins and mitras were tenant-wide roles with no geography.

## Decision

- **Region:** an area the business draws itself (a name), not an official
  district or block. That works for private operators, FPOs, and
  government-linked customers alike.
- **Village:** belongs to exactly one region. Optional official LGD village
  code, unique per tenant. Optional latitude/longitude, with a generated
  PostGIS `geography(Point, 4326)` column and a GiST index for later spatial
  queries.
- **Regional admin:** covers one or more regions (`regional_admin_regions`).
- **Mitra:** covers one or more villages, and a village can have several
  mitras (`mitra_villages`).
- **Tenant safety:** composite foreign keys on `(tenant_id, …)` stop any row
  from referencing another tenant's region, village, or member.
- **Role checks:** a trigger checks the assigned member's role. Access
  helpers (`can_manage_region`, `can_manage_village`,
  `is_mitra_for_village`) re-check the current role, so a changed role stops
  granting territory rights at once.
- **Permissions:**
  - Every tenant member can read regions and villages. This is non-sensitive
    reference data needed to pick a village.
  - Org admins manage regions and regional admin assignments.
  - Org admins, and regional admins within their own regions, manage
    villages and mitra assignments.
  - Assignment rows are visible to their managers and to the assigned person.
- **Editing:** assignments are only created or deleted, never edited.
  Villages can't change tenant, and the generated location is never written.

## Alternatives considered

- **Official hierarchy (state → district → block → village):** accurate,
  but it forces one administrative model on every customer and needs a large
  reference import. LGD codes keep the link available without the import.
- **Named "village cluster" entity:** one more concept to manage. A mitra's
  set of villages already is their cluster.
- **Storing only a PostGIS column:** harder to write through the REST API.
  Lat/lng columns with a generated geography keep writes simple and the
  spatial type correct.

## Consequences

- Narrowing a regional admin's member list to their regions, and mitra access
  to farmer phones, wait for the farmers feature, which links people to
  villages.
- Village boundaries are not modelled. Field boundaries come with the
  satellite work.
- The admin screen is `/[lang]/dashboard/territory`. Village pins are entered
  as numbers until the MapLibre field map exists.
