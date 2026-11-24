-- Bookings, booking lines, and append-only status history (ADR 0011).
--
-- Clients never write these tables directly. create_booking and
-- set_booking_status are the only write paths. Each validates the caller,
-- tenant, scope, allowed transition, and required fields, and writes status
-- history in the same transaction (AGENTS.md principle 5). Booking lines
-- snapshot field, crop, acreage, and pin at booking time (principle 8).

create type public.booking_status as enum (
  'requested',
  'confirmed',
  'rejected',
  'cancelled',
  'assigned',
  'in_progress',
  'completed',
  'verified'
);

-- Lets booking lines prove, with a foreign key, that every field belongs to
-- the booking's farmer.
alter table public.fields
  add constraint fields_tenant_farmer_id_unique unique (tenant_id, farmer_id, id);

create table public.bookings (
  -- Client-generated so a retried request is idempotent.
  id uuid primary key,
  tenant_id uuid not null,
  farmer_id uuid not null,
  -- Snapshot of the farmer's village and its region at booking time, so the
  -- request stays routed to the same regional admin if the farmer moves.
  village_id uuid not null,
  region_id uuid not null,
  status public.booking_status not null default 'requested',
  preferred_date date not null,
  notes text,
  total_acres numeric(10, 2) not null,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint bookings_farmer_same_tenant
    foreign key (tenant_id, farmer_id) references public.farmers (tenant_id, id),
  constraint bookings_village_same_tenant
    foreign key (tenant_id, village_id) references public.villages (tenant_id, id),
  constraint bookings_region_same_tenant
    foreign key (tenant_id, region_id) references public.regions (tenant_id, id),
  constraint bookings_notes_length check (notes is null or char_length(notes) <= 500),
  constraint bookings_total_acres_positive check (total_acres > 0),
  constraint bookings_tenant_id_id_unique unique (tenant_id, id),
  constraint bookings_tenant_id_farmer_unique unique (tenant_id, id, farmer_id)
);

create index bookings_inbox_idx on public.bookings (tenant_id, region_id, status, preferred_date);
create index bookings_village_idx on public.bookings (tenant_id, village_id);
create index bookings_farmer_idx on public.bookings (tenant_id, farmer_id);
create index bookings_requested_by_idx on public.bookings (requested_by);

create table public.booking_fields (
  tenant_id uuid not null,
  booking_id uuid not null,
  farmer_id uuid not null,
  field_id uuid not null,
  field_name text not null,
  crop_code text not null,
  crop_name_en text not null,
  crop_name_hi text not null,
  area_acres numeric(8, 2) not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  primary key (booking_id, field_id),
  constraint booking_fields_booking_same_farmer
    foreign key (tenant_id, booking_id, farmer_id)
    references public.bookings (tenant_id, id, farmer_id) on delete cascade,
  constraint booking_fields_field_same_farmer
    foreign key (tenant_id, farmer_id, field_id)
    references public.fields (tenant_id, farmer_id, id)
);

create index booking_fields_field_idx on public.booking_fields (tenant_id, field_id);

create table public.booking_status_history (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  booking_id uuid not null,
  from_status public.booking_status,
  to_status public.booking_status not null,
  reason text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint booking_status_history_booking_same_tenant
    foreign key (tenant_id, booking_id) references public.bookings (tenant_id, id) on delete cascade,
  constraint booking_status_history_reason_length
    check (reason is null or char_length(reason) between 1 and 500)
);

create index booking_status_history_booking_idx on public.booking_status_history (booking_id, created_at);

-- History is append-only, even for privileged code paths.
create or replace function public.prevent_booking_history_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'booking status history is append-only' using errcode = '42501';
end;
$$;

revoke execute on function public.prevent_booking_history_changes() from public, anon, authenticated;

create trigger prevent_booking_history_changes before update or delete on public.booking_status_history
  for each row execute function public.prevent_booking_history_changes();

-- ── Visibility ─────────────────────────────────────────────────────────────

-- Region managers (org admin, assigned regional admin), mitras of the
-- booking's village, the requester while still a member, and the farmer's
-- own linked login.
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
      )
  );
$$;

revoke execute on function public.can_view_booking(uuid) from public, anon;
grant execute on function public.can_view_booking(uuid) to authenticated;

alter table public.bookings enable row level security;
alter table public.booking_fields enable row level security;
alter table public.booking_status_history enable row level security;

