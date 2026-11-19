create type public.organization_type as enum (
  'customer',
  'agriasaan'
);

alter table public.organizations
  add column organization_type public.organization_type not null default 'customer',
  add column created_by uuid references public.profiles(id);

alter table public.organization_settings
  add column brand_name text,
  add column brand_primary_color text;

create or replace function public.provision_customer_organization(
  p_name text,
  p_slug text,
  p_organization_type public.organization_type,
  p_initial_admin_id uuid,
  p_brand_name text default null,
  p_brand_primary_color text default null,
  p_enabled_features text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_org_id uuid;
  v_feature text;
begin
  if v_caller is null then
    raise exception 'authentication required';
  end if;

  if not (
    public.is_platform_owner()
    or public.is_system_admin()
  ) then
    raise exception 'only platform owner or system administrator can provision organizations';
  end if;

  p_name := btrim(p_name);
  p_slug := lower(btrim(p_slug));
  p_brand_name := nullif(btrim(coalesce(p_brand_name, '')), '');

  if p_name = '' then
    raise exception 'organization name is required';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid organization slug';
  end if;
  if not exists (select 1 from public.profiles where id = p_initial_admin_id) then
    raise exception 'initial organization admin profile not found';
  end if;

  insert into public.organizations (
    name,
    slug,
    organization_type,
    created_by
  )
  values (
    p_name,
    p_slug,
    p_organization_type,
    v_caller
  )
  returning id into v_org_id;

  insert into public.organization_settings (
    tenant_id,
    default_locale,
    timezone,
    brand_name,
    brand_primary_color
  )
  values (
    v_org_id,
    'en',
    'Asia/Kolkata',
    coalesce(p_brand_name, p_name),
    p_brand_primary_color
  );

  insert into public.organization_members (
    tenant_id,
    organization_id,
    user_id,
    role
  )
  values (
    v_org_id,
    v_org_id,
    p_initial_admin_id,
    'organization_admin'
  );

  foreach v_feature in array p_enabled_features loop
    if v_feature !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' then
      raise exception 'invalid organization feature key';
    end if;

    insert into public.organization_features (tenant_id, feature_key, enabled)
    values (v_org_id, v_feature, true)
    on conflict (tenant_id, feature_key) do update set enabled = true;
  end loop;

  return v_org_id;
end;
$$;

revoke execute on function public.provision_customer_organization(text, text, public.organization_type, uuid, text, text, text[]) from public, anon;
grant execute on function public.provision_customer_organization(text, text, public.organization_type, uuid, text, text, text[]) to authenticated;

create policy organizations_select_platform_admin on public.organizations
for select to authenticated
using (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

create policy organizations_update_platform_admin on public.organizations
for update to authenticated
using (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
)
with check (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

create policy organization_settings_select_platform_admin on public.organization_settings
for select to authenticated
using (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

create policy organization_features_select_platform_admin on public.organization_features
for select to authenticated
using (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

create policy organization_domains_select_platform_admin on public.organization_domains
for select to authenticated
using (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

create policy organization_settings_write_platform_admin on public.organization_settings
for update to authenticated
using (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
)
with check (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

create policy organization_features_write_platform_admin on public.organization_features
for all to authenticated
using (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
)
with check (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

create policy organization_domains_write_platform_admin on public.organization_domains
for all to authenticated
using (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
)
with check (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

create policy organization_members_select_platform_admin on public.organization_members
for select to authenticated
using (
  public.is_platform_owner()
  or public.is_platform_role(array['system_admin']::public.platform_role[])
);

drop policy organizations_update_super_admin on public.organizations;
create policy organizations_update_super_admin on public.organizations
for update to authenticated
using (
  public.has_organization_role(id, array['super_admin', 'organization_admin']::public.organization_role[])
)
with check (
  public.has_organization_role(id, array['super_admin', 'organization_admin']::public.organization_role[])
);

drop policy organization_settings_write_super_admin on public.organization_settings;
create policy organization_settings_write_super_admin on public.organization_settings
for all to authenticated
using (
  public.has_organization_role(tenant_id, array['super_admin', 'organization_admin']::public.organization_role[])
)
with check (
  public.has_organization_role(tenant_id, array['super_admin', 'organization_admin']::public.organization_role[])
);

drop policy organization_features_write_admin on public.organization_features;
create policy organization_features_write_admin on public.organization_features
for all to authenticated
using (
  public.has_organization_role(tenant_id, array['super_admin', 'organization_admin', 'admin']::public.organization_role[])
)
with check (
  public.has_organization_role(tenant_id, array['super_admin', 'organization_admin', 'admin']::public.organization_role[])
);

drop policy organization_domains_write_super_admin on public.organization_domains;
create policy organization_domains_write_super_admin on public.organization_domains
for all to authenticated
using (
  public.has_organization_role(tenant_id, array['super_admin', 'organization_admin']::public.organization_role[])
)
with check (
  public.has_organization_role(tenant_id, array['super_admin', 'organization_admin']::public.organization_role[])
);
