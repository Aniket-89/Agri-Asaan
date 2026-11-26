-- Regions cover districts and tehsils instead of pincodes (ADR 0023,
-- replacing the pincode matching of ADR 0021).
--
-- A region covers whole districts and/or single tehsils. A tehsil entry wins
-- over its district's entry, so one tehsil can belong to a different region
-- than the rest of its district. A self-registering farmer picks their tehsil
-- from the official list; the region follows from it. Farmers in places no
-- region covers still register and wait (visible to organization admins), and
-- join automatically when a region adds their district or tehsil. The
-- pincode stays part of the address but no longer decides the region.

-- ── Coverage ───────────────────────────────────────────────────────────────

create table public.region_districts (
  tenant_id uuid not null,
  region_id uuid not null,
  district_code integer not null references public.geo_districts (code),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, district_code),
  constraint region_districts_region_same_tenant
    foreign key (tenant_id, region_id) references public.regions (tenant_id, id) on delete cascade
);

create table public.region_subdistricts (
  tenant_id uuid not null,
  region_id uuid not null,
  subdistrict_code integer not null references public.geo_subdistricts (code),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, subdistrict_code),
  constraint region_subdistricts_region_same_tenant
    foreign key (tenant_id, region_id) references public.regions (tenant_id, id) on delete cascade
);

create index region_districts_region_idx on public.region_districts (tenant_id, region_id);
create index region_subdistricts_region_idx on public.region_subdistricts (tenant_id, region_id);

alter table public.region_districts enable row level security;
alter table public.region_subdistricts enable row level security;
revoke all on public.region_districts, public.region_subdistricts from anon, authenticated;
grant select, insert, delete on public.region_districts, public.region_subdistricts to authenticated;

-- Visible to whoever manages the region; changed only by organization admins.
create policy region_districts_select on public.region_districts
for select to authenticated using (public.can_manage_region(region_id));
create policy region_districts_insert on public.region_districts
for insert to authenticated
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));
create policy region_districts_delete on public.region_districts
for delete to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy region_subdistricts_select on public.region_subdistricts
for select to authenticated using (public.can_manage_region(region_id));
create policy region_subdistricts_insert on public.region_subdistricts
for insert to authenticated
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));
create policy region_subdistricts_delete on public.region_subdistricts
for delete to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

-- The active region covering a tehsil in an organization: the tehsil's own
-- entry first, else its district's entry. Null when nothing covers it.
create or replace function public.region_for_subdistrict(p_tenant_id uuid, p_subdistrict_code integer)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select coverage.region_id
      from public.region_subdistricts as coverage
      join public.regions as region on region.id = coverage.region_id and region.is_active
      where coverage.tenant_id = p_tenant_id and coverage.subdistrict_code = p_subdistrict_code
    ),
    (
      select coverage.region_id
      from public.geo_subdistricts as tehsil
      join public.region_districts as coverage
        on coverage.district_code = tehsil.district_code and coverage.tenant_id = p_tenant_id
      join public.regions as region on region.id = coverage.region_id and region.is_active
      where tehsil.code = p_subdistrict_code
    )
  );
$$;

revoke execute on function public.region_for_subdistrict(uuid, integer) from public, anon, authenticated;

-- ── Farmer tehsil ──────────────────────────────────────────────────────────

alter table public.farmers
  add column subdistrict_code integer references public.geo_subdistricts (code),
  drop constraint farmers_location_known,
  -- A village, or an address (with a tehsil, or a pincode from before
  -- ADR 0023) to place the farmer by.
  add constraint farmers_location_known
    check (
      village_id is not null
      or (locality is not null and address_line is not null and (subdistrict_code is not null or pincode is not null))
    );

create index farmers_tenant_subdistrict_idx on public.farmers (tenant_id, subdistrict_code);

grant update (subdistrict_code) on public.farmers to authenticated;

-- Adding coverage brings waiting farmers (no village) into the region. A
-- tehsil entry also moves farmers whose region came from a district entry,
-- since the tehsil entry wins.
create or replace function public.assign_waiting_farmers_by_district()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.farmers as farmer
  set region_id = new.region_id, updated_at = timezone('utc', now())
  from public.geo_subdistricts as tehsil
  where tehsil.code = farmer.subdistrict_code
    and tehsil.district_code = new.district_code
    and farmer.tenant_id = new.tenant_id
    and farmer.village_id is null
    and farmer.region_id is null
    and not exists (
      select 1 from public.region_subdistricts as own
      where own.tenant_id = new.tenant_id and own.subdistrict_code = farmer.subdistrict_code
    );
  return new;
end;
$$;

create or replace function public.assign_waiting_farmers_by_subdistrict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.farmers
  set region_id = new.region_id, updated_at = timezone('utc', now())
  where tenant_id = new.tenant_id
    and subdistrict_code = new.subdistrict_code
    and village_id is null;
  return new;
end;
$$;

revoke execute on function public.assign_waiting_farmers_by_district() from public, anon, authenticated;
revoke execute on function public.assign_waiting_farmers_by_subdistrict() from public, anon, authenticated;

create trigger assign_waiting_farmers after insert on public.region_districts
  for each row execute function public.assign_waiting_farmers_by_district();
create trigger assign_waiting_farmers after insert on public.region_subdistricts
  for each row execute function public.assign_waiting_farmers_by_subdistrict();

-- ── Pincode matching is retired ────────────────────────────────────────────
-- Farmers keep the region they were given; regions no longer list pincodes.

