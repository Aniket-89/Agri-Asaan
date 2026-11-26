# 0021. Farmers register by address; the pincode decides the region

- Status: Accepted (owner decision, 2026-11-27)
- Date: 2026-11-27

## Context

Farmer self-registration (ADR 0018) required choosing a listed village. The
service actually covers areas (for example Mathura and every village around
it), and the village list is never complete, so farmers from unlisted
villages could not register. The owner wants registration never to be
blocked: farmers give an address specific enough for the team, the region
follows from the pincode, and pilots are hired where demand appears.

## Decision

- **Every self-registering farmer gives an address:** pincode, village or
  town name, and house/street/landmark. Choosing a listed village is
  optional; if chosen, the farmer is placed at once.
- **Regions list the pincodes they serve** (`region_pincodes`, one region per
  pincode within an organization). Organization admins manage the list on
  the Territory page; a region's admins can see it.
- **The pincode sets the farmer's region** at registration. Adding a pincode
  to a region later assigns farmers waiting with that pincode.
- **Farmers can exist without a village** (`farmers.village_id` nullable,
  with a check that a farmer has either a village or a full address).
  `farmers.region_id` is stored for every farmer and always equals the
  village's region once placed.
- **Visibility** (`can_manage_farmer_location`):
  - placed in a village: unchanged (region managers and the village's mitras)
  - region but no village: that region's admins and the organization admin
  - no region ("outside service area"): organization admins only
- **Booking works from the region** (owner choice): a farmer with a region can
  book right away; capacity comes from that region. Bookings may have no
  village. A farmer with no region sees no available places, and
  `create_booking` refuses with `no_service_area`.
- **Placement:** a regional admin (or organization admin) places the farmer
  in a village of the farmer's region from the farmer page. Open bookings
  made before placement move into the village, so its mitras see them.
- **Pilot job list** shows the farmer's address when a booking has no
  village.
- Farmers registered by mitras and admins still choose a village.

## Alternatives considered

- **Village request queue** (farmer waits until an admin adds the village):
  blocks booking; rejected by the owner.
- **Block registration outside the service area:** rejected by the owner;
  those farmers are kept for when the area is covered.
- **Pincode lookup through an external API:** adds a dependency and sends
  farmer input to a third party; admins map pincodes instead.

## Consequences

- Admins have a "Need a village" list to work through.
- **Farmers add and edit their own fields** (`is_own_farmer`, same branch), so
  a self-registered farmer can book without waiting for staff. Deleting
  fields and drawing boundaries stay with staff. Every farmer is capped at 50
  active fields so an open sign-up cannot fill the table.
- Hosted environments need region pincodes before address registrations land
  in a region.
- **Superseded in part by ADR 0023:** regions now cover districts and tehsils;
  the pincode no longer decides the region.
