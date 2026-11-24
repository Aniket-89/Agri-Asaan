-- Fleet: drones and pilot profiles (ADR 0010).
--
-- Both tables are tenant-owned with composite foreign keys. Organization
-- admins manage the whole fleet. Regional admins can see the whole tenant
-- fleet (to borrow across regions) but only change pilots and drones homed
-- in regions they manage. A pilot sees their own profile. Job assignment and
-- double-booking prevention arrive with bookings.

create type public.drone_status as enum ('active', 'maintenance', 'retired');

create table public.drones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  -- Identifier painted on / registered for the airframe (e.g. a DGCA UIN).
  uid text not null,
  model text not null,
  home_region_id uuid,
  status public.drone_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint drones_home_region_same_tenant
    foreign key (tenant_id, home_region_id) references public.regions (tenant_id, id),
  constraint drones_uid_format check (uid ~ '^[A-Za-z0-9][A-Za-z0-9-]{2,39}$'),
  constraint drones_model_not_blank check (btrim(model) <> '' and char_length(model) <= 80),
  constraint drones_tenant_id_id_unique unique (tenant_id, id)
);

-- Unique per tenant (not globally) so one tenant cannot probe another's UIDs.
create unique index drones_tenant_uid_unique on public.drones (tenant_id, upper(uid));
create index drones_tenant_region_idx on public.drones (tenant_id, home_region_id);

create table public.pilot_profiles (
  tenant_id uuid not null,
  user_id uuid not null,
  home_region_id uuid,
  -- DGCA Remote Pilot Certificate number, when recorded.
  license_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, user_id),
  constraint pilot_profiles_member_same_tenant
    foreign key (tenant_id, user_id) references public.organization_members (organization_id, user_id) on delete cascade,
  constraint pilot_profiles_home_region_same_tenant
    foreign key (tenant_id, home_region_id) references public.regions (tenant_id, id),
  constraint pilot_profiles_license_format
    check (license_number is null or license_number ~ '^[A-Za-z0-9/-]{3,40}$')
);

create index pilot_profiles_tenant_region_idx on public.pilot_profiles (tenant_id, home_region_id);

-- A pilot profile can only belong to a member holding the pilot role.
create or replace function public.check_pilot_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organization_members as member
    where member.organization_id = new.tenant_id
      and member.user_id = new.user_id
      and member.role = 'pilot'
  ) then
    raise exception 'a pilot profile requires a member with the pilot role' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_pilot_profile_role() from public, anon, authenticated;

create trigger check_pilot_profile_role before insert on public.pilot_profiles
  for each row execute function public.check_pilot_profile_role();

-- ── Access helpers ─────────────────────────────────────────────────────────

create or replace function public.can_view_fleet(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_organization_role(
    p_tenant_id,
    array['organization_admin', 'regional_admin']::public.organization_role[]
  );
$$;

-- Organization admins manage everything; a regional admin manages fleet
-- items homed in a region they manage. Items with no home region are
-- organization-admin only.
create or replace function public.can_manage_fleet_item(p_tenant_id uuid, p_home_region_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_organization_role(p_tenant_id, array['organization_admin']::public.organization_role[])
    or (
      p_home_region_id is not null
      and exists (
        select 1 from public.regions as region
        where region.id = p_home_region_id
          and region.tenant_id = p_tenant_id
      )
      and public.can_manage_region(p_home_region_id)
    );
$$;

revoke execute on function public.can_view_fleet(uuid) from public, anon;
revoke execute on function public.can_manage_fleet_item(uuid, uuid) from public, anon;
grant execute on function public.can_view_fleet(uuid) to authenticated;
grant execute on function public.can_manage_fleet_item(uuid, uuid) to authenticated;

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.drones enable row level security;
alter table public.pilot_profiles enable row level security;

revoke all on public.drones, public.pilot_profiles from anon;

create policy drones_select on public.drones
for select to authenticated
using (public.can_view_fleet(tenant_id));

create policy drones_insert on public.drones
for insert to authenticated
with check (public.can_manage_fleet_item(tenant_id, home_region_id));

create policy drones_update on public.drones
for update to authenticated
using (public.can_manage_fleet_item(tenant_id, home_region_id))
with check (public.can_manage_fleet_item(tenant_id, home_region_id));

create policy drones_delete_organization_admin on public.drones
for delete to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy pilot_profiles_select on public.pilot_profiles
for select to authenticated
using (public.can_view_fleet(tenant_id) or user_id = auth.uid());

create policy pilot_profiles_insert on public.pilot_profiles
for insert to authenticated
with check (public.can_manage_fleet_item(tenant_id, home_region_id));

create policy pilot_profiles_update on public.pilot_profiles
for update to authenticated
using (public.can_manage_fleet_item(tenant_id, home_region_id))
with check (public.can_manage_fleet_item(tenant_id, home_region_id));

create policy pilot_profiles_delete_organization_admin on public.pilot_profiles
for delete to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

-- Tenant and identity columns never change through the API.
revoke insert, update on public.drones from authenticated;
grant insert (tenant_id, uid, model, home_region_id, status) on public.drones to authenticated;
grant update (uid, model, home_region_id, status, updated_at) on public.drones to authenticated;

revoke insert, update on public.pilot_profiles from authenticated;
grant insert (tenant_id, user_id, home_region_id, license_number, is_active) on public.pilot_profiles to authenticated;
grant update (home_region_id, license_number, is_active, updated_at) on public.pilot_profiles to authenticated;
