# 0004. Member phone number visibility

- Status: Accepted (owner approved, 2026-11-21)
- Date: 2026-11-21

## Context

`profiles.phone` was readable by every member who shares an organization with
the profile. A farmer could read the phone numbers of administrators and of
every other farmer in the tenant. That's personal data exposure, and it
conflicts with the privacy principle in AGENTS.md.

RLS works on rows, not columns, so it can't hide one column from some
callers while still showing the row.

## Decision

- `authenticated` loses direct `select` and `update` on `profiles.phone`. It
  keeps column-level `select (id, full_name, created_at, updated_at)` and
  `update (full_name)`.
- `public.get_profile_phone(profile_id)` returns the phone number only to the
  member themselves, or to an `organization_admin` or `regional_admin` of a
  tenant that both users belong to. Everyone else gets `null`.
- Phone numbers come from the auth provider when the user signs up. Users
  cannot overwrite them directly. A verified phone-change flow arrives with
  phone OTP.

## Alternatives considered

- **Self only:** strictest option, but admins could not contact farmers or
  pilots about jobs, which blocks demo operations.
- **Move phone to a separate `profile_contacts` table with its own RLS:**
  also valid. Deferred because the function needs no schema split and
  covers current needs.

## Consequences

- `select phone from profiles` fails with `42501` for application users. Use
  the function instead.
- When villages exist, Mitra access to the phones of farmers in their village
  cluster must be added to `get_profile_phone`, with pgTAP tests.
