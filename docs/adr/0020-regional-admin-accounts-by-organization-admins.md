# 0020. Regional admin accounts are created by organization admins, by email invite

- Status: Accepted (owner request, 2026-11-27)
- Date: 2026-11-27

## Context

Organization admins can create regions and assign regional admins to them,
but only people who already hold the regional admin role. There was no way
to create a regional admin account, so a new region could not get one.

## Decision

- **Same invite flow as pilots and mitras (ADR 0012, 0019).** The
  organization admin enters name, email and one active region of their
  organization. The person gets an email link, sets their own password, and
  starts as a regional admin assigned to that region. More regions are
  assigned on the territory page as before.
- **Only organization admins invite regional admins.** Regional admins
  cannot create peers.
- **Database functions** (`regional_admin_invites` audit table, readable by
  the tenant's organization admins):
  - `can_invite_regional_admin(region)` with the admin's own session
  - `claim_regional_admin_invite`, `provision_invited_regional_admin`,
    `fail_regional_admin_invite`, executable only by `service_role`.
    Provisioning re-checks the inviter, requires the open claim and a
    matching fresh account, then creates the `regional_admin` membership and
    the `regional_admin_regions` row in one transaction.
- **Shared rules cover all three invite kinds:** one per-email lock, one
  open-claim check and one limit of 20 attempts an hour per inviter
  (`staff_invite_*` functions were replaced to include the new table).
- **Shared server code:** the service-key steps (claim, invite, provision,
  release and orphan clean-up) live in `lib/auth/staff-invite.ts`, used by
  mitra and regional admin invites. The pilot invite keeps its own copy for
  now.

## Consequences

- Same account-enumeration limitation and missing "resend invite" as the
  other invites (ADR 0012).
- Organization admin accounts are still provisioned by platform staff.
