# 0024. A field's location decides which region serves it

- Status: Proposed. On hold by the owner until after the demo (2026-11-28).
- Date: 2026-11-28

## Context

A booking takes its region (and so its slots, pilots and drones) from the
farmer: their village, or the tehsil they registered with (ADR 0021, 0023).
Nothing checks where a field actually is. The owner registered a farmer in
Mathura, added a field in Delhi, and could book it against Mathura's
capacity. Delhi is not even in the place list. In real use this sends pilots
far outside their area, and fields of one farmer that are far apart end up in
one booking and one slot.

## Proposed decision

1. **Each field gets its tehsil and region from its map pin.**
   - Load official tehsil boundary polygons for the covered states (Uttar
     Pradesh, Madhya Pradesh, Himachal Pradesh, Uttarakhand) into PostGIS,
     from open Survey of India data (the same LGD/SOI mirror as ADR 0023),
     checksummed and generated into a migration.
   - When a field is saved, the database finds the tehsil containing its pin,
     then the region covering that tehsil (`region_for_subdistrict`).
   - A field outside every covered area is saved but marked "outside service
     area" and cannot be booked; organization admins see where that demand
     is, as with waiting farmers.
2. **Bookings follow the fields, not the farmer.**
   - All fields in one booking must be in the same region; the booking uses
     that region's slots, pilots and drones.
   - Fields in one booking must be within a maximum distance of each other
     (one trip, one slot). The limit is an organization setting; suggested
     default 10 km. Fields farther apart are booked separately.
3. **Later, optional: travel charge.** Fields inside a region but far from its
   villages could add a per-km charge to the amount due (ADR 0022).

## Alternatives considered

- **Service radius per region** (for example within 25 km of any of its
  villages): no new map data and quicker to build, but rough. Circles cross
  district lines and do not match the district/tehsil coverage of ADR 0023.
  Acceptable as a stopgap if boundary data is delayed.
- **Leave it to admins** to reject far-away bookings by hand: no code, but it
  relies on someone noticing, and capacity is already reserved in the wrong
  region by then.

## Open questions for the owner

- Boundaries or service radius for the first version.
- Maximum distance between fields in one booking (suggested 10 km).

## Consequences until this is built

- A field can be pinned anywhere, and a booking uses the farmer's region
  regardless of where its fields are.
- Admins should check field locations when confirming bookings.
