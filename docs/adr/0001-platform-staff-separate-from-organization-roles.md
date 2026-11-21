# 0001. Platform staff are separate from organization roles

- Status: Accepted (recorded retroactively; implemented in PRs #1 and #3)
- Date: 2026-11-21

## Context

AGENTS.md requires that tenant administrators never get implicit cross-tenant
access, and that any platform-wide administration is a separate concept with
explicit approval, separate authorization rules, and audit logging.

The platform operator still needs to provision customer organizations and
manage platform staff.

## Decision

- Platform roles live in `public.platform_staff` (`platform_owner`,
  `system_admin`, `developer`, `support`), one row per profile, with
  `active`/`suspended` status.
- Organization roles stay in `public.organization_members`. Neither table
  grants the other's privileges.
- The first platform owner is created only by
  `public.bootstrap_platform_owner`, which is not executable by `anon` or
  `authenticated`. Later staff changes go through
  `public.manage_platform_staff`.
- Only active platform owners and system admins can provision organizations
  (`public.provision_customer_organization`) and read organization records
  across tenants.

## Alternatives considered

- **A `platform_admin` value in `organization_role`:** rejected. A membership
  bug or a careless role update could then grant cross-tenant access.
- **Service-role scripts only, no platform UI:** rejected. Every provisioning
  action would need a secret key on a developer machine.

## Consequences

- Cross-tenant reads by platform staff are allowed by RLS, but there is no
  durable audit table yet. One is required before production (see
  `docs/architecture/platform-administration.md`).
- `developer` and `support` have no customer-data access by default.
