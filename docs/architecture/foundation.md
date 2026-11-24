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

- `organization_admin`: tenant-wide administrator
- `regional_admin`: manages operational members (mitra, farmer, pilot)
- `mitra`
- `farmer`
- `pilot`

The legacy `super_admin` and `admin` enum values are blocked by a constraint. See `docs/adr/0002-organization-role-names.md`.

## Personal data

`profiles.phone` is not directly selectable. `public.get_profile_phone` returns it to the member themselves and to organization or regional admins of a shared tenant. See `docs/adr/0004-member-phone-visibility.md`.

## Branding

Branding comes from `organization_settings`. Unauthenticated pages resolve it from a verified hostname through `public.get_public_branding`. Authenticated pages use the active organization. Only platform staff can verify domains or change organization type, status, and slug. See `docs/adr/0003-tenant-branding-resolution.md`.

## Security

RLS is enabled on every foundation table. Membership and role checks use SECURITY DEFINER helper functions with an empty search path. Public registration creates an Auth user and a profile only. Organization creation is limited to the protected platform provisioning RPC, and membership changes require an authorized provisioning or organization-admin RPC.

No browser code receives or uses the service-role key.

The active organization is stored in an HTTP-only cookie and is always verified against `organization_members` before use.

## Authentication UI

- `/login`: password sign-in.
- `/register`: creates an Auth user and profile without organization or membership privileges.
- `/register/check-email`: email-verification instructions when Supabase requires confirmation.
- `/register/pending-access`: explains that an organization administrator must invite a verified user.
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

The pgTAP suites prove own-organization access, cross-tenant denial, tenant write denial, self-role protection, unauthenticated denial, administrator role scope, platform-controlled organization fields, domain verification, phone visibility, and public branding. See `docs/data-model.md` for the full access summary.
