# Data model

Current schema: the identity, tenancy, and platform foundation, territory
(ADR 0008), farmers and fields (ADR 0009), the fleet (ADR 0010), bookings with
append-only status history (ADR 0011), pilot invites (ADR 0012), and spraying
slots with availability-aware booking (ADR 0013), and pilot and drone
assignment (ADR 0014), and job execution and verification (ADR 0015).
Satellite observations are not built yet.

> **Known gap (ADR 0007):** tenant admins can add existing accounts to their
> tenant without the person's consent. Fake data only until this is fixed.

## Territory

```mermaid
erDiagram
  organizations ||--o{ regions : "tenant_id"
  regions ||--o{ villages : "(tenant_id, region_id)"
  regions ||--o{ regional_admin_regions : "(tenant_id, region_id)"
  villages ||--o{ mitra_villages : "(tenant_id, village_id)"
  organization_members ||--o{ regional_admin_regions : "(tenant_id, user_id), role regional_admin"
  organization_members ||--o{ mitra_villages : "(tenant_id, user_id), role mitra"

  regions {
    uuid id PK
    uuid tenant_id FK
    text name "unique per tenant, case-insensitive"
    boolean is_active
  }
  villages {
    uuid id PK
    uuid tenant_id FK
    uuid region_id FK
    text name "unique per region"
    text lgd_code "optional, unique per tenant"
    numeric latitude
    numeric longitude
    geography location "generated, Point SRID 4326, GiST"
  }
```

| Table                    | Read                                                        | Write                                                             |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `regions`                | All tenant members.                                         | Org admin.                                                        |
| `villages`               | All tenant members.                                         | Org admin; regional admin in their regions (`can_manage_region`). |
| `regional_admin_regions` | Org admin; the assigned regional admin.                     | Org admin (insert/delete only).                                   |
| `mitra_villages`         | Region managers (`can_manage_village`); the assigned mitra. | Region managers (insert/delete only).                             |

All four tables are tenant-owned, with composite foreign keys that make
cross-tenant references impossible. A trigger checks the assigned member's
role. Access helpers re-check the current role, so a role change revokes
territory rights immediately.

## Entity relationship diagram

```mermaid
erDiagram
  auth_users ||--|| profiles : "id"
  profiles ||--o{ organization_members : "user_id"
  profiles ||--o| platform_staff : "user_id"
  profiles ||--o{ platform_audit_log : "actor_id"
  organizations ||--o{ organization_members : "tenant_id = organization_id"
  organizations ||--|| organization_settings : "tenant_id"
  organizations ||--o{ organization_features : "tenant_id"
  organizations ||--o{ organization_domains : "tenant_id"

  profiles {
    uuid id PK "= auth.users.id"
    text full_name
    text phone "restricted, see ADR 0004"
  }
  organizations {
    uuid id PK "tenant boundary"
    text name
    text slug UK
    organization_type organization_type "platform-controlled"
    boolean is_active "platform-controlled"
    uuid created_by FK
  }
  organization_members {
    uuid tenant_id FK
    uuid organization_id FK "check: = tenant_id"
    uuid user_id FK
    organization_role role
  }
  organization_settings {
    uuid tenant_id PK
    text default_locale "en | hi"
    text timezone
    text brand_name
    text brand_primary_color "#RRGGBB"
    text brand_accent_color "#RRGGBB"
    text brand_tagline "max 120 chars"
    text brand_logo_path "tenant_id/file.png|webp|jpg"
  }
  organization_features {
    uuid tenant_id PK
    text feature_key PK
  }
  organization_domains {
    uuid tenant_id PK
    text hostname PK "globally unique"
    boolean is_verified "platform-controlled"
    boolean is_primary
  }
  platform_staff {
    uuid id PK
    uuid user_id UK
    platform_role role
    platform_staff_status status
  }
  platform_audit_log {
    bigint id PK
    timestamptz occurred_at
    uuid actor_id FK
    platform_role actor_platform_role
    text action
    uuid target_tenant_id "no FK, survives deletion"
    jsonb details "changed column names only"
  }
```

