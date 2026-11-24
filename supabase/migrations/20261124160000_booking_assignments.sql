-- Assigning a pilot and drone to a booking (ADR 0014).
--
-- A region manager (organization admin, or the regional admin of the
-- booking's region) assigns one pilot and one drone of the same organization
-- to a confirmed booking, for the booking's date and slot. Pilots and drones
-- may be borrowed from other regions. Exclusion constraints guarantee that a
-- pilot, or a drone, is never in two overlapping slots, even under concurrent
-- assignment. Reassigning ends the current assignment and keeps it as
-- history. Clients never write booking_assignments directly: assign_booking
-- is the only write path.

create extension if not exists btree_gist with schema extensions;

create table public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  booking_id uuid not null,
  pilot_user_id uuid not null,
  drone_id uuid not null,
  -- The booking's date + slot as absolute time, in the organization's timezone.
  work_period tstzrange not null,
  is_current boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  constraint booking_assignments_booking_same_tenant
    foreign key (tenant_id, booking_id) references public.bookings (tenant_id, id) on delete cascade,
  -- Job history must survive: a pilot or drone with assignments cannot be
  -- deleted (deactivate it instead).
  constraint booking_assignments_pilot_same_tenant
    foreign key (tenant_id, pilot_user_id) references public.pilot_profiles (tenant_id, user_id),
  constraint booking_assignments_drone_same_tenant
    foreign key (tenant_id, drone_id) references public.drones (tenant_id, id),
  constraint booking_assignments_period_valid
    check (not isempty(work_period) and lower(work_period) is not null and upper(work_period) is not null),
  constraint booking_assignments_current_not_ended check (is_current = (ended_at is null)),
  -- A person or airframe cannot be in two places at once, so these hold
  -- across organizations too.
  constraint booking_assignments_pilot_no_overlap
    exclude using gist (pilot_user_id with =, work_period with &&) where (is_current),
  constraint booking_assignments_drone_no_overlap
    exclude using gist (drone_id with =, work_period with &&) where (is_current)
);

create unique index booking_assignments_one_current_idx
  on public.booking_assignments (booking_id) where is_current;
create index booking_assignments_booking_idx on public.booking_assignments (booking_id, assigned_at);
create index booking_assignments_tenant_pilot_idx on public.booking_assignments (tenant_id, pilot_user_id);
create index booking_assignments_tenant_drone_idx on public.booking_assignments (tenant_id, drone_id);
create index booking_assignments_assigned_by_idx on public.booking_assignments (assigned_by);

-- ── Helpers (internal) ─────────────────────────────────────────────────────

-- A booking's date + slot as an absolute time range.
create or replace function public.booking_work_period(p_tenant_id uuid, p_date date, p_start time, p_end time)
returns tstzrange
language sql
stable
security definer
set search_path = ''
as $$
  with zone as (
    select coalesce(
      (select settings.timezone from public.organization_settings as settings where settings.tenant_id = p_tenant_id),
      'Asia/Kolkata'
    ) as name
  )
  select tstzrange((p_date + p_start) at time zone zone.name, (p_date + p_end) at time zone zone.name, '[)')
  from zone;
$$;

revoke execute on function public.booking_work_period(uuid, date, time, time) from public, anon, authenticated;

-- ── Visibility ─────────────────────────────────────────────────────────────
-- Adds the currently assigned pilot to the viewers of a booking.

create or replace function public.can_view_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings as booking
    join public.farmers as farmer on farmer.id = booking.farmer_id
    where booking.id = p_booking_id
      and (
        public.can_manage_region(booking.region_id)
        or public.is_mitra_for_village(booking.village_id)
        or (booking.requested_by = auth.uid() and public.is_organization_member(booking.tenant_id))
        or (
          farmer.profile_id = auth.uid()
          and public.has_organization_role(booking.tenant_id, array['farmer']::public.organization_role[])
        )
        or (
          exists (
            select 1 from public.booking_assignments as assignment
            where assignment.booking_id = booking.id
              and assignment.is_current
              and assignment.pilot_user_id = auth.uid()
          )
          and public.has_organization_role(booking.tenant_id, array['pilot']::public.organization_role[])
        )
      )
  );
$$;

alter table public.booking_assignments enable row level security;
revoke all on public.booking_assignments from anon, authenticated;
grant select on public.booking_assignments to authenticated;

create policy booking_assignments_select on public.booking_assignments
for select to authenticated
using (public.can_view_booking(booking_id));

-- ── list_assignment_options ────────────────────────────────────────────────
-- Pilots and drones of the booking's organization that are available and
-- free for the booking's date and slot. Home-region ones first.
-- Error contract: P0002 = not found / not visible, 42501 = not a region
-- manager, 23514 HINT invalid_slot (booking has no slot).