drop table public.region_pincodes;
drop function public.assign_waiting_farmers_to_region();

-- ── Self-registration with a tehsil ────────────────────────────────────────

drop function public.register_self_as_farmer(text, text, text, text, text, text, uuid);

-- The signed-in caller joins the hostname's organization as a farmer with
-- their tehsil and address. A listed village is optional; without one, the
-- region comes from the tehsil (or stays empty outside every region).
create function public.register_self_as_farmer(
  p_hostname text,
  p_full_name text,
  p_phone text,
  p_subdistrict_code integer,
  p_locality text,
  p_address_line text,
  p_pincode text,
  p_village_id uuid default null
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
  v_region_id uuid;
  v_farmer_id uuid;
begin
  if v_user_id is null then
    raise exception 'sign in to register' using errcode = '42501';
  end if;

  v_tenant_id := public.farmer_registration_tenant(p_hostname);
  if v_tenant_id is null then
    raise exception 'this site does not accept farmer registrations' using errcode = '42501';
  end if;

  if p_subdistrict_code is null
     or not exists (select 1 from public.geo_subdistricts where code = p_subdistrict_code) then
    raise exception 'choose your tehsil' using errcode = '22023';
  end if;

  if p_village_id is not null and not exists (
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

  if p_village_id is null then
    v_region_id := public.region_for_subdistrict(v_tenant_id, p_subdistrict_code);
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

  -- Locality, address and pincode formats are enforced by the table's checks.
  insert into public.farmers (
    tenant_id, village_id, region_id, subdistrict_code, full_name, phone, pincode, locality,
    address_line, profile_id, consent_recorded_at
  )
  values (
    v_tenant_id, p_village_id, v_region_id, p_subdistrict_code, btrim(p_full_name), p_phone,
    nullif(btrim(coalesce(p_pincode, '')), ''), btrim(p_locality), btrim(p_address_line), v_user_id,
    timezone('utc', now())
  )
  returning id into v_farmer_id;

  update public.profiles
  set full_name = btrim(p_full_name)
  where id = v_user_id
    and (full_name is null or btrim(full_name) = '');

  return v_farmer_id;
end;
$$;

revoke execute on function public.register_self_as_farmer(text, text, text, integer, text, text, text, uuid) from public, anon;
grant execute on function public.register_self_as_farmer(text, text, text, integer, text, text, text, uuid) to authenticated;

-- ── Pilot job list: tehsil in the address ──────────────────────────────────
-- Same columns as before; the fallback address now includes the tehsil.

create or replace function public.farmer_address_label(p_farmer_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select concat_ws(', ', farmer.locality, farmer.address_line, tehsil.name, district.name, farmer.pincode)
  from public.farmers as farmer
  left join public.geo_subdistricts as tehsil on tehsil.code = farmer.subdistrict_code
  left join public.geo_districts as district on district.code = tehsil.district_code
  where farmer.id = p_farmer_id;
$$;

revoke execute on function public.farmer_address_label(uuid) from public, anon, authenticated;

create or replace function public.list_my_jobs(p_tenant_id uuid)
returns table (
  booking_id uuid,
  status public.booking_status,
  preferred_date date,
  slot_name_en text,
  slot_name_hi text,
  start_time time,
  end_time time,
  farmer_name text,
  farmer_phone text,
  village_name text,
  total_acres numeric,
  drone_uid text,
  notes text,
  actual_total_acres numeric,
  sent_back_reason text,
  amount_due numeric,
  paid_at timestamptz,
  fields jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    booking.id,
    booking.status,
    booking.preferred_date,
    slot.name_en,
    slot.name_hi,
    slot.start_time,
    slot.end_time,
    farmer.full_name,
    farmer.phone,
    coalesce(village.name, public.farmer_address_label(farmer.id)),
    booking.total_acres,
    drone.uid,
    booking.notes,
    booking.actual_total_acres,
    case when booking.status = 'in_progress' then (
      select history.reason from public.booking_status_history as history
      where history.booking_id = booking.id
        and history.from_status = 'completed'
        and history.to_status = 'in_progress'
      order by history.id desc
      limit 1
    ) end,
    booking.amount_due,
    booking.paid_at,
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'field_id', line.field_id,
        'field_name', line.field_name,
        'crop_name_en', line.crop_name_en,
        'crop_name_hi', line.crop_name_hi,
        'area_acres', line.area_acres,
        'actual_acres', line.actual_acres,
        'latitude', line.latitude,
        'longitude', line.longitude
      ) order by line.field_name), '[]'::jsonb)
      from public.booking_fields as line
      where line.booking_id = booking.id
    )
  from public.booking_assignments as assignment
  join public.bookings as booking on booking.id = assignment.booking_id
  join public.spray_slots as slot on slot.id = booking.slot_id
  join public.farmers as farmer on farmer.id = booking.farmer_id
  left join public.villages as village on village.id = booking.village_id
  join public.drones as drone on drone.id = assignment.drone_id
  where assignment.tenant_id = p_tenant_id
    and assignment.pilot_user_id = auth.uid()
    and assignment.is_current
    and (
      booking.status = 'in_progress'
      or (booking.status = 'assigned' and booking.preferred_date >= public.tenant_local_now(p_tenant_id)::date)
      or (
        booking.status in ('completed', 'verified')
        and booking.preferred_date >= public.tenant_local_now(p_tenant_id)::date - 60
      )
    )
    and public.has_organization_role(p_tenant_id, array['pilot']::public.organization_role[])
  order by booking.preferred_date, slot.start_time;
$$;
