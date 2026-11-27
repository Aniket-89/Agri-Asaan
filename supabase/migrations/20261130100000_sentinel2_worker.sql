-- Real Sentinel-2 crop monitoring (ADR 0026).
--
-- Security notes:
-- * crop_worker is a dedicated database role for the satellite worker. It
--   is created without login; an operator enables login with a password
--   outside the repository. It is not authenticated/anon, so no existing
--   policy applies to it. Its own policies and column grants let it:
--     - read id, tenant and boundary of active fields that have a boundary
--     - add Sentinel-2 observations and read them back
--     - write per-field scan status
--   It cannot read farmers, profiles, bookings or any other table, and it
--   cannot change or delete observations.
-- * Per-pixel files live in the private field-rasters bucket. Users read a
--   file only if they can read its field (fields RLS). Nobody writes through
--   the API; the worker uploads with a Storage S3 key.
-- * Simulated demo observations (ADR 0025) are removed, as the owner decided.

-- ── Remove the simulation ──────────────────────────────────────────────────

drop trigger fields_add_simulated_observations on public.fields;
drop function public.add_simulated_observations();

-- Owner-approved deletion of demo data (append-only forbids updates, not
-- removal of rows that were never real).
delete from public.field_observations where source = 'simulated-demo';

alter table public.field_observations drop constraint field_observations_source;
alter table public.field_observations
  add constraint field_observations_source check (source = 'sentinel-2-l2a');

-- ── Per-pixel file reference ───────────────────────────────────────────────

-- "<tenant id>/<field id>/<file>.json" in the field-rasters bucket; null for
-- cloudy passes, which have no usable pixels.
alter table public.field_observations add column raster_path text;
alter table public.field_observations
  add constraint field_observations_raster_path check (
    raster_path is null
    or raster_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9_.-]{1,80}\.json$'
  );

-- ── Scan status ────────────────────────────────────────────────────────────

-- When the worker last looked for passes over a field, and the last error,
-- so screens can say "waiting for the first scan" honestly.
create table public.field_scan_status (
  field_id uuid primary key,
  tenant_id uuid not null,
  last_checked_at timestamptz not null,
  last_error text,
  constraint field_scan_status_field_same_tenant
    foreign key (tenant_id, field_id) references public.fields (tenant_id, id) on delete cascade,
  constraint field_scan_status_error_length check (char_length(last_error) <= 300)
);

create index field_scan_status_tenant_idx on public.field_scan_status (tenant_id);

alter table public.field_scan_status enable row level security;

revoke all on public.field_scan_status from public, anon, authenticated;
grant select on public.field_scan_status to authenticated;

create policy field_scan_status_select on public.field_scan_status
for select to authenticated
using (
  exists (
    select 1 from public.fields as field
    where field.id = field_scan_status.field_id
      and field.tenant_id = field_scan_status.tenant_id
  )
);

-- ── The worker role ────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crop_worker') then
    create role crop_worker nologin noinherit;
  end if;
end;
$$;

-- postgres (the migration owner, already a superset of these privileges)
-- may act as the worker, as it may as anon/authenticated; tests use this.
grant crop_worker to postgres;

grant usage on schema public to crop_worker;
-- PostGIS functions (boundary as GeoJSON) live in the extensions schema.
grant usage on schema extensions to crop_worker;

grant select (id, tenant_id, boundary, is_active) on public.fields to crop_worker;
create policy fields_select_crop_worker on public.fields
for select to crop_worker
using (is_active and boundary is not null);

grant select, insert on public.field_observations to crop_worker;
create policy field_observations_select_crop_worker on public.field_observations
for select to crop_worker
using (true);
create policy field_observations_insert_crop_worker on public.field_observations
for insert to crop_worker
with check (
  source = 'sentinel-2-l2a'
  and exists (
    select 1 from public.fields as field
    where field.id = field_observations.field_id
      and field.tenant_id = field_observations.tenant_id
  )
);

grant select, insert, update (last_checked_at, last_error) on public.field_scan_status to crop_worker;
create policy field_scan_status_select_crop_worker on public.field_scan_status
for select to crop_worker
using (true);
create policy field_scan_status_insert_crop_worker on public.field_scan_status
for insert to crop_worker
with check (
  exists (
    select 1 from public.fields as field
    where field.id = field_scan_status.field_id
      and field.tenant_id = field_scan_status.tenant_id
  )
);
create policy field_scan_status_update_crop_worker on public.field_scan_status
for update to crop_worker
using (true)
with check (true);

-- ── Pixel files ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('field-rasters', 'field-rasters', false)
on conflict (id) do nothing;

-- Limits are Storage columns; guarded as in the brand-assets migration.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    execute $sql$
      update storage.buckets
      set file_size_limit = 1048576,
          allowed_mime_types = array['application/json']
      where id = 'field-rasters'
    $sql$;
  end if;
end;
$$;

-- A file is readable by whoever can read its field (fields RLS, invoker).
create policy field_rasters_select on storage.objects
for select to authenticated
using (
  bucket_id = 'field-rasters'
  and exists (
    select 1 from public.fields as field
    where field.tenant_id::text = split_part(objects.name, '/', 1)
      and field.id::text = split_part(objects.name, '/', 2)
  )
);
