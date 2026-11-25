-- Job execution and verification (ADR 0015).
--
-- The assigned pilot starts the job on the job day (assigned -> in_progress)
-- and completes it with the actual area sprayed per booked field, as shown by
-- the drone's mission plan (in_progress -> completed). The mission-plan area
-- can be larger than the farmer's recorded acreage (a 4-acre field may come
-- out at 4.3), so it may exceed the booked acres, up to 2x as a typo guard. A region manager then verifies it
-- (completed -> verified) or sends it back with a reason
-- (completed -> in_progress) so the pilot can correct it. Every step goes
-- through a transactional function that writes status history.

alter table public.booking_fields
  add column actual_acres numeric(8, 2),
  add constraint booking_fields_actual_acres_range
    check (actual_acres is null or (actual_acres >= 0 and actual_acres <= area_acres * 2));

alter table public.bookings
  add column started_at timestamptz,
  add column completed_at timestamptz,
  add column actual_total_acres numeric(10, 2),
  add column completion_notes text,
  add column verified_at timestamptz,
  add column verified_by uuid references public.profiles(id) on delete set null,
  add constraint bookings_completion_notes_length
    check (completion_notes is null or char_length(completion_notes) <= 500),
  add constraint bookings_actual_total_acres_positive
    check (actual_total_acres is null or actual_total_acres > 0);

create index bookings_verified_by_idx on public.bookings (verified_by);

-- ── Helper (internal) ──────────────────────────────────────────────────────

-- Is the caller the booking's currently assigned pilot (and still a pilot
-- of its organization)? Never NULL.
create or replace function public.is_assigned_pilot(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      exists (
        select 1 from public.booking_assignments as assignment
        where assignment.booking_id = booking.id
          and assignment.is_current
          and assignment.pilot_user_id = auth.uid()
      )
      and public.has_organization_role(booking.tenant_id, array['pilot']::public.organization_role[])
    from public.bookings as booking
    where booking.id = p_booking_id
  ), false);
$$;

revoke execute on function public.is_assigned_pilot(uuid) from public, anon, authenticated;

-- ── start_job ──────────────────────────────────────────────────────────────
-- Error contract: P0002 = not found / not visible, 42501 = not the assigned
-- pilot, 23514 + HINT (invalid_transition, not_job_day).

create or replace function public.start_job(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or not public.can_view_booking(p_booking_id) then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if not public.is_assigned_pilot(p_booking_id) then
    raise exception 'only the assigned pilot can start this job' using errcode = '42501';
  end if;
  if v_booking.status <> 'assigned' then
    raise exception 'only an assigned job can be started' using errcode = '23514', hint = 'invalid_transition';
  end if;
  if v_booking.preferred_date <> public.tenant_local_now(v_booking.tenant_id)::date then
    raise exception 'a job can only be started on its day' using errcode = '23514', hint = 'not_job_day';
  end if;

  update public.bookings
  set status = 'in_progress', started_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = p_booking_id;

  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, actor_id)
  values (v_booking.tenant_id, p_booking_id, 'assigned', 'in_progress', v_caller);
end;
$$;

revoke execute on function public.start_job(uuid) from public, anon;
grant execute on function public.start_job(uuid) to authenticated;

-- ── complete_job ───────────────────────────────────────────────────────────
-- p_field_ids / p_acres are parallel arrays covering every booked field
-- exactly once; each value is between 0 and twice the field's booked acres
-- (the mission-plan area can exceed the recorded acreage), and
-- the total must be above 0 (a job where nothing was sprayed is cancelled
-- by an admin instead).
-- Error contract: P0002, 42501 as above; 23514 + HINT (invalid_transition,
-- invalid_acres, invalid_notes).

