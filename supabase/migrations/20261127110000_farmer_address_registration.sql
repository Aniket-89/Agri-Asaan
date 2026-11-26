-- Farmers register with an address; the region comes from the pincode
-- (ADR 0021).
--
-- Service areas are regions (for example Mathura and the villages around it).
-- A farmer whose village is not listed yet still registers with pincode,
-- village or town name, and address. The pincode decides the region, so the
-- region's admins see the farmer and the farmer can book against that
-- region's capacity. A regional admin later places the farmer in a village,
-- after which the village's mitras see them too. Farmers whose pincode is in
-- no region are visible only to organization admins ("outside service area")
-- until a region covers the pincode.

-- ── Pincodes covered by each region ────────────────────────────────────────

create table public.region_pincodes (
  tenant_id uuid not null,
  region_id uuid not null,
  pincode text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, pincode),
  constraint region_pincodes_region_same_tenant
    foreign key (tenant_id, region_id) references public.regions (tenant_id, id) on delete cascade,
  constraint region_pincodes_pincode_format check (pincode ~ '^[1-9][0-9]{5}$')
);

create index region_pincodes_region_idx on public.region_pincodes (tenant_id, region_id);

alter table public.region_pincodes enable row level security;
revoke all on public.region_pincodes from anon, authenticated;
grant select, insert, delete on public.region_pincodes to authenticated;

-- Visible to whoever manages the region; changed only by organization admins.
create policy region_pincodes_select on public.region_pincodes
for select to authenticated
using (public.can_manage_region(region_id));

create policy region_pincodes_insert_organization_admin on public.region_pincodes
for insert to authenticated
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy region_pincodes_delete_organization_admin on public.region_pincodes
for delete to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

-- ── Farmer address and region ──────────────────────────────────────────────

alter table public.farmers
  alter column village_id drop not null,
  add column region_id uuid,
  add column pincode text,
  add column locality text,
  add column address_line text,
  add constraint farmers_region_same_tenant
    foreign key (tenant_id, region_id) references public.regions (tenant_id, id),
  add constraint farmers_pincode_format check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  add constraint farmers_locality_length
    check (locality is null or (btrim(locality) <> '' and char_length(locality) <= 120)),
  add constraint farmers_address_line_length
    check (address_line is null or (btrim(address_line) <> '' and char_length(address_line) <= 300)),
  -- Every farmer is either placed in a village or has an address to place them by.
  add constraint farmers_location_known
    check (village_id is not null or (pincode is not null and locality is not null and address_line is not null));

update public.farmers as farmer
set region_id = village.region_id
from public.villages as village
where village.id = farmer.village_id;

create index farmers_tenant_region_idx on public.farmers (tenant_id, region_id);
create index farmers_tenant_pincode_idx on public.farmers (tenant_id, pincode);

-- A placed farmer's region is always their village's region.
create or replace function public.set_farmer_region()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.village_id is not null then
    select village.region_id into new.region_id
    from public.villages as village
    where village.id = new.village_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.set_farmer_region() from public, anon, authenticated;

create trigger set_farmer_region before insert or update of village_id, region_id on public.farmers
  for each row execute function public.set_farmer_region();

-- Adding a pincode to a region brings waiting farmers with that pincode into it.
create or replace function public.assign_waiting_farmers_to_region()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.farmers
  set region_id = new.region_id, updated_at = timezone('utc', now())
  where tenant_id = new.tenant_id
    and pincode = new.pincode
    and village_id is null
    and region_id is null;
  return new;
end;
$$;

revoke execute on function public.assign_waiting_farmers_to_region() from public, anon, authenticated;

create trigger assign_waiting_farmers after insert on public.region_pincodes
  for each row execute function public.assign_waiting_farmers_to_region();

