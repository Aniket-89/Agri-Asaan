-- Farmers, fields, and the tenant crop list (ADR 0009).
--
-- All tables are tenant-owned, with composite foreign keys on (tenant_id, ...).
-- Farmers are tenant records created by mitras or admins. They may later be
-- linked to a login (profile_id). Access follows territory: organization
-- admins see the whole tenant, regional admins their regions, mitras their
-- villages, and a linked farmer only their own record.

create extension if not exists pg_trgm with schema extensions;

-- ── Crops (tenant configuration) ───────────────────────────────────────────

create table public.tenant_crops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name_en text not null,
  name_hi text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tenant_crops_code_format check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint tenant_crops_names_not_blank check (btrim(name_en) <> '' and btrim(name_hi) <> ''),
  constraint tenant_crops_tenant_code_unique unique (tenant_id, code),
  constraint tenant_crops_tenant_id_id_unique unique (tenant_id, id)
);

-- ── Farmers ────────────────────────────────────────────────────────────────

create table public.farmers (
  -- Client-generated on the registration form so retries are idempotent.
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  village_id uuid not null,
  full_name text not null,
  -- Indian mobile number, 10 digits without country code. Personal data:
  -- readable only by people who can read the farmer row.
  phone text not null,
  -- Optional link to a login. The linked member must be a farmer in the same tenant.
  profile_id uuid,
  consent_recorded_at timestamptz not null,
  registered_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint farmers_village_same_tenant
    foreign key (tenant_id, village_id) references public.villages (tenant_id, id),
  constraint farmers_profile_member_same_tenant
    foreign key (tenant_id, profile_id) references public.organization_members (organization_id, user_id) on delete set null (profile_id),
  constraint farmers_full_name_not_blank check (btrim(full_name) <> '' and char_length(full_name) <= 120),
  constraint farmers_phone_format check (phone ~ '^[6-9][0-9]{9}$'),
  constraint farmers_tenant_id_id_unique unique (tenant_id, id)
);

create unique index farmers_tenant_profile_unique on public.farmers (tenant_id, profile_id) where profile_id is not null;
create index farmers_tenant_village_idx on public.farmers (tenant_id, village_id);
create index farmers_tenant_phone_idx on public.farmers (tenant_id, phone);
create index farmers_full_name_trgm on public.farmers using gin (full_name extensions.gin_trgm_ops);

-- ── Fields ─────────────────────────────────────────────────────────────────

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  farmer_id uuid not null,
  name text not null,
  crop_id uuid not null,
  -- Canonical unit is acres; display units can become tenant configuration.
  area_acres numeric(8, 2) not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  location extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(
      extensions.st_makepoint(longitude::double precision, latitude::double precision),
      4326
    )::extensions.geography
  ) stored,
  -- Optional boundary for satellite analysis (seed/demo workflow for the MVP).
  boundary extensions.geography(Polygon, 4326),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fields_farmer_same_tenant
    foreign key (tenant_id, farmer_id) references public.farmers (tenant_id, id) on delete cascade,
  constraint fields_crop_same_tenant
    foreign key (tenant_id, crop_id) references public.tenant_crops (tenant_id, id),
  constraint fields_name_not_blank check (btrim(name) <> '' and char_length(name) <= 120),
  constraint fields_area_positive check (area_acres > 0 and area_acres <= 10000),
  constraint fields_latitude_range check (latitude between -90 and 90),
  constraint fields_longitude_range check (longitude between -180 and 180),
  constraint fields_tenant_id_id_unique unique (tenant_id, id)
);

create unique index fields_farmer_name_unique on public.fields (farmer_id, lower(btrim(name)));
create index fields_tenant_farmer_idx on public.fields (tenant_id, farmer_id);
create index fields_crop_idx on public.fields (tenant_id, crop_id);
create index fields_location_gist on public.fields using gist (location);
create index fields_boundary_gist on public.fields using gist (boundary);

-- ── Integrity triggers ─────────────────────────────────────────────────────

-- A linked login must belong to a member with the farmer role.
create or replace function public.check_farmer_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is not null and not exists (
    select 1 from public.organization_members as member
    where member.organization_id = new.tenant_id
      and member.user_id = new.profile_id
      and member.role = 'farmer'
  ) then
    raise exception 'a linked login must be a farmer member of the tenant' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_farmer_profile_role() from public, anon, authenticated;

