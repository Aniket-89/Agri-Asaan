-- Crop monitoring (ADR 0025): field boundaries drawn in the app, and a
-- per-field observation time series (NDVI, NDRE, NDMI).
--
-- Security notes:
-- * Boundaries are written through the existing fields_update RLS policy
--   (the farmer themself, or staff who manage the farmer). The only new
--   grant is UPDATE on the boundary column; a trigger validates every
--   boundary however it arrives.
-- * Observations are read-only to users. They are written only by the
--   database (simulated demo data, below) or later by the satellite worker.
--   They are append-only: updates are rejected, and rows go only when their
--   field is deleted.
-- * Observation reads follow field reads: a row is visible only if its field
--   is visible to the caller through the fields RLS policy.

-- ── Boundary writes and validation ─────────────────────────────────────────

grant update (boundary) on public.fields to authenticated;

-- A boundary must be one simple ring (no holes, no self-crossing), 0.05 to
-- 1,000 acres, at most 100 corners, and within 500 m of the field's pin, so
-- a boundary cannot be drawn in another village.
create or replace function public.check_field_boundary()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  shape extensions.geometry;
  acres double precision;
  pin extensions.geography;
begin
  if new.boundary is null then
    return new;
  end if;
  shape := new.boundary::extensions.geometry;
  if not extensions.st_isvalid(shape)
     or extensions.st_nrings(shape) <> 1
     or extensions.st_npoints(shape) > 101 then
    raise exception 'field boundary must be one simple shape with at most 100 corners'
      using errcode = '23514';
  end if;
  acres := extensions.st_area(new.boundary) / 4046.8564224;
  if acres < 0.05 or acres > 1000 then
    raise exception 'field boundary must cover 0.05 to 1000 acres' using errcode = '23514';
  end if;
  -- The generated location column is not computed yet in a BEFORE trigger.
  pin := extensions.st_setsrid(
    extensions.st_makepoint(new.longitude::double precision, new.latitude::double precision),
    4326
  )::extensions.geography;
  if not extensions.st_dwithin(new.boundary, pin, 500) then
    raise exception 'field boundary must be within 500 m of the field pin' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger fields_check_boundary
before insert or update of boundary, latitude, longitude on public.fields
for each row execute function public.check_field_boundary();

-- Sets (or, with null, clears) a field's boundary from a GeoJSON Polygon.
-- SECURITY INVOKER: the update runs under the caller's RLS, so it only
-- reaches fields the caller may edit; others look not found.
create or replace function public.set_field_boundary(p_field_id uuid, p_boundary jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shape extensions.geography;
begin
  if p_boundary is not null then
    if jsonb_typeof(p_boundary) <> 'object' or p_boundary->>'type' <> 'Polygon' then
      raise exception 'boundary must be a GeoJSON Polygon' using errcode = '23514';
    end if;
    begin
      shape := extensions.st_setsrid(
        extensions.st_geomfromgeojson(p_boundary::text),
        4326
      )::extensions.geography(Polygon, 4326);
    exception when others then
      raise exception 'boundary must be a GeoJSON Polygon' using errcode = '23514';
    end;
  end if;

  update public.fields
  set boundary = shape, updated_at = timezone('utc', now())
  where id = p_field_id;
  if not found then
    raise exception 'field not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_field_boundary(uuid, jsonb) from public, anon;
grant execute on function public.set_field_boundary(uuid, jsonb) to authenticated;

-- ── Observations ───────────────────────────────────────────────────────────

create table public.field_observations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  field_id uuid not null,
  -- Satellite acquisition time.
  observed_at timestamptz not null,
  -- 'simulated-demo' until the Sentinel-2 worker exists (AGENTS.md); the
  -- screens always show the source.
  source text not null,
  processing_version text not null,
  cloud_cover_pct numeric(5, 2) not null,
  quality text not null,
  -- Field means; null when the pass is too cloudy to use.
  ndvi_mean numeric(4, 3),
  ndre_mean numeric(4, 3),
  ndmi_mean numeric(4, 3),
  created_at timestamptz not null default timezone('utc', now()),
  constraint field_observations_field_same_tenant
    foreign key (tenant_id, field_id) references public.fields (tenant_id, id) on delete cascade,
  constraint field_observations_source check (source in ('simulated-demo', 'sentinel-2-l2a')),
  constraint field_observations_version check (
    btrim(processing_version) <> '' and char_length(processing_version) <= 40
  ),
  constraint field_observations_cloud check (cloud_cover_pct between 0 and 100),
  constraint field_observations_quality check (quality in ('good', 'partly_cloudy', 'cloudy')),
  constraint field_observations_index_range check (
    (ndvi_mean is null or ndvi_mean between -1 and 1)
    and (ndre_mean is null or ndre_mean between -1 and 1)
    and (ndmi_mean is null or ndmi_mean between -1 and 1)
  ),
  constraint field_observations_usable_has_values check (
    quality = 'cloudy'
    or (ndvi_mean is not null and ndre_mean is not null and ndmi_mean is not null)
  ),
  -- One record per field, acquisition, source and processing version.
  constraint field_observations_unique unique (field_id, observed_at, source, processing_version)
);

