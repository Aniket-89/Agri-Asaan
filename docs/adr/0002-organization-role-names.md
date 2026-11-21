# 0002. Organization roles: organization_admin and regional_admin

- Status: Accepted (owner approved, 2026-11-21)
- Date: 2026-11-21

## Context

`public.organization_role` had two overlapping sets of administrator roles:

- `super_admin` / `admin`: the original foundation migration and AGENTS.md.
- `organization_admin` / `regional_admin`: added with platform provisioning.
  Provisioning assigns `organization_admin`.

The RLS policies and `add_organization_member` only recognised the first
set. The administrator created by provisioning therefore could not see their
members or add anyone, so every new organization was stuck at one user.
`super_admin` also read as a platform-wide role, which AGENTS.md explicitly
warns against.

## Decision

- The organization roles are `organization_admin`, `regional_admin`, `mitra`,
  `farmer`, and `pilot`.
- Migration `20261121100000_unify_organization_roles.sql` converts existing
  rows (`super_admin` → `organization_admin`, `admin` → `regional_admin`) and
  adds the `organization_members_role_current` check constraint. Postgres
  cannot drop enum values, so the legacy values remain in the type but cannot
  be stored.
- `organization_admin` has full control of tenant configuration and
  memberships, except their own membership.
- `regional_admin` can see the tenant's memberships, and can add or change
  only `mitra`, `farmer`, and `pilot` members. They can never modify an
  administrator row. Region-level scoping is added once regions exist.
- Application code uses `ORGANIZATION_ROLES` in
  `apps/web/src/modules/organizations/organization-roles.ts`, which excludes
  the legacy values.

## Alternatives considered

- **Keep `super_admin` / `admin`:** matches the original AGENTS.md wording,
  but needs provisioning and platform docs changed, and keeps the misleading
  `super_admin` name.
- **Recreate the enum type without legacy values:** cleaner type, but it
  needs every dependent function and policy dropped and recreated. That's a
  large, risky migration with no behavioural benefit.

## Consequences

- AGENTS.md's role table is updated to the new names.
- Generated TypeScript types still list the legacy enum values. Use
  `isOrganizationRole` to narrow them.