revoke all on public.bookings, public.booking_fields, public.booking_status_history from anon, authenticated;
grant select on public.bookings, public.booking_fields, public.booking_status_history to authenticated;

create policy bookings_select on public.bookings
for select to authenticated
using (public.can_view_booking(id));

create policy booking_fields_select on public.booking_fields
for select to authenticated
using (public.can_view_booking(booking_id));

create policy booking_status_history_select on public.booking_status_history
for select to authenticated
using (public.can_view_booking(booking_id));

-- ── create_booking ─────────────────────────────────────────────────────────
-- Error contract: SQLSTATE 42501 = not allowed, 23505 = id reused for a
-- different booking, 23514 = rule violation with a machine-readable HINT
-- (farmer_inactive, invalid_fields, date_out_of_range, field_already_booked,
-- invalid_notes).

create or replace function public.create_booking(
  p_booking_id uuid,
  p_farmer_id uuid,
  p_field_ids uuid[],
  p_preferred_date date,
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
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
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

  select * into v_farmer from public.farmers where id = p_farmer_id;
  -- Same error whether the farmer is missing or out of scope, so ids cannot be
  -- probed. The comparison is null-safe: a farmer without a linked login has
  -- profile_id NULL, and NULL = caller would make the whole check NULL, which
  -- IF treats as "do not raise".
  if not found or not (
    public.can_manage_farmer(p_farmer_id)
    or (
      v_farmer.profile_id is not distinct from v_caller
      and public.has_organization_role(v_farmer.tenant_id, array['farmer']::public.organization_role[])
    )
  ) then
    raise exception 'not allowed to book for this farmer' using errcode = '42501';
  end if;

  if not v_farmer.is_active then
    raise exception 'farmer is inactive' using errcode = '23514', hint = 'farmer_inactive';
  end if;
  if v_field_count = 0 or v_field_count > 20
     or (select count(distinct field_id) from unnest(p_field_ids) as field_id) <> v_field_count then
    raise exception 'choose between 1 and 20 different fields' using errcode = '23514', hint = 'invalid_fields';
  end if;
  if p_preferred_date is null or p_preferred_date < v_today or p_preferred_date > v_today + 60 then
    raise exception 'preferred date must be within the next 60 days' using errcode = '23514', hint = 'date_out_of_range';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'notes are too long' using errcode = '23514', hint = 'invalid_notes';
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
  select sum(field.area_acres) into v_total from public.fields as field where field.id = any(p_field_ids);

  insert into public.bookings (
    id, tenant_id, farmer_id, village_id, region_id, status, preferred_date, notes, total_acres, requested_by
  )
  values (
    p_booking_id, v_farmer.tenant_id, p_farmer_id, v_farmer.village_id, v_region_id,
    'requested', p_preferred_date, v_notes, v_total, v_caller
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

revoke execute on function public.create_booking(uuid, uuid, uuid[], date, text) from public, anon;
grant execute on function public.create_booking(uuid, uuid, uuid[], date, text) to authenticated;

-- ── set_booking_status ─────────────────────────────────────────────────────
-- Transitions in this release (assignment adds the rest):
--   requested -> confirmed   region manager
--   requested -> rejected    region manager, reason required
--   requested -> cancelled   region manager, the requester, or the farmer
--   confirmed -> cancelled   region manager
-- Error contract: P0002 = not found / not visible, 42501 = not allowed,
-- 23514 + HINT (invalid_transition, reason_required, invalid_reason).

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
  -- permission checks below silently pass (requested_by is NULL once the
  -- requester's profile is deleted).
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
  elsif v_booking.status in ('requested', 'confirmed') and p_to_status = 'cancelled' then
    if not (v_is_manager or (v_booking.status = 'requested' and (v_is_requester or v_is_farmer))) then
      raise exception 'not allowed to cancel this booking' using errcode = '42501';
    end if;
  else
    raise exception 'status change not allowed' using errcode = '23514', hint = 'invalid_transition';
  end if;

  update public.bookings
  set status = p_to_status, updated_at = timezone('utc', now())
  where id = p_booking_id;

  insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, reason, actor_id)
  values (v_booking.tenant_id, p_booking_id, v_booking.status, p_to_status, v_reason, v_caller);
end;
$$;

revoke execute on function public.set_booking_status(uuid, public.booking_status, text) from public, anon;
grant execute on function public.set_booking_status(uuid, public.booking_status, text) to authenticated;