-- ── Who may manage a farmer ────────────────────────────────────────────────
-- Placed: the village's managers and mitras, as before. Not placed yet: the
-- region's managers. No region: organization admins only.
create or replace function public.can_manage_farmer_location(
  p_tenant_id uuid,
  p_village_id uuid,
  p_region_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_village_id is not null then public.can_manage_farmers_in_village(p_village_id)
    when p_region_id is not null then public.can_manage_region(p_region_id)
    else public.has_organization_role(p_tenant_id, array['organization_admin']::public.organization_role[])
  end;
$$;

revoke execute on function public.can_manage_farmer_location(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_manage_farmer_location(uuid, uuid, uuid) to authenticated;

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
        public.can_manage_farmer_location(farmer.tenant_id, farmer.village_id, farmer.region_id)
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
      and public.can_manage_farmer_location(farmer.tenant_id, farmer.village_id, farmer.region_id)
  );
$$;

drop policy farmers_select on public.farmers;
create policy farmers_select on public.farmers
for select to authenticated
using (
  public.can_manage_farmer_location(tenant_id, village_id, region_id)
  or (
    profile_id = auth.uid()
    and public.has_organization_role(tenant_id, array['farmer']::public.organization_role[])
  )
);

drop policy farmers_insert on public.farmers;
create policy farmers_insert on public.farmers
for insert to authenticated
with check (public.can_manage_farmer_location(tenant_id, village_id, region_id));

-- Using: may manage the farmer where they are now. Check: may manage them
-- where they end up, so nobody moves a farmer into a village they don't cover.
drop policy farmers_update on public.farmers;
create policy farmers_update on public.farmers
for update to authenticated
using (public.can_manage_farmer_location(tenant_id, village_id, region_id))
with check (public.can_manage_farmer_location(tenant_id, village_id, region_id));

-- Address fields can be corrected by the farmer's managers; the region is
-- never written by clients (village trigger, pincode trigger, or the
-- registration function set it).
grant update (pincode, locality, address_line) on public.farmers to authenticated;

-- ── Self-registration with an address ──────────────────────────────────────

-- Whether a hostname's organization accepts farmer sign-ups. Reveals nothing
-- else about the organization.
create or replace function public.farmer_registration_open(p_hostname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.farmer_registration_tenant(p_hostname) is not null;
$$;

revoke execute on function public.farmer_registration_open(text) from public;
grant execute on function public.farmer_registration_open(text) to anon, authenticated;

drop function public.register_self_as_farmer(text, uuid, text, text);

-- The signed-in caller joins the hostname's organization as a farmer with an
-- address. A listed village is optional; without one, the region comes from
-- the pincode (or stays empty outside every service area).
create function public.register_self_as_farmer(
  p_hostname text,
  p_full_name text,
  p_phone text,
  p_pincode text,
  p_locality text,
  p_address_line text,
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
  v_pincode text := btrim(coalesce(p_pincode, ''));
begin
  if v_user_id is null then
    raise exception 'sign in to register' using errcode = '42501';
  end if;

  v_tenant_id := public.farmer_registration_tenant(p_hostname);
  if v_tenant_id is null then
    raise exception 'this site does not accept farmer registrations' using errcode = '42501';
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
    select pin.region_id into v_region_id
    from public.region_pincodes as pin
    join public.regions as region on region.id = pin.region_id
    where pin.tenant_id = v_tenant_id
      and pin.pincode = v_pincode
      and region.is_active;
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

  -- Pincode, locality and address formats are enforced by the table's checks.
  insert into public.farmers (
    tenant_id, village_id, region_id, full_name, phone, pincode, locality, address_line,
    profile_id, consent_recorded_at
  )
  values (
    v_tenant_id, p_village_id, v_region_id, btrim(p_full_name), p_phone, v_pincode,
    btrim(p_locality), btrim(p_address_line), v_user_id, timezone('utc', now())
  )
  returning id into v_farmer_id;

  update public.profiles
  set full_name = btrim(p_full_name)
  where id = v_user_id
    and (full_name is null or btrim(full_name) = '');

  return v_farmer_id;
end;
$$;

revoke execute on function public.register_self_as_farmer(text, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.register_self_as_farmer(text, text, text, text, text, text, uuid) to authenticated;

-- ── Bookings use the farmer's region ───────────────────────────────────────

alter table public.bookings alter column village_id drop not null;

-- The region a farmer books against: their village's region, else the region
-- their pincode placed them in. Null outside every service area.
create or replace function public.farmer_service_region(p_farmer_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(village.region_id, farmer.region_id)
  from public.farmers as farmer
  left join public.villages as village on village.id = farmer.village_id
  where farmer.id = p_farmer_id;
$$;

revoke execute on function public.farmer_service_region(uuid) from public, anon, authenticated;

-- Same contract as before; a farmer outside every service area sees no
-- available places.
create or replace function public.list_slot_availability(p_farmer_id uuid, p_date date)
returns table (
  slot_id uuid,
  name_en text,
  name_hi text,
  start_time time,
  end_time time,
  available integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_farmer public.farmers%rowtype;
  v_region_id uuid;
  v_now timestamp;
begin
  if auth.uid() is null or not public.can_book_for_farmer(p_farmer_id) then
    raise exception 'not allowed to book for this farmer' using errcode = '42501';
  end if;

  select * into v_farmer from public.farmers where id = p_farmer_id;
  v_region_id := public.farmer_service_region(p_farmer_id);
  v_now := public.tenant_local_now(v_farmer.tenant_id);

  if p_date is null or p_date < v_now::date or p_date > v_now::date + 60 then
    raise exception 'date must be within the next 60 days' using errcode = '23514', hint = 'date_out_of_range';
  end if;

  return query
  select
    slot.id, slot.name_en, slot.name_hi, slot.start_time, slot.end_time,
    case
      when v_region_id is null then 0
      when p_date = v_now::date and slot.start_time <= v_now::time then 0
      else public.slot_remaining_capacity(v_region_id, p_date, slot.id)
    end
  from public.spray_slots as slot
  where slot.tenant_id = v_farmer.tenant_id and slot.is_active
  order by slot.sort_order, slot.start_time;
end;
$$;

-- Same contract as before, plus 23514 HINT no_service_area for a farmer whose
-- pincode is in no region and who is not placed in a village.
create or replace function public.create_booking(
  p_booking_id uuid,
  p_farmer_id uuid,
  p_field_ids uuid[],
  p_preferred_date date,
  p_slot_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_farmer public.farmers%rowtype;
  v_existing public.bookings%rowtype;
  v_slot public.spray_slots%rowtype;
  v_now timestamp;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_field_count integer := coalesce(cardinality(p_field_ids), 0);
  v_region_id uuid;
  v_total numeric(10, 2);
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Idempotent retry: the same id for the same farmer returns the booking.
  select * into v_existing from public.bookings where id = p_booking_id;
  if found then
    if v_existing.farmer_id = p_farmer_id and public.can_view_booking(p_booking_id) then
      return p_booking_id;
    end if;
    raise exception 'booking id already used' using errcode = '23505';
  end if;

  -- Same error whether the farmer is missing or out of scope.
  if not public.can_book_for_farmer(p_farmer_id) then
    raise exception 'not allowed to book for this farmer' using errcode = '42501';
  end if;
  select * into v_farmer from public.farmers where id = p_farmer_id;
  v_now := public.tenant_local_now(v_farmer.tenant_id);

  if not v_farmer.is_active then
    raise exception 'farmer is inactive' using errcode = '23514', hint = 'farmer_inactive';
  end if;

  v_region_id := public.farmer_service_region(p_farmer_id);
  if v_region_id is null then
    raise exception 'this address is outside the service area' using errcode = '23514', hint = 'no_service_area';
  end if;

  if v_field_count = 0 or v_field_count > 20
     or (select count(distinct field_id) from unnest(p_field_ids) as field_id) <> v_field_count then
    raise exception 'choose between 1 and 20 different fields' using errcode = '23514', hint = 'invalid_fields';
  end if;
  if p_preferred_date is null or p_preferred_date < v_now::date or p_preferred_date > v_now::date + 60 then
    raise exception 'preferred date must be within the next 60 days' using errcode = '23514', hint = 'date_out_of_range';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'notes are too long' using errcode = '23514', hint = 'invalid_notes';
  end if;

  select * into v_slot from public.spray_slots
  where id = p_slot_id and tenant_id = v_farmer.tenant_id and is_active;
  if not found or (p_preferred_date = v_now::date and v_slot.start_time <= v_now::time) then
    raise exception 'choose an available slot' using errcode = '23514', hint = 'invalid_slot';
  end if;

  -- Lock the fields so two concurrent requests cannot both book one field.
  perform 1 from public.fields where id = any(p_field_ids) for update;

  if (
    select count(*) from public.fields as field
    where field.id = any(p_field_ids)
      and field.farmer_id = p_farmer_id
      and field.tenant_id = v_farmer.tenant_id
      and field.is_active
  ) <> v_field_count then
    raise exception 'fields must be active fields of this farmer' using errcode = '23514', hint = 'invalid_fields';
  end if;

  if exists (
    select 1
    from public.booking_fields as line
    join public.bookings as booking on booking.id = line.booking_id
    where line.field_id = any(p_field_ids)
      and booking.status in ('requested', 'confirmed', 'assigned', 'in_progress')
  ) then
    raise exception 'a field already has an open booking' using errcode = '23514', hint = 'field_already_booked';
  end if;

  -- Serialize bookings for this region, date, and slot so the last place
  -- cannot be taken twice.
  perform pg_advisory_xact_lock(
    hashtextextended('slot:' || v_region_id::text || ':' || p_preferred_date::text || ':' || p_slot_id::text, 0)
  );
  if public.slot_remaining_capacity(v_region_id, p_preferred_date, p_slot_id) <= 0 then
    raise exception 'this slot is full' using errcode = '23514', hint = 'slot_full';
  end if;

  select sum(field.area_acres) into v_total from public.fields as field where field.id = any(p_field_ids);

  insert into public.bookings (
    id, tenant_id, farmer_id, village_id, region_id, status, preferred_date, slot_id, notes, total_acres, requested_by
  )
  values (
    p_booking_id, v_farmer.tenant_id, p_farmer_id, v_farmer.village_id, v_region_id,
    'requested', p_preferred_date, p_slot_id, v_notes, v_total, v_caller
  );

  insert into public.booking_fields (
    tenant_id, booking_id, farmer_id, field_id, field_name,
    crop_code, crop_name_en, crop_name_hi, area_acres, latitude, longitude
  )
  select
    v_farmer.tenant_id, p_booking_id, p_farmer_id, field.id, field.name,
    crop.code, crop.name_en, crop.name_hi, field.area_acres, field.latitude, field.longitude
  from public.fields as field
  join public.tenant_crops as crop on crop.id = field.crop_id
  where field.id = any(p_field_ids);

  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, actor_id)
  values (v_farmer.tenant_id, p_booking_id, null, 'requested', v_caller);

  return p_booking_id;
end;
$$;

-- ── Pilot job list: address when there is no village ───────────────────────
-- Same columns as before; village_name falls back to the farmer's village or
-- town name and pincode, so jobs for farmers not placed yet still appear.
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
    coalesce(village.name, concat_ws(', ', farmer.locality, farmer.address_line, farmer.pincode)),
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

-- ── Placing a farmer updates their open bookings ───────────────────────────
-- Open bookings made before the farmer had a village take the new village,
-- so its mitras see them too. Closed bookings stay as they were.
create or replace function public.place_farmer_open_bookings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $func$
begin
  if old.village_id is null and new.village_id is not null then
    update public.bookings
    set village_id = new.village_id, updated_at = timezone('utc', now())
    where farmer_id = new.id
      and village_id is null
      and status in ('requested', 'confirmed', 'assigned', 'in_progress');
  end if;
  return new;
end;
$func$;

revoke execute on function public.place_farmer_open_bookings() from public, anon, authenticated;

create trigger place_farmer_open_bookings after update of village_id on public.farmers
  for each row execute function public.place_farmer_open_bookings();
