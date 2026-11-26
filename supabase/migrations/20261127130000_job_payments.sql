-- Job payments by UPI QR, simulated for now (ADR 0022, owner decision).
--
-- Each region has a spraying rate per acre, set by organization admins. When
-- the pilot completes a job the amount due is fixed on the booking: the
-- region's rate at that moment times the acres actually sprayed (a snapshot,
-- so later rate changes never rewrite past jobs). The pilot shows a UPI QR for
-- that amount and, once the farmer has paid, records it; region managers can
-- record it too (for example cash paid later). No payment provider confirms
-- anything yet: "paid" is what the pilot or admin recorded.

-- ── Rates and the organization's UPI ID ────────────────────────────────────

alter table public.regions
  add column rate_per_acre numeric(10, 2),
  add constraint regions_rate_per_acre_range
    check (rate_per_acre is null or (rate_per_acre > 0 and rate_per_acre <= 100000));

-- Regions are already writable only by organization admins (RLS).
grant update (rate_per_acre) on public.regions to authenticated;

-- The UPI ID payments go to. Demo data uses an @example handle, which no
-- payment app accepts, so no real money can move while payments are fake.
alter table public.organization_settings
  add column upi_id text,
  add column upi_payee_name text,
  add constraint organization_settings_upi_id_format
    check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z0-9.-]{2,64}$'),
  add constraint organization_settings_upi_payee_name_length
    check (upi_payee_name is null or (btrim(upi_payee_name) <> '' and char_length(upi_payee_name) <= 100));

-- ── Amount and payment on the booking ──────────────────────────────────────

alter table public.bookings
  add column rate_per_acre numeric(10, 2),
  add column amount_due numeric(12, 2),
  add column paid_at timestamptz,
  add column paid_recorded_by uuid references public.profiles(id) on delete set null,
  add constraint bookings_amount_due_positive check (amount_due is null or amount_due > 0),
  add constraint bookings_paid_needs_amount check (paid_at is null or amount_due is not null),
  add constraint bookings_paid_recorded_by_set check ((paid_at is null) = (paid_recorded_by is null));

create index bookings_paid_recorded_by_idx on public.bookings (paid_recorded_by);
create index bookings_unpaid_idx on public.bookings (tenant_id, region_id)
  where amount_due is not null and paid_at is null;

-- ── complete_job: also fixes the amount due ────────────────────────────────
-- Same contract as before. The amount is the region's current rate times the
-- acres sprayed; with no rate set it stays empty. A job that was already paid
-- keeps its amount if it is sent back and completed again.

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
  v_rate numeric(10, 2);
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

  select region.rate_per_acre into v_rate from public.regions as region where region.id = v_booking.region_id;

  update public.booking_fields as line
  set actual_acres = actual.acres
  from unnest(p_field_ids, p_acres) as actual (field_id, acres)
  where line.booking_id = p_booking_id and line.field_id = actual.field_id;

  update public.bookings
  set status = 'completed',
      completed_at = timezone('utc', now()),
      actual_total_acres = v_total,
      completion_notes = v_notes,
      rate_per_acre = case when paid_at is null then v_rate else rate_per_acre end,
      amount_due = case when paid_at is null then round(v_total * v_rate, 2) else amount_due end,
      updated_at = timezone('utc', now())
  where id = p_booking_id;

  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, actor_id)
  values (v_booking.tenant_id, p_booking_id, 'in_progress', 'completed', v_caller);
end;
$$;

-- ── record_job_payment ─────────────────────────────────────────────────────
-- The assigned pilot or a region manager records that the farmer paid a
-- completed (or verified) job.
-- Error contract: P0002 = not found / not visible, 42501 = not allowed,
-- 23514 + HINT (invalid_transition, no_amount, already_paid).

create or replace function public.record_job_payment(p_booking_id uuid)
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
  if not (public.is_assigned_pilot(p_booking_id) or coalesce(public.can_manage_region(v_booking.region_id), false)) then
    raise exception 'only the assigned pilot or a region manager can record a payment' using errcode = '42501';
  end if;
  if v_booking.status not in ('completed', 'verified') then
    raise exception 'only a completed job can be paid' using errcode = '23514', hint = 'invalid_transition';
  end if;
  if v_booking.amount_due is null then
    raise exception 'this job has no amount due' using errcode = '23514', hint = 'no_amount';
  end if;
  if v_booking.paid_at is not null then
    raise exception 'this job is already paid' using errcode = '23514', hint = 'already_paid';
  end if;

  update public.bookings
  set paid_at = timezone('utc', now()),
      paid_recorded_by = v_caller,
      updated_at = timezone('utc', now())
  where id = p_booking_id;
end;
$$;

revoke execute on function public.record_job_payment(uuid) from public, anon;
grant execute on function public.record_job_payment(uuid) to authenticated;

-- ── Payment details for one booking (for the QR) ───────────────────────────
-- Amount, payment state, and where to pay, for anyone who can see the booking
-- (the farmer, the pilot, managers). Pilots cannot read organization settings
-- directly, so the UPI ID comes through here.

create or replace function public.get_booking_payment(p_booking_id uuid)
returns table (
  amount_due numeric,
  rate_per_acre numeric,
  paid_at timestamptz,
  upi_id text,
  payee_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    booking.amount_due,
    booking.rate_per_acre,
    booking.paid_at,
    settings.upi_id,
    coalesce(settings.upi_payee_name, organization.name)
  from public.bookings as booking
  join public.organizations as organization on organization.id = booking.tenant_id
  left join public.organization_settings as settings on settings.tenant_id = booking.tenant_id
  where booking.id = p_booking_id
    and (public.can_view_booking(p_booking_id) or public.is_assigned_pilot(p_booking_id));
$$;

revoke execute on function public.get_booking_payment(uuid) from public, anon;
grant execute on function public.get_booking_payment(uuid) to authenticated;

-- ── Pilot job list: amount and payment state ───────────────────────────────

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

revoke execute on function public.list_my_jobs(uuid) from public, anon;
grant execute on function public.list_my_jobs(uuid) to authenticated;
