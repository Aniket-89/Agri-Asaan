-- Public, non-sensitive branding lookup for unauthenticated pages (ADR 0003).
-- Returns presentation data only for a verified hostname of an active
-- organization. It is not an authorization mechanism: it never returns tenant
-- IDs, membership, or any other tenant data.

create or replace function public.get_public_branding(p_hostname text)
returns table (
  brand_name text,
  brand_primary_color text,
  default_locale text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(settings.brand_name, organization.name),
    settings.brand_primary_color,
    settings.default_locale
  from public.organization_domains as domain
  join public.organizations as organization on organization.id = domain.tenant_id
  join public.organization_settings as settings on settings.tenant_id = domain.tenant_id
  where domain.hostname = lower(btrim(p_hostname))
    and domain.is_verified
    and organization.is_active
  limit 1;
$$;

revoke execute on function public.get_public_branding(text) from public;
grant execute on function public.get_public_branding(text) to anon, authenticated;

-- Brand colors are rendered into page styles; only allow #RRGGBB values.
alter table public.organization_settings
  add constraint organization_settings_brand_primary_color_hex
  check (brand_primary_color is null or brand_primary_color ~ '^#[0-9a-fA-F]{6}$');
