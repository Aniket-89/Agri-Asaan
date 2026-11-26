-- Farmer self-registration (ADR 0018).
--
-- A person signing up on an organization's site joins it as a farmer and gets
-- a farmer record linked to their login. The organization comes from the
-- site's verified hostname and must have the `farmer_self_registration`
-- feature enabled. The role is always `farmer`: staff roles (mitra, pilot,
-- admins) are never self-assigned.

-- The organization accepting farmer sign-ups on a hostname, or null.
create or replace function public.farmer_registration_tenant(p_hostname text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select domain.tenant_id
  from public.organization_domains as domain
  join public.organizations as organization on organization.id = domain.tenant_id
  join public.organization_features as feature
    on feature.tenant_id = domain.tenant_id
   and feature.feature_key = 'farmer_self_registration'
   and feature.enabled
  where domain.hostname = lower(btrim(p_hostname))
    and domain.is_verified
    and organization.is_active
  limit 1;
$$;

revoke execute on function public.farmer_registration_tenant(text) from public, anon, authenticated;

-- Villages a farmer can choose when registering on a hostname. Empty when the
-- site does not accept farmer sign-ups. Village and region names are not
-- personal data; nothing else about the organization is returned.
create or replace function public.get_farmer_registration_villages(p_hostname text)
returns table (village_id uuid, village_name text, region_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select village.id, village.name, region.name
  from public.villages as village
  join public.regions as region on region.id = village.region_id
  where village.tenant_id = public.farmer_registration_tenant(p_hostname)
    and village.is_active
    and region.is_active
  order by region.name, village.name
  limit 500;
$$;

revoke execute on function public.get_farmer_registration_villages(text) from public;
grant execute on function public.get_farmer_registration_villages(text) to anon, authenticated;

-- The signed-in caller joins the hostname's organization as a farmer and gets
-- a linked farmer record. Joining is the caller's own act, so it needs no
-- separate acceptance (ADR 0007 covers members added by someone else).
-- Consent time and registered_by are set by the farmers trigger.
create or replace function public.register_self_as_farmer(
  p_hostname text,
  p_village_id uuid,
  p_full_name text,
  p_phone text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_farmer_id uuid;
begin
  if v_user_id is null then
    raise exception 'sign in to register' using errcode = '42501';
  end if;

  v_tenant_id := public.farmer_registration_tenant(p_hostname);
  if v_tenant_id is null then
    raise exception 'this site does not accept farmer registrations' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.villages as village
    join public.regions as region on region.id = village.region_id
    where village.id = p_village_id
      and village.tenant_id = v_tenant_id
      and village.is_active
      and region.is_active
  ) then
    raise exception 'village not available for registration' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.organization_members as member
    where member.organization_id = v_tenant_id
      and member.user_id = v_user_id
  ) then
    raise exception 'already a member of this organization' using errcode = '23505';
  end if;

  insert into public.organization_members (tenant_id, organization_id, user_id, role)
  values (v_tenant_id, v_tenant_id, v_user_id, 'farmer');

  insert into public.farmers (tenant_id, village_id, full_name, phone, profile_id, consent_recorded_at)
  values (v_tenant_id, p_village_id, btrim(p_full_name), p_phone, v_user_id, timezone('utc', now()))
  returning id into v_farmer_id;

  -- Fill the profile name when signup left it empty; never overwrite it.
  update public.profiles
  set full_name = btrim(p_full_name)
  where id = v_user_id
    and (full_name is null or btrim(full_name) = '');

  return v_farmer_id;
end;
$$;

revoke execute on function public.register_self_as_farmer(text, uuid, text, text) from public, anon;
grant execute on function public.register_self_as_farmer(text, uuid, text, text) to authenticated;
