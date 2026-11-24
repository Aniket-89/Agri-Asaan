# 0009. Farmers and fields

- Status: Accepted (owner approved the approach on 2026-11-24)
- Date: 2026-11-24

## Context

The demo flow starts with fields to spray. Phone OTP is deferred, so farmers
can't easily sign in themselves yet. In the field, mitras and admins
register farmers and their land.

## Decision

- **Farmers are tenant records**, not memberships. A mitra or admin creates
  them.
  - `profile_id` optionally links a record to a farmer login later. A
    trigger requires the linked member to have the farmer role.
  - Linking is not available through the API yet. It comes with OTP
    onboarding.
- **Minimal personal data:** name, Indian mobile number (10 digits, not
  unique because families share phones), and village.
  - Registration requires the farmer's consent, captured with a checkbox
    whose text names the tenant's brand.
  - `consent_recorded_at` and `registered_by` are set by a trigger from the
    server clock and the caller, never from client input.
- **Idempotent registration:** the form carries an id generated when it is
  rendered. A retried submission hits the primary key, and the service
  returns the existing farmer instead of creating a duplicate.
- **Access follows territory** (`can_manage_farmers_in_village`):
  - org admins see the whole tenant
  - regional admins see their regions
  - mitras see their villages
  - a linked farmer sees only their own record and fields
  - pilots see nothing until bookings assign them jobs

  Anyone who can see a farmer row can read its phone; that set is exactly
  the people who need to call the farmer. Only org admins delete.

- **Fields** belong to a farmer, and their village is the farmer's village.
  - Each field has a name (unique per farmer), a crop from the tenant crop
    list, and an area in acres (positive, two decimals).
  - A **required** GPS pin, with a generated
    `geography(Point, 4326)` column and GiST index.
  - An optional `geography(Polygon, 4326)` boundary for satellite work. It
    can't be written through the API; it's set via seed or demo workflow for
    the MVP.
- **Crop list:** `tenant_crops` is per-tenant configuration with English and
  Hindi names, managed by org admins. There's no UI yet; the list is seeded.
- **Column limits:** column-level grants keep tenant, ownership, link,
  consent, and geometry columns out of client inserts and updates.
- **Search:** three or more digits search the phone number; anything else
  searches the name (trigram index, wildcards escaped). Results are capped
  at 50.

## Alternatives considered

- **Farmers as auth users from day one:** every farmer would need a login
  before OTP exists, and it would couple farmer records to membership
  consent (ADR 0007).
- **A separate village on fields:** more flexible, but bookings and access
  would follow two different village links. Deferred until a real case
  (land in another village) needs it.
- **A map pin picker now (MapLibre):** a heavy dependency, and tile hosting
  needs a decision. GPS and manual coordinates cover the MVP. The map
  arrives with the boundary work.

## Consequences

- Bookings must snapshot crop and acreage from `fields` at booking time
  (AGENTS.md principle 8).
- Pilot access to farmers and fields arrives with job assignment.
- Exact GPS pins are personal data: they are never logged and never sent to
  third-party map links.
