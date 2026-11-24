# 0011. Bookings and status history

- Status: Accepted
- Date: 2026-11-24

## Context

Farmers book spraying for one or more fields, directly or through a mitra.
A regional admin reviews the request. AGENTS.md requires:

- transactional database functions for state changes, writing status history
  in the same transaction (principle 5)
- idempotent creates (principle 7)
- snapshots of field facts at booking time (principle 8)
- append-only history with the actor recorded (principle 9)

## Decision

- **Tables:** `bookings`, `booking_fields` (lines), and
  `booking_status_history`. Clients have `select` only. The only write paths
  are `create_booking` and `set_booking_status`.
- **Statuses:** `requested, confirmed, rejected, cancelled, assigned,
in_progress, completed, verified`. This release implements:

  | Change                | Who                                                                   |
  | --------------------- | --------------------------------------------------------------------- |
  | requested → confirmed | region manager (org admin, or regional admin of the booking's region) |
  | requested → rejected  | region manager, with a reason                                         |
  | requested → cancelled | region manager, the requester, or the farmer                          |
  | confirmed → cancelled | region manager                                                        |

  Everything else is rejected with `invalid_transition`. Assignment adds the
  rest.

- **Snapshots:**
  - The booking stores the farmer's village and its region at booking time,
    so routing stays with the original region's admin.
  - Each line copies the field name, crop (code plus English/Hindi names),
    acres, and pin. `total_acres` is the sum of the lines.
  - Later field edits do not rewrite bookings.
- **Integrity:**
  - Composite foreign keys `(tenant_id, booking_id, farmer_id)` and
    `(tenant_id, farmer_id, field_id)` guarantee that every line's field
    belongs to the booking's farmer.
  - A field can't be in two open bookings (requested, confirmed, assigned,
    or in progress). `create_booking` checks this while holding row locks
    on the fields, so concurrent requests can't both succeed.
- **Idempotency:** the booking id is generated when the form is rendered. A
  retry with the same id for the same farmer returns the existing booking;
  the same id for a different farmer fails with `23505`.
- **Preferred date:** from today to 60 days ahead, using the Asia/Kolkata
  calendar. The UI computes the same window. The time slot is chosen at
  assignment.
- **Visibility (`can_view_booking`):**
  - region managers
  - mitras of the booking's village
  - the requester, while still a member
  - the farmer's linked login

  Pilots see nothing until assignment.

- **History is append-only:** a trigger rejects `UPDATE` and `DELETE` on
  `booking_status_history`, even from privileged code.
- **Error contract:**
  - `42501`: not allowed
  - `P0002`: not found or not visible
  - `23505`: id reused
  - `23514` with a `HINT` naming the rule (`field_already_booked`,
    `date_out_of_range`, `reason_required`, `invalid_transition`, and so on)

  The app maps hints to translated messages.

- **Null safety:** permission checks compare with `IS NOT DISTINCT FROM` and
  `coalesce`. A NULL inside `IF NOT (…)` silently skips the raise. pgTAP
  caught this during development: a farmer could book for another farmer
  whose `profile_id` was NULL. There's a regression test for both
  functions.

## Alternatives considered

- **Direct table writes with RLS plus triggers:** spreads workflow rules
  across policies and triggers. AGENTS.md asks for narrow RPCs for state
  changes.
- **Partial unique index for "one open booking per field":** status lives on
  the booking, not the line, so it would need a denormalised status column
  kept in sync on every line. The locked check inside the function is
  simpler and transactional.
- **Choosing a time slot at booking time:** farmers and mitras state
  preferences; the operational slot depends on pilot and drone availability,
  so it belongs to assignment.

## Consequences

- Assignment will add `assigned`, `in_progress`, `completed`, and `verified`
  transitions in `set_booking_status` (or narrow companion functions), plus
  pilot/drone references and a double-booking exclusion constraint.
- Booking rows cannot be deleted. Corrections happen through cancellation,
  and history stays complete.