## Tenant-owned vs global tables

| Table                   | Ownership     | Notes                                                                                                       |
| ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `organizations`         | Tenant record | One organization = one tenant in the MVP.                                                                   |
| `organization_members`  | Tenant-owned  | `tenant_id = organization_id` check enables tenant-consistent composite FKs later.                          |
| `organization_settings` | Tenant-owned  | One row per tenant, created by provisioning.                                                                |
| `organization_features` | Tenant-owned  | Presentation and availability only. Never an authorization control.                                         |
| `organization_domains`  | Tenant-owned  | Hostnames are globally unique. Verification is platform-only.                                               |
| `profiles`              | **Global**    | Identity is shared across tenants. Visibility comes from shared membership (`profiles_share_organization`). |
| `platform_staff`        | **Global**    | Platform roles, separate from tenant roles (ADR 0001).                                                      |
| `platform_audit_log`    | **Global**    | Append-only platform audit trail (ADR 0005). Not tenant-owned; references tenants by ID without an FK.      |

## Roles

- **Organization roles** (`organization_role`): `organization_admin`,
  `regional_admin`, `mitra`, `farmer`, `pilot`. The legacy `super_admin` and
  `admin` values are blocked by a constraint (ADR 0002).
- **Platform roles** (`platform_role`): `platform_owner`, `system_admin`,
  `developer`, `support`.

## Access summary

| Table                   | Read                                                                            | Write                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `profiles`              | Self and members of a shared tenant (name only). Phone via `get_profile_phone`. | Self: `full_name` only.                                                                                              |
| `organizations`         | Members; platform owner/system admin.                                           | Org admin: name. Platform staff: everything. Trigger blocks tenant changes to type, status, slug, and audit columns. |
| `organization_members`  | Self; org/regional admins of the tenant; platform owner/system admin.           | `add_organization_member` RPC. Org admin updates/deletes others. Regional admin: operational roles only.             |
| `organization_settings` | Members; platform owner/system admin.                                           | Org admin and platform staff: update.                                                                                |
| `organization_features` | Members; platform owner/system admin.                                           | Org admin; platform staff.                                                                                           |
| `organization_domains`  | Members; platform owner/system admin.                                           | Org admin: insert unverified, delete. Platform staff: everything.                                                    |
| `platform_staff`        | Self; platform owner/system admin.                                              | `manage_platform_staff` RPC. Only an owner can grant or modify `platform_owner`.                                     |
| `platform_audit_log`    | Platform owner/system admin.                                                    | Nobody directly. Written only by audit triggers and `log_platform_tenant_access`.                                    |

## Functions

| Function                                                                             | Executable by                                  | Purpose                                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `is_organization_member`, `has_organization_role`, `profiles_share_organization`     | authenticated                                  | RLS helpers.                                                                  |
| `is_platform_role`, `is_platform_owner`, `is_system_admin`, `is_platform_staff`      | authenticated                                  | Platform RLS helpers.                                                         |
| `add_organization_member`                                                            | authenticated                                  | Role-checked membership creation.                                             |
| `provision_customer_organization`                                                    | authenticated (owner/system admin enforced)    | Creates organization, settings, first admin, and features in one transaction. |
| `manage_platform_staff`                                                              | authenticated (owner/system admin enforced)    | Staff role and status changes.                                                |
| `bootstrap_platform_owner`                                                           | database administrators only                   | One-time first owner.                                                         |
| `get_profile_phone`                                                                  | authenticated                                  | Phone visibility rules (ADR 0004).                                            |
| `get_public_branding`                                                                | anon, authenticated                            | Brand for a verified hostname (ADR 0003).                                     |
| `log_platform_tenant_access`                                                         | authenticated (active platform staff enforced) | Records a platform staff view of a tenant (ADR 0005).                         |
| `write_platform_audit`, `audit_platform_tenant_write`, `audit_platform_staff_change` | nobody (triggers only)                         | Audit writers.                                                                |
| `protect_platform_controlled_organization_fields`                                    | nobody (trigger only)                          | Blocks tenant changes to type, status, slug, and audit columns.               |

