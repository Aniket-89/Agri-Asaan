# 0015. Job execution and verification

- Status: Accepted (owner decision, 2026-11-25)
- Date: 2026-11-25

## Context

AGENTS.md: "The pilot completes the job and records actual acres", followed
by "Admin verification", through transactional `start_job` and `complete_job`
functions that write status history.

The owner decided:

1. **Actual acres per field**, not one total. The value is the sprayed area
   from the drone's **mission plan**, which can be more than the farmer's
   recorded acreage (a 4-acre field may come out at 4.3).
2. **The pilot can start only on the job day.**
3. **The admin can verify, or send the job back** to the pilot with a
   required reason.

## Decision

- **`start_job(booking)`:**
  - only the currently assigned pilot (who still holds the pilot role) can
    call it
  - only on the booking's date, in the organization's timezone
  - assigned → in progress, records `started_at`
- **`complete_job(booking, field_ids[], acres[], notes)`:**
  - only the assigned pilot, and only while the job is in progress
  - needs one value for every booked field, each between 0 and **twice**
    that field's booked acres (the mission-plan area can exceed the recorded
    acreage; the 2× limit catches typos such as 43 for 4.3), and a total
    above 0. A job where nothing was sprayed is
    cancelled by an admin instead.
  - stores `booking_fields.actual_acres`, `bookings.actual_total_acres`, and
    the optional note
  - in progress → completed
- **Review**, through `set_booking_status` (region managers only):
  - completed → verified: records `verified_by` and `verified_at`
  - completed → in progress ("send back"): reason required. The pilot sees
    the reason and their previous acres as a starting point.
- **Integrity:**
  - a check constraint keeps actual acres within 2× the booked acres, even
    for direct writes
  - clients have no write grants on these columns
  - every step writes status history in the same transaction
- **UI:**
  - "My jobs" has **Today**, **Upcoming**, and **Completed** tabs (plain
    links, no JavaScript). Today holds today's jobs and any unfinished
    started job; Completed covers the last 60 days, newest first, with acres
    sprayed and whether it's still waiting for verification
  - **Start job** appears on the job day, and a per-field acres form once
    started
  - the booking page shows sprayed against booked acres with the
    difference (e.g. "Sprayed 4.3 acres · booked 4 acres (+0.3)") and the
    pilot's note, plus
    **Verify job** / **Send back to pilot** for region managers

## Alternatives considered

- **One total:** faster to enter, but loses which field was sprayed, which
  per-field satellite monitoring will need.
- **Start any time after assignment:** more flexible, but mistakes would
  start jobs days early. It can be relaxed later through configuration.
- **Verify only:** corrections would need a separate edit flow.

## Consequences

- Verified jobs are final: they can't be cancelled or edited.
- A job whose day passes without a start stays assigned and can no longer
  be started. An admin can cancel it (reassigning isn't possible once the
  slot has ended).
- A sent-back job stays on the pilot's list until it's completed again,
  whatever its date.
