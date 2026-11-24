-- Organization-defined spraying slots and availability-aware booking
-- (ADR 0013).
--
-- A booking now reserves a date + slot. Capacity for a region, date, and slot
-- is the smaller of its available pilots and active drones (by home region),
-- minus open bookings already holding that slot. Farmers and mitras see the
-- remaining places before booking; create_booking re-checks under a lock so
-- the last place cannot be taken twice. Assigning a specific pilot and drone
-- (with an overlap exclusion constraint) comes with assignment.

create table public.spray_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  name_en text not null,
  name_hi text not null,
  -- Local times in the organization's timezone (organization_settings.timezone).
  start_time time not null,
  end_time time not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint spray_slots_time_order check (start_time < end_time),
  constraint spray_slots_names check (
    btrim(name_en) <> '' and btrim(name_hi) <> ''
    and char_length(name_en) <= 60 and char_length(name_hi) <= 60
  ),
  constraint spray_slots_tenant_times_unique unique (tenant_id, start_time, end_time),
  constraint spray_slots_tenant_id_id_unique unique (tenant_id, id)
);

alter table public.spray_slots enable row level security;
revoke all on public.spray_slots from anon;

create policy spray_slots_select_member on public.spray_slots
for select to authenticated
using (public.is_organization_member(tenant_id));

create policy spray_slots_insert_organization_admin on public.spray_slots
for insert to authenticated
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

create policy spray_slots_update_organization_admin on public.spray_slots
for update to authenticated
using (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]))
with check (public.has_organization_role(tenant_id, array['organization_admin']::public.organization_role[]));

-- Slot times are fixed once created: bookings reserve them. To change a slot,
-- create a new one and deactivate the old. Slots are never deleted.
revoke insert, update, delete on public.spray_slots from authenticated;
grant insert (tenant_id, name_en, name_hi, start_time, end_time, sort_order, is_active) on public.spray_slots to authenticated;
grant update (name_en, name_hi, sort_order, is_active, updated_at) on public.spray_slots to authenticated;

-- Bookings reserve a slot. Existing bookings made before slots stay valid.
alter table public.bookings
  add column slot_id uuid,
  add constraint bookings_slot_same_tenant
    foreign key (tenant_id, slot_id) references public.spray_slots (tenant_id, id);

create index bookings_slot_capacity_idx on public.bookings (tenant_id, region_id, preferred_date, slot_id, status);

-- ── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.tenant_local_now(p_tenant_id uuid)
returns timestamp
language sql
stable
security definer
set search_path = ''
as $$
  select now() at time zone coalesce(
    (select settings.timezone from public.organization_settings as settings where settings.tenant_id = p_tenant_id),
    'Asia/Kolkata'
  );
$$;

revoke execute on function public.tenant_local_now(uuid) from public, anon, authenticated;

-- Null-safe: may the caller book for this farmer? (manager of the farmer's
-- village, or the farmer's own linked login)
create or replace function public.can_book_for_farmer(p_farmer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      public.can_manage_farmer(farmer.id)
      or (
        farmer.profile_id is not distinct from auth.uid()
        and public.has_organization_role(farmer.tenant_id, array['farmer']::public.organization_role[])
      )
    from public.farmers as farmer
    where farmer.id = p_farmer_id
  ), false);
$$;

revoke execute on function public.can_book_for_farmer(uuid) from public, anon;
grant execute on function public.can_book_for_farmer(uuid) to authenticated;

-- Remaining places for a region, date, and slot. Internal only.
create or replace function public.slot_remaining_capacity(p_region_id uuid, p_date date, p_slot_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0,
    least(
      (
        select count(*) from public.pilot_profiles as pilot
        join public.organization_members as member
          on member.organization_id = pilot.tenant_id and member.user_id = pilot.user_id and member.role = 'pilot'
        where pilot.home_region_id = p_region_id and pilot.is_active
      ),
      (
        select count(*) from public.drones as drone
        where drone.home_region_id = p_region_id and drone.status = 'active'
      )
    )
    - (
      select count(*) from public.bookings as booking
      where booking.region_id = p_region_id
        and booking.preferred_date = p_date
        and booking.slot_id = p_slot_id
        and booking.status in ('requested', 'confirmed', 'assigned', 'in_progress')
    )
  )::integer;
$$;

revoke execute on function public.slot_remaining_capacity(uuid, date, uuid) from public, anon, authenticated;

-- ── list_slot_availability ─────────────────────────────────────────────────
-- Active slots of the farmer's organization for a date, with remaining
-- places in the farmer's region. Slots that already started today show 0.
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
  select village.region_id into v_region_id from public.villages as village where village.id = v_farmer.village_id;
  v_now := public.tenant_local_now(v_farmer.tenant_id);

  if p_date is null or p_date < v_now::date or p_date > v_now::date + 60 then
    raise exception 'date must be within the next 60 days' using errcode = '23514', hint = 'date_out_of_range';
  end if;

  return query
  select
    slot.id, slot.name_en, slot.name_hi, slot.start_time, slot.end_time,
    case
      when p_date = v_now::date and slot.start_time <= v_now::time then 0
      else public.slot_remaining_capacity(v_region_id, p_date, slot.id)
    end
  from public.spray_slots as slot
  where slot.tenant_id = v_farmer.tenant_id and slot.is_active
  order by slot.sort_order, slot.start_time;
end;
$$;

revoke execute on function public.list_slot_availability(uuid, date) from public, anon;
grant execute on function public.list_slot_availability(uuid, date) to authenticated;

-- ── create_booking (now reserves a slot) ───────────────────────────────────
-- Adds to the earlier contract: 23514 HINT invalid_slot, slot_full.

drop function public.create_booking(uuid, uuid, uuid[], date, text);

create function public.create_booking(
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

  select village.region_id into v_region_id from public.villages as village where village.id = v_farmer.village_id;

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

revoke execute on function public.create_booking(uuid, uuid, uuid[], date, uuid, text) from public, anon;
grant execute on function public.create_booking(uuid, uuid, uuid[], date, uuid, text) to authenticated;