Every `SECURITY DEFINER` function uses `set search_path = ''` and has
`execute` revoked from `public`, plus from `anon` unless listed.

## Storage

| Bucket         | Public     | Contents                                                              | Write access                                                       |
| -------------- | ---------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `brand-assets` | Yes (read) | Tenant logos at `<tenant_id>/<file>`. PNG, WebP, or JPEG, max 512 KB. | Platform owner and system admin only (`storage.objects` policies). |

## Farmers and fields

```mermaid
erDiagram
  villages ||--o{ farmers : "(tenant_id, village_id)"
  organization_members ||--o| farmers : "(tenant_id, profile_id), farmer role, optional"
  farmers ||--o{ fields : "(tenant_id, farmer_id)"
  tenant_crops ||--o{ fields : "(tenant_id, crop_id)"

  farmers {
    uuid id PK "client-generated for idempotent registration"
    uuid tenant_id FK
    uuid village_id FK
    text full_name
    text phone "10-digit Indian mobile, personal data"
    uuid profile_id FK "optional login link"
    timestamptz consent_recorded_at "server clock"
    uuid registered_by FK "caller, set by trigger"
  }
  fields {
    uuid id PK
    uuid farmer_id FK
    text name "unique per farmer"
    uuid crop_id FK
    numeric area_acres "positive, 2 decimals"
    numeric latitude "required"
    numeric longitude "required"
    geography location "generated Point 4326, GiST"
    geography boundary "optional Polygon 4326, GiST"
  }
  tenant_crops {
    uuid id PK
    text code "unique per tenant"
    text name_en
    text name_hi
  }
```

| Table          | Read                                                                                                | Write                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `tenant_crops` | All tenant members.                                                                                 | Org admin.                                                              |
| `farmers`      | Org admin (tenant); regional admin (their regions); mitra (their villages); a linked farmer (self). | Insert/update: the same managers within their scope. Delete: org admin. |
| `fields`       | Anyone who can view the farmer (`can_view_farmer`).                                                 | Farmer managers (`can_manage_farmer`).                                  |

Column grants keep `tenant_id`, `profile_id`, `registered_by`, `boundary`,
and generated columns out of client writes. `consent_recorded_at` and
`registered_by` are stamped by a trigger.

## Fleet: drones and pilot profiles

```mermaid
erDiagram
  regions ||--o{ drones : "(tenant_id, home_region_id), optional"
  regions ||--o{ pilot_profiles : "(tenant_id, home_region_id), optional"
  organization_members ||--o| pilot_profiles : "(tenant_id, user_id), pilot role"

  drones {
    uuid id PK
    uuid tenant_id FK
    text uid "upper-case, unique per tenant"
    text model
    uuid home_region_id FK
    drone_status status "active | maintenance | retired"
  }
  pilot_profiles {
    uuid tenant_id PK
    uuid user_id PK
    uuid home_region_id FK
    text license_number "DGCA remote pilot certificate, optional"
    boolean is_active "availability"
  }
```

| Table            | Read                                                      | Write                                                                                                                                                                                                                                |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `drones`         | Org and regional admins (whole tenant, `can_view_fleet`). | Org admin; regional admin for items homed in their regions (`can_manage_fleet_item`). Delete: org admin.                                                                                                                             |
| `pilot_profiles` | Org and regional admins; the pilot (own profile).         | Insert: **no client insert at all**; profiles are created only by `provision_invited_pilot` after a regional admin's invite (ADR 0012). Update: same as drones. A trigger requires the pilot role; `created_by` records the inviter. |

## Bookings

