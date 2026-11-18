# Foundation Database and Authentication Architecture

## Identity model

- `profiles.id` is the stable application identity and references `auth.users(id)`.
- `profiles` is global user identity/profile data, not tenant-owned data.
- Organization membership links a profile to an organization and defines an organization-scoped role.
- One organization is the MVP tenant boundary.

## Tables

- `organizations`: tenant record with unique slug.
- `organization_members`: tenant-owned membership record with `tenant_id = organization_id`.
- `organization_settings`: one settings row per tenant.
- `organization_features`: tenant feature configuration.
- `organization_domains`: tenant-owned verified hostname mappings.

## Roles

- `super_admin`
- `admin`
- `mitra`
- `farmer`
- `pilot`

## Security

RLS is enabled on every foundation table. Membership and role checks use SECURITY DEFINER helper functions with an empty search path. Direct organization creation and membership creation are restricted to authenticated RPCs.

No browser code receives or uses the service-role key.

The active organization is stored in an HTTP-only cookie and is always verified against `organization_members` before use.

## Authentication UI

- `/login`: password sign-in.
- `/register`: profile and organization registration.
- `/dashboard`: protected organization-aware dashboard.
- `/api/auth/signout`: session sign-out.
- `/api/organization/select`: membership-verified organization switching.

The Next.js proxy refreshes Supabase cookies and redirects unauthenticated dashboard requests to `/login`.

## Testing

Run:

```bash
npm run db:reset
npm run db:test
```

The pgTAP foundation suite proves own-organization access, cross-tenant denial, tenant write denial, self-role protection, and unauthenticated denial.
