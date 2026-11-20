drop function public.provision_customer_organization(
  text,
  text,
  public.organization_type,
  uuid,
  text,
  text,
  text[]
);

create function public.provision_customer_organization(
  p_name text,
  p_slug text,
  p_organization_type public.organization_type,
  p_initial_admin_email text,
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
  v_initial_admin_id uuid;
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
  p_initial_admin_email := lower(btrim(coalesce(p_initial_admin_email, '')));
  p_brand_name := nullif(btrim(coalesce(p_brand_name, '')), '');

  if p_name = '' then
    raise exception 'organization name is required';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid organization slug';
  end if;
  if p_initial_admin_email = '' then
    raise exception 'initial organization admin email is required';
  end if;

  select profile.id
    into v_initial_admin_id
  from public.profiles as profile
  join auth.users as auth_user on auth_user.id = profile.id
  where lower(auth_user.email) = p_initial_admin_email;

  if v_initial_admin_id is null then
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
    v_initial_admin_id,
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

revoke execute on function public.provision_customer_organization(text, text, public.organization_type, text, text, text, text[]) from public, anon;
grant execute on function public.provision_customer_organization(text, text, public.organization_type, text, text, text, text[]) to authenticated;