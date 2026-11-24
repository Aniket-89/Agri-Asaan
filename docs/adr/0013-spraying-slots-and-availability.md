# 0013. Spraying slots and availability-aware booking

- Status: Accepted (owner decision, 2026-11-24)
- Date: 2026-11-24

## Context

AGENTS.md describes assignment "for a date and slot". The owner decided:

1. Slots are defined per organization (named, with times).
2. **Farmers and mitras see available slots before booking.**
3. A pilot and a drone each do at most one booking per slot.

For availability to mean anything, a booking has to reserve its slot,
otherwise "available" is only a guess.

## Decision

- **`spray_slots` (tenant-owned configuration):**
  - English and Hindi name, start and end time (local time in the
    organization's timezone), sort order, active flag.
  - Managed by org admins on the "Spraying slots" page.
  - Slot times are **fixed once created**, because bookings reserve them.
    To change a time, add a slot and deactivate the old one. Slots are never
    deleted.
- **Bookings reserve a slot:** `bookings.slot_id` (composite tenant
  foreign key). Bookings made before slots existed keep `slot_id` NULL.
- **Capacity** for a region, date, and slot (`slot_remaining_capacity`):
  - min(available pilots homed in the region, active drones homed in the
    region)
  - minus open bookings (requested, confirmed, assigned, in progress)
    already holding that region, date, and slot
  - unavailable pilots and drones in maintenance or retired don't count
- **`list_slot_availability(farmer, date)`:**
  - returns the organization's active slots with the places left in the
    farmer's region
  - only for callers who may book for that farmer (`can_book_for_farmer`)
  - slots that already started today show 0
- **`create_booking` now takes a slot:**
  - rejects inactive, other-organization, or already-started slots
    (`invalid_slot`)
  - takes a per (region, date, slot) advisory lock and re-checks capacity
    (`slot_full`), so the last place can't be taken twice
- **UI (booking form):**
  1. Pick a date with a plain GET form, which works without JavaScript.
  2. See each slot with "N left" or "Full". Full slots are disabled.
  3. Pick fields and submit.
- **Timezone:** dates and "already started" use the organization's timezone
  (`organization_settings.timezone`, default Asia/Kolkata).

## Alternatives considered

- **Fixed global slots in code:** rejected. Client differences belong in
  configuration (AGENTS.md principle 4).
- **Free start/end times:** slower to use on a phone, and harder to show
  availability for.
- **Show availability without reserving:** the shown capacity would be
  meaningless under concurrent bookings.
- **Capacity across regions:** pilots and drones can be borrowed at
  assignment, but booking capacity counts home-region resources only, to
  stay predictable.

## Consequences

- **Assignment** (next) will assign a specific pilot and drone for the
  booking's date and slot (changeable by the admin), with an exclusion
  constraint so the same pilot or drone is never in overlapping slots.
- **Capacity depends on fleet data:** marking a pilot unavailable or a drone
  in maintenance reduces future availability. Already-reserved bookings
  are not cancelled automatically; admins will see the shortfall at
  assignment.
- **Capacity counts are visible** to farmers and mitras (non-sensitive).
