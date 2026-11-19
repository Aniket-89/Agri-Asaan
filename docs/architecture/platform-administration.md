# Platform Administration

## Role separation

Platform roles are stored in `public.platform_staff` and are separate from organization membership roles.

- `platform_owner`: full platform administration, organization provisioning, and platform owner assignments.
- `system_admin`: organization provisioning and organization configuration. Cannot assign platform owner.
- `developer`: active platform staff with diagnostics access; no organization provisioning or customer-record access by default.
- `support`: reserved role for future support workflows. No MVP provisioning functionality.

Organization roles remain in `organization_members`, including `organization_admin`, `regional_admin`, `mitra`, `pilot`, and `farmer`.

## Initial Platform Owner bootstrap

Public user registration does not grant platform privileges. There is no public API for Platform Owner bootstrap; the bootstrap function is revoked from `PUBLIC`, `anon`, and `authenticated` roles.

The initial owner must first exist as an authenticated Supabase Auth user and have a `profiles` row. Use the local PostgreSQL administration connection while connected to the local stack:

```sql
select public.bootstrap_platform_owner('EXISTING-PROFILE-UUID');
```

Run this only through a database administration session or a secured deployment procedure. The function refuses a second Platform Owner and does not create users.

Subsequent staff changes must use `/platform/staff` or the `public.manage_platform_staff` RPC through an active Platform Owner or System Admin session.

## Organization provisioning

Only active Platform Owners and System Admins can execute `public.provision_customer_organization`.
Public registration cannot create organizations or organization memberships. The legacy self-service organization RPC has been removed; only the protected provisioning flow and authorized organization-administration operations can establish membership.
The provisioning form accepts the initial administrator's email address. The RPC resolves it to an existing Auth user profile after checking the caller's platform role; it does not create or invite users. Unknown emails fail without creating the organization.

The RPC transactionally creates:

1. the organization and `created_by` audit reference;
2. organization settings and initial branding;
3. the initial organization membership with `organization_admin` role;
4. requested enabled feature records.

Organization Admins cannot create organizations or access unrelated organizations.

## Platform routes

- `/platform`: protected overview.
- `/platform/organizations`: organization list and details.
- `/platform/organizations/new`: owner/system-admin provisioning.
- `/platform/staff`: owner/system-admin staff management.

The Next.js proxy validates authentication and active platform staff status. Server actions and database RPCs independently enforce role authorization.

## Security limitations

The MVP uses no public staff invitation flow and no platform audit table. Staff and organization provisioning are protected by RLS and RPC checks, but a durable audit trail should be added before production operations.
