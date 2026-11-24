-- Tenant-configurable tagline, accent color, and logo (ADR 0003).
-- Logos live in the public `brand-assets` Storage bucket under
-- `<tenant_id>/<file>`. Only platform owners and system admins can upload
-- them until a tenant branding UI exists. SVG is not allowed because it can
-- carry script.

alter table public.organization_settings
  add column brand_tagline text,
  add column brand_accent_color text,
  add column brand_logo_path text,
  add constraint organization_settings_brand_tagline_length
    check (brand_tagline is null or (btrim(brand_tagline) <> '' and char_length(brand_tagline) <= 120)),
  add constraint organization_settings_brand_accent_color_hex
    check (brand_accent_color is null or brand_accent_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint organization_settings_brand_logo_path_format
    check (
      brand_logo_path is null
      or (
        brand_logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(png|webp|jpg|jpeg)$'
        and split_part(brand_logo_path, '/', 1) = tenant_id::text
      )
    );

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;

-- Upload limits are enforced by the Storage service. Their columns come from
-- Storage's own schema migrations (present in Supabase-managed databases and
-- in `supabase start` / `supabase db start`); the guard keeps this migration
-- portable to a plain Postgres without the Storage schema extensions.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    execute $sql$
      update storage.buckets
      set file_size_limit = 524288,
          allowed_mime_types = array['image/png', 'image/webp', 'image/jpeg']
      where id = 'brand-assets'
    $sql$;
  end if;
end;
$$;

create policy brand_assets_insert_platform_admin on storage.objects
for insert to authenticated
with check (
  bucket_id = 'brand-assets'
  and (public.is_platform_owner() or public.is_system_admin())
  and objects.name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(png|webp|jpg|jpeg)$'
  -- Qualified on purpose: a bare `name` here would resolve to organizations.name.
  and exists (
    select 1 from public.organizations as organization
    where organization.id::text = split_part(objects.name, '/', 1)
  )
);

create policy brand_assets_update_platform_admin on storage.objects
for update to authenticated
using (bucket_id = 'brand-assets' and (public.is_platform_owner() or public.is_system_admin()))
with check (bucket_id = 'brand-assets' and (public.is_platform_owner() or public.is_system_admin()));

create policy brand_assets_delete_platform_admin on storage.objects
for delete to authenticated
using (bucket_id = 'brand-assets' and (public.is_platform_owner() or public.is_system_admin()));

-- The return type changes, so the function is recreated.
drop function public.get_public_branding(text);

create function public.get_public_branding(p_hostname text)
returns table (
  brand_name text,
  brand_primary_color text,
  brand_accent_color text,
  brand_tagline text,
  brand_logo_path text,
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
    settings.brand_accent_color,
    settings.brand_tagline,
    settings.brand_logo_path,
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