create index field_observations_field_time_idx
  on public.field_observations (tenant_id, field_id, observed_at desc);

alter table public.field_observations enable row level security;

revoke all on public.field_observations from public, anon, authenticated;
grant select on public.field_observations to authenticated;

create policy field_observations_select on public.field_observations
for select to authenticated
using (
  exists (
    select 1 from public.fields as field
    where field.id = field_observations.field_id
      and field.tenant_id = field_observations.tenant_id
  )
);

-- Append-only: history is never rewritten.
create or replace function public.reject_observation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'field observations are append-only' using errcode = '42501';
end;
$$;

create trigger field_observations_append_only
before update on public.field_observations
for each row execute function public.reject_observation_update();

-- ── Simulated demo observations ────────────────────────────────────────────

-- When a field gets a boundary, add the last eight Sentinel-2-like passes
-- (every 5 days, about 05:30 UTC over north India) as clearly labelled
-- simulated data. Values are deterministic per field and date: each field
-- follows one of three trends (improving, steady, declining), one pass is
-- cloudy, and the rest have light or partial cloud. Existing rows are kept
-- (append-only), so redrawing a boundary only adds missing passes.
create or replace function public.add_simulated_observations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  anchor constant date := date '2026-01-01';
  latest date := anchor + ((current_date - anchor) / 5) * 5;
  field_hash integer := abs(hashtext(new.id::text));
  trend integer := field_hash % 3;
  cloudy_pass integer := field_hash % 4 + 2;
  start_ndvi numeric := (array[0.46, 0.58, 0.70])[trend + 1];
  end_ndvi numeric := (array[0.79, 0.55, 0.36])[trend + 1];
  pass integer;
  pass_date date;
  noise numeric;
  cloud numeric;
  ndvi numeric;
begin
  if new.boundary is null
     or (tg_op = 'UPDATE' and old.boundary is not distinct from new.boundary) then
    return new;
  end if;

  for pass in 0..7 loop
    pass_date := latest - (7 - pass) * 5;
    noise := (abs(hashtext(new.id::text || pass_date::text)) % 1000) / 1000.0;
    if pass = cloudy_pass then
      cloud := 72 + noise * 23;
    elsif noise < 0.3 then
      cloud := 22 + noise * 60;
    else
      cloud := noise * 12;
    end if;
    ndvi := start_ndvi + (end_ndvi - start_ndvi) * pass / 7.0 + (noise - 0.5) * 0.04;

    insert into public.field_observations (
      tenant_id, field_id, observed_at, source, processing_version,
      cloud_cover_pct, quality, ndvi_mean, ndre_mean, ndmi_mean
    )
    values (
      new.tenant_id,
      new.id,
      pass_date + time '05:30' at time zone 'UTC',
      'simulated-demo',
      'demo-sim-1',
      round(cloud, 2),
      case when cloud >= 60 then 'cloudy' when cloud >= 20 then 'partly_cloudy' else 'good' end,
      case when cloud >= 60 then null else round(ndvi, 3) end,
      case when cloud >= 60 then null else round(ndvi * 0.62 + (noise - 0.5) * 0.03, 3) end,
      case when cloud >= 60 then null
        else round(ndvi * 0.55 - 0.04 - trend * 0.05 + (noise - 0.5) * 0.03, 3) end
    )
    on conflict on constraint field_observations_unique do nothing;
  end loop;
  return new;
end;
$$;

revoke execute on function public.add_simulated_observations() from public, anon, authenticated;

create trigger fields_add_simulated_observations
after insert or update of boundary on public.fields
for each row execute function public.add_simulated_observations();
