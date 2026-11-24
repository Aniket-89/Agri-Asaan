# 0014. Pilot and drone assignment

- Status: Accepted (owner decision, 2026-11-24)
- Date: 2026-11-24

## Context

AGENTS.md: a regional admin "assigns a Pilot and a company Drone (identified
by UID) for a date and slot", with "no double-booking of a pilot or drone"
enforced by the database, modelling actual time ranges if slots can overlap.
Slots are organization-defined (ADR 0013), so two slots can overlap.

The owner decided:

1. **Who assigns:** the regional admin of the booking's region, and
   organization admins.
2. **Borrowing:** pilots and drones from other regions of the same
   organization may be assigned, listed after the home region's.
3. **No pilot acceptance step:** an assignment is final; the admin can
   reassign.

## Decision

- **`booking_assignments`** holds one row per assignment:
  - booking, pilot, and drone (composite tenant foreign keys)
  - `work_period`: the booking's date and slot as a `tstzrange` in the
    organization's timezone
  - `is_current`, `assigned_by`, `assigned_at`, `ended_at`
  - at most one current row per booking (partial unique index); ended rows
    are kept as history
- **Double-booking is impossible at the database level:**
  - two exclusion constraints (btree_gist): the same pilot, or the same
    drone, can't have two current assignments with overlapping
    `work_period`
  - these hold across organizations, because one person or airframe can't be
    in two places at once
- **`assign_booking`** is the only write path:
  - checks the caller manages the booking's region
  - allows confirmed → assigned, and reassignment while assigned
  - rejects slots that have ended, unavailable or other-organization pilots,
    and drones that aren't active
  - turns an exclusion violation into `pilot_busy` / `drone_busy`
  - writes status history (a reassignment shows as assigned → assigned)
  - submitting the current pair again is a no-op
- **Cancelling:** `set_booking_status` adds assigned → cancelled for region
  managers, which ends the assignment and frees the pilot and drone.
- **Pilots:**
  - `can_view_booking` includes the currently assigned pilot
  - `list_my_jobs` returns what the pilot needs on the ground (date, slot,
    farmer name and phone, village, drone, fields with pins) without opening
    up the farmers table
- **UI:**
  - the booking page has a "Pilot and drone" section for region managers,
    with dropdowns of free pilots and drones
  - pilots get a "My jobs" page

## Alternatives considered

- **Assignment columns on `bookings`:** loses reassignment history and mixes
  workflow state with request facts.
- **Unique (pilot, date, slot) instead of time ranges:** misses overlapping
  slots with different ids.
- **Pilot accept/decline:** deferred by the owner; can be added as an extra
  status later.

## Consequences

- Pilots and drones with assignment history can't be deleted (deactivate
  them instead); removing a pilot's membership is blocked while history
  exists.
- Booking capacity (ADR 0013) still counts home-region resources only;
  borrowing at assignment doesn't change shown availability.
- Next: pilot start/complete with actual acres (`start_job`,
  `complete_job`) and admin verification.