```mermaid
erDiagram
  farmers ||--o{ bookings : "(tenant_id, farmer_id)"
  villages ||--o{ bookings : "village snapshot"
  regions ||--o{ bookings : "region snapshot, routing"
  bookings ||--|{ booking_fields : "(tenant_id, booking_id, farmer_id)"
  fields ||--o{ booking_fields : "(tenant_id, farmer_id, field_id)"
  bookings ||--o{ booking_status_history : "(tenant_id, booking_id), append-only"

  bookings {
    uuid id PK "client-generated, idempotent"
    uuid farmer_id FK
    uuid village_id FK "snapshot"
    uuid region_id FK "snapshot"
    booking_status status
    date preferred_date "today..+60 days, Asia/Kolkata"
    text notes "max 500"
    numeric total_acres "sum of lines"
    uuid requested_by FK
  }
  booking_fields {
    uuid booking_id PK
    uuid field_id PK
    text field_name "snapshot"
    text crop_code "snapshot"
    text crop_name_en "snapshot"
    text crop_name_hi "snapshot"
    numeric area_acres "snapshot"
    numeric latitude "snapshot"
    numeric longitude "snapshot"
  }
  booking_status_history {
    bigint id PK
    booking_status from_status
    booking_status to_status
    text reason
    uuid actor_id FK
  }
```

| Table                    | Read (`can_view_booking`)                                                                          | Write                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `bookings`               | Region managers; mitras of the village; the requester (while a member); the farmer's linked login. | Only `create_booking` / `set_booking_status`.                           |
| `booking_fields`         | Same as the booking.                                                                               | Only `create_booking`.                                                  |
| `booking_status_history` | Same as the booking.                                                                               | Only the booking functions. `UPDATE`/`DELETE` are blocked by a trigger. |

## Pilot invites (ADR 0012)

`pilot_invites` is tenant-owned and append-mostly. It records every invite
attempt: email, inviter, home region, status (`claimed`, `provisioned`,
`email_in_use`, `rate_limited`, `failed`, `expired`), and the resulting
account. A partial unique index allows only one open (`claimed`) claim per
email. It's readable by org admins (their tenant) and by each regional admin
(their own invites), and nobody writes it through the API.

| Function                                     | Executable by     | Purpose                                                                                              |
| -------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| `can_invite_pilot(region)`                   | authenticated     | Is the caller a regional admin assigned to the region?                                               |
| `claim_pilot_invite(...)`                    | service_role only | Per-email lock, rate limit, refuse existing accounts or open claims, record the attempt.             |
| `provision_invited_pilot(invite, user, ...)` | service_role only | Requires the open claim and a matching fresh account, then creates the pilot membership and profile. |
| `fail_pilot_invite(invite, reason)`          | service_role only | Releases a claim after a failure.                                                                    |
| `delete_orphaned_pilot_invite(...)`          | service_role only | Removes a failed invite's account only if it is a fresh orphan.                                      |

`add_organization_member` refuses the `pilot` role, members can't be
updated to `pilot`, and clients can't insert `pilot_profiles`. The invite
flow is the only way to create a pilot.

## Spraying slots and capacity (ADR 0013)

| Table / function                              | Notes                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `spray_slots`                                 | Tenant-owned: en/hi name, local start/end time, sort order, active flag. Members read; org admins insert, rename, and (de)activate. Times are immutable and slots are never deleted. |
| `bookings.slot_id`                            | The slot a booking reserves (composite tenant FK). NULL for pre-slot bookings.                                                                                                       |
| `slot_remaining_capacity(region, date, slot)` | Internal: min(available pilots, active drones) homed in the region, minus open bookings holding the slot.                                                                            |
| `list_slot_availability(farmer, date)`        | For callers who may book for the farmer: active slots with places left; already-started slots today show 0.                                                                          |
| `create_booking(..., slot, ...)`              | Reserves the slot; rejects invalid or started slots; re-checks capacity under a per (region, date, slot) advisory lock (`slot_full`).                                                |

## Assignment (ADR 0014)