create or replace function public.complete_job(
  p_booking_id uuid,
  p_field_ids uuid[],
  p_acres numeric[],
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_count integer := coalesce(cardinality(p_field_ids), 0);
  v_total numeric(10, 2);
begin
  if v_caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or not public.can_view_booking(p_booking_id) then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if not public.is_assigned_pilot(p_booking_id) then
    raise exception 'only the assigned pilot can complete this job' using errcode = '42501';
  end if;
  if v_booking.status <> 'in_progress' then
    raise exception 'only a started job can be completed' using errcode = '23514', hint = 'invalid_transition';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'notes are too long' using errcode = '23514', hint = 'invalid_notes';
  end if;

  -- Every booked field exactly once, each value within 2x its booked acres.
  if v_count = 0
     or v_count <> coalesce(cardinality(p_acres), 0)
     or (select count(distinct field_id) from unnest(p_field_ids) as field_id) <> v_count
     or v_count <> (select count(*) from public.booking_fields where booking_id = p_booking_id)
     or exists (
       select 1
       from unnest(p_field_ids, p_acres) as actual (field_id, acres)
       left join public.booking_fields as line
         on line.booking_id = p_booking_id and line.field_id = actual.field_id
       where line.field_id is null
          or actual.acres is null
          or actual.acres < 0
          or actual.acres > line.area_acres * 2
     ) then
    raise exception 'enter the area sprayed for every field, up to twice its booked acres'
      using errcode = '23514', hint = 'invalid_acres';
  end if;

  select sum(acres) into v_total from unnest(p_acres) as acres;
  if v_total <= 0 then
    raise exception 'the acres sprayed must be more than zero' using errcode = '23514', hint = 'invalid_acres';
  end if;

  update public.booking_fields as line
  set actual_acres = actual.acres
  from unnest(p_field_ids, p_acres) as actual (field_id, acres)
  where line.booking_id = p_booking_id and line.field_id = actual.field_id;

  update public.bookings
  set status = 'completed',
      completed_at = timezone('utc', now()),
      actual_total_acres = v_total,
      completion_notes = v_notes,
      updated_at = timezone('utc', now())
  where id = p_booking_id;

  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, actor_id)
  values (v_booking.tenant_id, p_booking_id, 'in_progress', 'completed', v_caller);
end;
$$;

revoke execute on function public.complete_job(uuid, uuid[], numeric[], text) from public, anon;
grant execute on function public.complete_job(uuid, uuid[], numeric[], text) to authenticated;

-- ── set_booking_status ─────────────────────────────────────────────────────
-- Adds, for region managers:
--   completed -> verified      records who verified and when
--   completed -> in_progress   "send back", reason required; the pilot's
--                              actual acres stay as a starting point

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
  elsif v_booking.status = 'completed' and p_to_status = 'verified' then
    if not v_is_manager then
      raise exception 'only a region manager can verify' using errcode = '42501';
    end if;
  elsif v_booking.status = 'completed' and p_to_status = 'in_progress' then
    if not v_is_manager then
      raise exception 'only a region manager can send a job back' using errcode = '42501';
    end if;
    if v_reason is null then
      raise exception 'a reason is required to send a job back' using errcode = '23514', hint = 'reason_required';
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
  set status = p_to_status,
      verified_at = case when p_to_status = 'verified' then timezone('utc', now()) else verified_at end,
      verified_by = case when p_to_status = 'verified' then v_caller else verified_by end,
      completed_at = case when p_to_status = 'in_progress' then null else completed_at end,
      updated_at = timezone('utc', now())
  where id = p_booking_id;

  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, reason, actor_id)
  values (v_booking.tenant_id, p_booking_id, v_booking.status, p_to_status, v_reason, v_caller);
end;
$$;

-- ── list_my_jobs ───────────────────────────────────────────────────────────
-- Now returns, for the pilot's Today / Upcoming / Completed tabs:
--   assigned jobs from today on, every started job (a job sent back for
--   correction stays visible whatever its date), and completed or verified
--   jobs from the last 60 days.
-- Adds actual acres (per field and total) and the latest send-back reason.

drop function public.list_my_jobs(uuid);

create function public.list_my_jobs(p_tenant_id uuid)
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
    village.name,
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
  join public.villages as village on village.id = booking.village_id
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

revoke execute on function public.list_my_jobs(uuid) from public, anon;
grant execute on function public.list_my_jobs(uuid) to authenticated;
