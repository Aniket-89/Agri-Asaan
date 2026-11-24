-- Tenant administrators may rename their organization, but organization type,
-- active status, slug, and audit columns are controlled by platform staff.
-- RLS cannot restrict individual columns per caller, so a trigger does it.
-- Calls without an authenticated user (migrations, seed, database
-- administration) are not restricted; anon has no table access.

create or replace function public.protect_platform_controlled_organization_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_platform_owner() or public.is_system_admin() then
    return new;
  end if;

  if new.organization_type is distinct from old.organization_type
     or new.is_active is distinct from old.is_active
     or new.slug is distinct from old.slug
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'only platform staff can change organization type, status, slug, or audit fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_platform_controlled_organization_fields() from public, anon, authenticated;

create trigger protect_platform_controlled_organization_fields
  before update on public.organizations
  for each row execute function public.protect_platform_controlled_organization_fields();

-- Domains: a tenant administrator can request a hostname (unverified) and
-- remove one. Only platform staff can verify or change a hostname mapping;
-- they already have organization_domains_write_platform_admin.
drop policy organization_domains_write_super_admin on public.organization_domains;

create policy organization_domains_insert_unverified on public.organization_domains
for insert to authenticated
with check (
  is_verified = false
  and is_primary = false
  and public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[])
);

create policy organization_domains_delete_organization_admin on public.organization_domains
for delete to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));