| Table / function                        | Notes                                                                                                                                                                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking_assignments`                   | Tenant-owned: booking, pilot, drone, `work_period` (date + slot as `tstzrange` in the org timezone), `is_current`, `assigned_by`, `ended_at`. Read via `can_view_booking`; no client writes. One current row per booking; old rows are history. |
| Exclusion constraints                   | `booking_assignments_pilot_no_overlap` / `_drone_no_overlap`: GiST (btree_gist) on (pilot or drone `=`, `work_period &&`) where `is_current`. The database guarantee against double-booking.                                                    |
| `list_assignment_options(booking)`      | Region managers only: active pilots and drones of the organization free for the booking's slot, home region first (borrowing allowed).                                                                                                          |
| `assign_booking(booking, pilot, drone)` | Region managers only: confirmed → assigned, or reassign while assigned; writes status history. Hints: `invalid_transition`, `invalid_slot`, `slot_passed`, `pilot_unavailable`, `drone_unavailable`, `pilot_busy`, `drone_busy`.                |
| `set_booking_status`                    | Adds assigned → cancelled (region manager); cancelling ends the current assignment.                                                                                                                                                             |
| `list_my_jobs(tenant)`                  | The calling pilot's current jobs from today, with farmer contact, village, slot, drone, and booked fields.                                                                                                                                      |
| `can_view_booking`                      | Now also true for the currently assigned pilot.                                                                                                                                                                                                 |

Pilots and drones with assignment history cannot be deleted (foreign keys);
deactivate them instead.

## Job execution and verification (ADR 0015)

| Column / function                                | Notes                                                                                                                                                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking_fields.actual_acres`                    | Area actually sprayed, from the drone's mission plan; may exceed the booked `area_acres` (e.g. 4.3 on a 4-acre field), between 0 and 2× `area_acres` (check constraint, typo guard). Written only by `complete_job`.       |
| `bookings.started_at` / `completed_at`           | Set by `start_job` / `complete_job`; `completed_at` is cleared when a job is sent back.                                                                                                                                    |
| `bookings.actual_total_acres`                    | Sum of the per-field actual acres (> 0).                                                                                                                                                                                   |
| `bookings.completion_notes`                      | The pilot's optional note (≤ 500 characters).                                                                                                                                                                              |
| `bookings.verified_at` / `verified_by`           | Set when a region manager verifies.                                                                                                                                                                                        |
| `start_job(booking)`                             | The current assigned pilot only, on the job day (org timezone): assigned → in progress. Hints: `invalid_transition`, `not_job_day`.                                                                                        |
| `complete_job(booking, field_ids, acres, notes)` | The assigned pilot: in progress → completed, with a value for every booked field. Hints: `invalid_transition`, `invalid_acres`, `invalid_notes`.                                                                           |
| `set_booking_status`                             | Adds completed → verified and completed → in progress ("send back", reason required), region managers only.                                                                                                                |
| `list_my_jobs(tenant)`                           | Feeds the Today / Upcoming / Completed tabs: assigned jobs from today, every in-progress job (whatever its date), and completed or verified jobs from the last 60 days; with actual acres and the latest send-back reason. |

## Spatial data

PostGIS is enabled (`20261118180523_enable_postgis.sql`).

- `villages.location`: `geography(Point, 4326)`, generated from
  `latitude`/`longitude`, with GiST index `villages_location_gist`.
- `fields.location`: `geography(Point, 4326)`, generated from the required
  pin, with GiST index `fields_location_gist`.
- `fields.boundary`: optional `geography(Polygon, 4326)`, with GiST index
  `fields_boundary_gist`. Seed/demo only for the MVP.
- `boundary_geojson(fields)`: computed column (`select=boundary_geojson`) that
  returns the boundary as a GeoJSON Polygon for the web maps. Security
  invoker, so RLS on `fields` still decides what is visible (ADR 0016).

## Generated types

`apps/web/src/types/database.types.ts` is generated. After any migration, run
`npm run db:types` and commit the result. CI fails if it is out of date.