create or replace function public.list_assignment_options(p_booking_id uuid)
returns table (
  kind text,
  id uuid,
  label text,
  region_name text,
  is_home_region boolean,
  is_current boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot public.spray_slots%rowtype;
  v_period tstzrange;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where bookings.id = p_booking_id;
  if not found or not public.can_view_booking(p_booking_id) then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if not coalesce(public.can_manage_region(v_booking.region_id), false) then
    raise exception 'only a region manager can assign' using errcode = '42501';
  end if;

  select * into v_slot from public.spray_slots where spray_slots.id = v_booking.slot_id;
  if not found then
    raise exception 'booking has no slot' using errcode = '23514', hint = 'invalid_slot';
  end if;
  v_period := public.booking_work_period(v_booking.tenant_id, v_booking.preferred_date, v_slot.start_time, v_slot.end_time);

  return query
  select
    'pilot'::text,
    pilot.user_id,
    coalesce(nullif(btrim(profile.full_name), ''), '—'),
    region.name,
    pilot.home_region_id is not distinct from v_booking.region_id,
    exists (
      select 1 from public.booking_assignments as mine
      where mine.booking_id = p_booking_id and mine.is_current and mine.pilot_user_id = pilot.user_id
    )
  from public.pilot_profiles as pilot
  join public.organization_members as member
    on member.organization_id = pilot.tenant_id and member.user_id = pilot.user_id and member.role = 'pilot'
  join public.profiles as profile on profile.id = pilot.user_id
  left join public.regions as region on region.id = pilot.home_region_id
  where pilot.tenant_id = v_booking.tenant_id
    and pilot.is_active
    and not exists (
      select 1 from public.booking_assignments as other
      where other.pilot_user_id = pilot.user_id
        and other.is_current
        and other.booking_id <> p_booking_id
        and other.work_period && v_period
    )
  union all
  select
    'drone'::text,
    drone.id,
    drone.uid || ' · ' || drone.model,
    region.name,
    drone.home_region_id is not distinct from v_booking.region_id,
    exists (
      select 1 from public.booking_assignments as mine
      where mine.booking_id = p_booking_id and mine.is_current and mine.drone_id = drone.id
    )
  from public.drones as drone
  left join public.regions as region on region.id = drone.home_region_id
  where drone.tenant_id = v_booking.tenant_id
    and drone.status = 'active'
    and not exists (
      select 1 from public.booking_assignments as other
      where other.drone_id = drone.id
        and other.is_current
        and other.booking_id <> p_booking_id
        and other.work_period && v_period
    )
  order by 1, 5 desc, 3;
end;
$$;

revoke execute on function public.list_assignment_options(uuid) from public, anon;
grant execute on function public.list_assignment_options(uuid) to authenticated;

-- ── assign_booking ─────────────────────────────────────────────────────────
-- confirmed -> assigned, or reassign while assigned. Writes status history in
-- the same transaction. Submitting the current pilot and drone again is a
-- no-op, so a retried form is harmless.
-- Error contract: P0002 = not found / not visible, 42501 = not a region
-- manager, 23514 + HINT (invalid_transition, invalid_slot, slot_passed,
-- pilot_unavailable, drone_unavailable, pilot_busy, drone_busy).

create or replace function public.assign_booking(
  p_booking_id uuid,
  p_pilot_user_id uuid,
  p_drone_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_slot public.spray_slots%rowtype;
  v_current public.booking_assignments%rowtype;
  v_period tstzrange;
  v_constraint text;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or not public.can_view_booking(p_booking_id) then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if not coalesce(public.can_manage_region(v_booking.region_id), false) then
    raise exception 'only a region manager can assign' using errcode = '42501';
  end if;
  if v_booking.status not in ('confirmed', 'assigned') then
    raise exception 'only confirmed bookings can be assigned' using errcode = '23514', hint = 'invalid_transition';
  end if;

  select * into v_slot from public.spray_slots where id = v_booking.slot_id;
  if not found then
    raise exception 'booking has no slot' using errcode = '23514', hint = 'invalid_slot';
  end if;
  v_period := public.booking_work_period(v_booking.tenant_id, v_booking.preferred_date, v_slot.start_time, v_slot.end_time);
  if upper(v_period) <= now() then
    raise exception 'this slot has already ended' using errcode = '23514', hint = 'slot_passed';
  end if;

  if not exists (
    select 1 from public.pilot_profiles as pilot
    join public.organization_members as member
      on member.organization_id = pilot.tenant_id and member.user_id = pilot.user_id and member.role = 'pilot'
    where pilot.tenant_id = v_booking.tenant_id and pilot.user_id = p_pilot_user_id and pilot.is_active
  ) then
    raise exception 'pilot is not available' using errcode = '23514', hint = 'pilot_unavailable';
  end if;
  if not exists (
    select 1 from public.drones as drone
    where drone.tenant_id = v_booking.tenant_id and drone.id = p_drone_id and drone.status = 'active'
  ) then
    raise exception 'drone is not available' using errcode = '23514', hint = 'drone_unavailable';
  end if;

  select * into v_current from public.booking_assignments
  where booking_id = p_booking_id and is_current
  for update;
  if found and v_current.pilot_user_id = p_pilot_user_id and v_current.drone_id = p_drone_id then
    return;
  end if;

  if found then
    update public.booking_assignments
    set is_current = false, ended_at = timezone('utc', now())
    where id = v_current.id;
  end if;

  -- The exclusion constraints are the guarantee; this only turns a clash into
  -- a readable rule violation.
  begin
    insert into public.booking_assignments (tenant_id, booking_id, pilot_user_id, drone_id, work_period, assigned_by)
    values (v_booking.tenant_id, p_booking_id, p_pilot_user_id, p_drone_id, v_period, v_caller);
  exception when exclusion_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'booking_assignments_pilot_no_overlap' then
      raise exception 'pilot already has a job in this slot' using errcode = '23514', hint = 'pilot_busy';
    end if;
    raise exception 'drone already has a job in this slot' using errcode = '23514', hint = 'drone_busy';
  end;

  update public.bookings
  set status = 'assigned', updated_at = timezone('utc', now())
  where id = p_booking_id;

  -- A reassignment is recorded as assigned -> assigned.
  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, actor_id)
  values (v_booking.tenant_id, p_booking_id, v_booking.status, 'assigned', v_caller);
end;
$$;

revoke execute on function public.assign_booking(uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_booking(uuid, uuid, uuid) to authenticated;

-- ── set_booking_status ─────────────────────────────────────────────────────
-- Adds: assigned -> cancelled (region manager). Cancelling ends the current
-- assignment, freeing the pilot and drone for that slot.

create or replace function public.set_booking_status(
  p_booking_id uuid,
  p_to_status public.booking_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_is_manager boolean;
  v_is_requester boolean;
  v_is_farmer boolean;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or not public.can_view_booking(p_booking_id) then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'reason is too long' using errcode = '23514', hint = 'invalid_reason';
  end if;

  -- All three flags must be true/false, never NULL: a NULL would make the
  -- permission checks below silently pass.
  v_is_manager := coalesce(public.can_manage_region(v_booking.region_id), false);
  v_is_requester := v_booking.requested_by is not distinct from v_caller;
  v_is_farmer := exists (
    select 1 from public.farmers as farmer
    where farmer.id = v_booking.farmer_id and farmer.profile_id = v_caller
  ) and public.has_organization_role(v_booking.tenant_id, array['farmer']::public.organization_role[]);

  if v_booking.status = 'requested' and p_to_status = 'confirmed' then
    if not v_is_manager then
      raise exception 'only a region manager can confirm' using errcode = '42501';
    end if;
  elsif v_booking.status = 'requested' and p_to_status = 'rejected' then
    if not v_is_manager then
      raise exception 'only a region manager can reject' using errcode = '42501';
    end if;
    if v_reason is null then
      raise exception 'a reason is required to reject' using errcode = '23514', hint = 'reason_required';
    end if;
  elsif v_booking.status in ('requested', 'confirmed', 'assigned') and p_to_status = 'cancelled' then
    if not (v_is_manager or (v_booking.status = 'requested' and (v_is_requester or v_is_farmer))) then
      raise exception 'not allowed to cancel this booking' using errcode = '42501';
    end if;
  else
    raise exception 'status change not allowed' using errcode = '23514', hint = 'invalid_transition';
  end if;

  if p_to_status = 'cancelled' then
    update public.booking_assignments
    set is_current = false, ended_at = timezone('utc', now())
    where booking_id = p_booking_id and is_current;
  end if;

  update public.bookings
  set status = p_to_status, updated_at = timezone('utc', now())
  where id = p_booking_id;

  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, reason, actor_id)
  values (v_booking.tenant_id, p_booking_id, v_booking.status, p_to_status, v_reason, v_caller);
end;
$$;

-- ── list_my_jobs ───────────────────────────────────────────────────────────
-- The calling pilot's current jobs in an organization from today on, with
-- what they need on the ground: farmer contact, village, slot, drone, and
-- the booked fields. Returns nothing for non-pilots.

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
    village.name,
    booking.total_acres,
    drone.uid,
    booking.notes,
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'field_id', line.field_id,
        'field_name', line.field_name,
        'crop_name_en', line.crop_name_en,
        'crop_name_hi', line.crop_name_hi,
        'area_acres', line.area_acres,
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
  join public.villages as village on village.id = booking.village_id
  join public.drones as drone on drone.id = assignment.drone_id
  where assignment.tenant_id = p_tenant_id
    and assignment.pilot_user_id = auth.uid()
    and assignment.is_current
    and booking.status in ('assigned', 'in_progress')
    and booking.preferred_date >= public.tenant_local_now(p_tenant_id)::date
    and public.has_organization_role(p_tenant_id, array['pilot']::public.organization_role[])
  order by booking.preferred_date, slot.start_time;
$$;

revoke execute on function public.list_my_jobs(uuid) from public, anon;
grant execute on function public.list_my_jobs(uuid) to authenticated;