create trigger check_farmer_profile_role before insert or update of profile_id, tenant_id on public.farmers
  for each row execute function public.check_farmer_profile_role();

-- registered_by is always the caller and the consent time is the server's
-- clock, never client-supplied values. The app records consent only after
-- the farmer's agreement is confirmed on the registration form.
create or replace function public.set_farmer_registered_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.registered_by := auth.uid();
    new.consent_recorded_at := timezone('utc', now());
  end if;
  return new;
end;
$$;

revoke execute on function public.set_farmer_registered_by() from public, anon, authenticated;

create trigger set_farmer_registered_by before insert on public.farmers
  for each row execute function public.set_farmer_registered_by();

-- ── Access helpers ─────────────────────────────────────────────────────────

-- Who may register and manage farmers in a village: its region's managers
-- (organization admin, assigned regional admin) or an assigned mitra.
create or replace function public.can_manage_farmers_in_village(p_village_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_village(p_village_id) or public.is_mitra_for_village(p_village_id);
$$;

-- Read access to a farmer: their managers, or the farmer's own linked login.
create or replace function public.can_view_farmer(p_farmer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.farmers as farmer
    where farmer.id = p_farmer_id
      and (
        public.can_manage_farmers_in_village(farmer.village_id)
        or (
          farmer.profile_id = auth.uid()
          and public.has_organization_role(farmer.tenant_id, array['farmer']::public.organization_role[])
        )
      )
  );
$$;

create or replace function public.can_manage_farmer(p_farmer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.farmers as farmer
    where farmer.id = p_farmer_id
      and public.can_manage_farmers_in_village(farmer.village_id)
  );
$$;

revoke execute on function public.can_manage_farmers_in_village(uuid) from public, anon;
revoke execute on function public.can_view_farmer(uuid) from public, anon;
revoke execute on function public.can_manage_farmer(uuid) from public, anon;
grant execute on function public.can_manage_farmers_in_village(uuid) to authenticated;
grant execute on function public.can_view_farmer(uuid) to authenticated;
grant execute on function public.can_manage_farmer(uuid) to authenticated;

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.tenant_crops enable row level security;
alter table public.farmers enable row level security;
alter table public.fields enable row level security;

revoke all on public.tenant_crops, public.farmers, public.fields from anon;

create policy tenant_crops_select_member on public.tenant_crops
for select to authenticated
using (public.is_organization_member(tenant_id));

create policy tenant_crops_write_organization_admin on public.tenant_crops
for all to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]))
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy farmers_select on public.farmers
for select to authenticated
using (
  public.can_manage_farmers_in_village(village_id)
  or (
    profile_id = auth.uid()
    and public.has_organization_role(tenant_id, array['farmer']::public.organization_role[])
  )
);

create policy farmers_insert on public.farmers
for insert to authenticated
with check (public.can_manage_farmers_in_village(village_id));

-- Using: may manage the farmer where they are now. Check: may manage them in
-- the (possibly new) village, so nobody moves a farmer out of reach of others
-- into a village they do not cover.
create policy farmers_update on public.farmers
for update to authenticated
using (public.can_manage_farmers_in_village(village_id))
with check (public.can_manage_farmers_in_village(village_id));

create policy farmers_delete_organization_admin on public.farmers
for delete to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy fields_select on public.fields
for select to authenticated
using (public.can_view_farmer(farmer_id));

create policy fields_insert on public.fields
for insert to authenticated
with check (public.can_manage_farmer(farmer_id));

create policy fields_update on public.fields
for update to authenticated
using (public.can_manage_farmer(farmer_id))
with check (public.can_manage_farmer(farmer_id));

create policy fields_delete on public.fields
for delete to authenticated
using (public.can_manage_farmer(farmer_id));

-- Column-level write limits: tenant and ownership links never change through
-- the API; registered_by, consent, and generated geometry are server-owned.
revoke insert, update on public.farmers from authenticated;
grant insert (id, tenant_id, village_id, full_name, phone, consent_recorded_at, is_active) on public.farmers to authenticated;
grant update (village_id, full_name, phone, is_active, updated_at) on public.farmers to authenticated;
-- profile_id linking is an organization-admin operation via RPC once logins exist.

revoke insert, update on public.fields from authenticated;
grant insert (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude, is_active) on public.fields to authenticated;
grant update (name, crop_id, area_acres, latitude, longitude, is_active, updated_at) on public.fields to authenticated;
