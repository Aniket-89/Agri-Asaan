# 0023. Regions cover districts and tehsils, from the official LGD list

- Status: Accepted (owner decision, 2026-11-28)
- Date: 2026-11-28

## Context

ADR 0021 put farmers into regions by pincode. The service is really organised
by district and tehsil (Mathura and the tehsils around it), and pincodes do
not line up with those boundaries. Names typed by farmers would not match
reliably ("Mathura", "मथुरा", "Mathra").

## Decision

- **Official place list.** Global lookup tables `geo_states`,
  `geo_districts`, `geo_subdistricts` hold Local Government Directory (LGD)
  codes and names. They start with the owner's states: Uttar Pradesh,
  Madhya Pradesh, Himachal Pradesh and Uttarakhand (155 districts, 1,117
  tehsils). The data comes from the daily LGD mirror at
  ramseraph.github.io/opendata/lgd (sha256 checked against its metadata) and
  is loaded by a migration generated with `supabase/scripts/lgd_to_sql.py`.
  These tables are public reference data: readable by anyone, written only by
  migrations. Adding states is a new generated migration.
- **Region coverage.** `region_districts` and `region_subdistricts` (one
  region per district or tehsil within an organization), managed by
  organization admins on the Territory page. A tehsil entry wins over its
  district's entry, so one tehsil can sit in a different region.
- **Sign-up.** The farmer picks district then tehsil (all tehsils grouped by
  district without JavaScript), plus village or town, address and pincode.
  `region_for_subdistrict` gives the region; the pincode stays part of the
  address only.
- **Uncovered places** (owner choice): the farmer still registers and waits;
  adding their district or tehsil to a region moves waiting farmers in.
- **Pincode coverage is removed** (`region_pincodes` dropped). Farmers keep
  the region they already had; the farmer location check still accepts older
  pincode-only addresses.
- The pilot job address and farmer pages show tehsil and district.

## Alternatives considered

- **All of India now** (~7,000 tehsils): more data on every sign-up page
  for no current benefit.
- **Admins type place names:** names outside covered areas would not match.
- **Pincode-to-district lookup:** the postal directory's taluk names are not
  LGD tehsils, and it adds another dataset.

## Consequences

- The sign-up page sends the four states' place list (about 1,300 names).
  Adding many more states would call for loading tehsils per district.
- LGD codes change rarely; a refresh is a new generated migration.
- Removing coverage does not move farmers out of a region.
