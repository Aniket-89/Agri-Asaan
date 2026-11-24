# 0010. Pilots and drones (fleet registry)

- Status: Accepted (owner chose to build this before bookings, 2026-11-24)
- Date: 2026-11-24

## Context

Regional admins assign a pilot and a company drone to each confirmed job.
Assignment and double-booking prevention depend on bookings, but the fleet
itself only depends on territory. The owner asked for the fleet first.

## Decision

- **`drones`:**
  - Fields: a UID (the identifier on or registered for the airframe, such as
    a DGCA UIN; letters, digits, and hyphens; stored upper-case), a model,
    an optional home region, and a status (`active`, `maintenance`,
    `retired`).
  - UIDs are unique **per tenant**, not globally, so one tenant can't probe
    another tenant's registrations through unique-constraint errors.
  - Ownership and leasing are out of MVP scope (AGENTS.md section 13).
- **`pilot_profiles`:** one per pilot member, keyed by
  `(tenant_id, user_id)`.
  - Fields: an optional home region, an optional DGCA remote pilot
    certificate number, and an availability flag (`is_active`).
  - A trigger requires the member to have the `pilot` role.
  - Pilots remain logins (memberships), so they can see their jobs later.
- **Access:**
  - Org admins manage the whole fleet.
  - Regional admins can **see** the whole tenant fleet, because borrowing a
    drone across regions is normal, but can only **change** items homed in
    regions they manage (`can_manage_fleet_item`). Items with no home
    region are org-admin only.
  - A pilot sees their own profile.
  - Mitras and farmers see nothing.
  - Only org admins delete.
- **Column grants:** tenant and identity columns can't change through the
  API.
- **Screen:** a translated **Pilots & drones** page at
  `/[lang]/dashboard/fleet`, linked from the dashboard for admins.
  - Drones: list, add, and status changes.
  - Pilots: list, "create profile" for pilot members without one, and an
    availability toggle.

## Alternatives considered

- **Pilot coverage across many regions (many-to-many):** more flexible, but
  one home region covers the MVP. Assignment can still choose a pilot from
  another region.
- **Global drone UID uniqueness:** matches real-world registration, but
  leaks cross-tenant information. Per-tenant uniqueness is enough
  operationally.

## Consequences

- New pilot _accounts_ still need the member-management flow, which is part
  of the paused tenant work. The seed provides a second pilot without a
  profile for the demo.
- Assignment (next to bookings) will add pilot and drone references on jobs,
  plus a database exclusion constraint against double-booking. Pilots will
  then see the farmers, fields, and drones of their assigned jobs.
- Pages that stream a 404 after the static shell (when the role check fails)
  answer with HTTP 200 and render the not-found UI. No data is rendered, and
  RLS returns nothing either way.
