# 0003. Tenant branding resolution

- Status: Accepted
- Date: 2026-11-21

## Context

Branding was hard-coded in `modules/branding/branding-config.ts`, with the
AgriAsaan brand and a fake `tenantId: "default-tenant"`. AGENTS.md requires
brand name, colors, and domains to be organization configuration. It also
says a hostname must never be trusted as authorization.

Unauthenticated pages, such as the landing page on a white-label domain,
need the tenant's brand before anyone signs in. But `anon` has no access to
application tables.

## Decision

- Branding comes from `organization_settings` (`brand_name`,
  `brand_primary_color`), with `PLATFORM_DEFAULT_BRANDING` as the fallback.
- **Unauthenticated pages:** `public.get_public_branding(hostname)` is a
  `SECURITY DEFINER` function executable by `anon`. It returns only the brand
  name, primary color, and default locale, and only for a **verified**
  hostname of an **active** organization. It never returns tenant IDs or any
  other tenant data. This is the documented public-read exception allowed by
  AGENTS.md section 7.
- **Authenticated pages:** branding is read for the active, membership-verified
  organization through normal RLS.
- Only platform staff can verify a hostname. Organization admins can request
  a hostname (unverified) and delete their own requests.
- `brand_primary_color` must match `#RRGGBB`. This is enforced by a database
  check constraint and re-checked in `applyTenantBranding`, because the value
  is rendered into a `style` attribute.
- The landing page's Suspense fallback is brand-neutral, so the platform brand
  never flashes on a white-label domain.

## Alternatives considered

- **Grant `anon` select on `organization_settings`:** rejected. It would
  expose every column of every tenant's settings.
- **Brand configuration in environment variables or code:** rejected. That's
  per-customer code, which AGENTS.md forbids.

## Consequences

- The landing page renders per request. Its static shell is brand-neutral.
- Tagline, accent color, and logo are tenant-configurable (migration
  `20261121110000_tenant_brand_assets.sql`):
  - Logos live in the public `brand-assets` bucket at `<tenant_id>/<file>`.
  - PNG, WebP, and JPEG only, up to 512 KB. SVG is rejected because it can
    carry script.
  - Only platform owners and system admins can upload until a tenant
    branding UI exists.
  - A resolved tenant brand never inherits the platform's tagline or logo.
- Page titles and the login heading use the hostname's brand, with
  brand-neutral fallbacks.
- Domain-ownership verification (for example a DNS TXT check) is manual for
  the MVP. A platform admin sets `is_verified`.
