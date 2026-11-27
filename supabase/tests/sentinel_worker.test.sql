begin;

create extension if not exists pgtap;

select plan(20);

-- Fixtures (fake data only): one tenant with two farmers, fields with and
-- without boundaries, and a field in a second tenant.
insert into auth.users (id, aud, role, email, created_at)
values
  ('d6000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sw-farmer-1@example.test', now()),
  ('d6000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sw-farmer-2@example.test', now());

insert into public.organizations (id, name, slug)
values
  ('d6a00000-0000-4000-8000-00000000000a', 'SW Tenant', 'sw-tenant'),
  ('d6a00000-0000-4000-8000-00000000000b', 'SW Other', 'sw-other');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('d6a00000-0000-4000-8000-00000000000a', 'd6a00000-0000-4000-8000-00000000000a', 'd6000000-0000-4000-8000-000000000001', 'farmer'),
  ('d6a00000-0000-4000-8000-00000000000a', 'd6a00000-0000-4000-8000-00000000000a', 'd6000000-0000-4000-8000-000000000002', 'farmer');

insert into public.regions (id, tenant_id, name)
values
  ('d6100000-0000-4000-8000-000000000001', 'd6a00000-0000-4000-8000-00000000000a', 'SW Region'),
  ('d6100000-0000-4000-8000-000000000002', 'd6a00000-0000-4000-8000-00000000000b', 'SW Other Region');
insert into public.villages (id, tenant_id, region_id, name)
values
  ('d6200000-0000-4000-8000-000000000001', 'd6a00000-0000-4000-8000-00000000000a', 'd6100000-0000-4000-8000-000000000001', 'SW Village'),
  ('d6200000-0000-4000-8000-000000000002', 'd6a00000-0000-4000-8000-00000000000b', 'd6100000-0000-4000-8000-000000000002', 'SW Other Village');
insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values
  ('d6c00000-0000-4000-8000-000000000001', 'd6a00000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ'),
  ('d6c00000-0000-4000-8000-000000000002', 'd6a00000-0000-4000-8000-00000000000b', 'wheat', 'Wheat', 'गेहूँ');

insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at, profile_id)
values
  ('d6f00000-0000-4000-8000-000000000001', 'd6a00000-0000-4000-8000-00000000000a', 'd6200000-0000-4000-8000-000000000001', 'SW Farmer 1', '9000001001', now(), 'd6000000-0000-4000-8000-000000000001'),
  ('d6f00000-0000-4000-8000-000000000002', 'd6a00000-0000-4000-8000-00000000000a', 'd6200000-0000-4000-8000-000000000001', 'SW Farmer 2', '9000001002', now(), 'd6000000-0000-4000-8000-000000000002'),
  ('d6f00000-0000-4000-8000-000000000003', 'd6a00000-0000-4000-8000-00000000000b', 'd6200000-0000-4000-8000-000000000002', 'SW Other Farmer', '9000001003', now(), null);

-- Field 1: boundary. Field 2: no boundary. Field 3: boundary, inactive.
-- Field 4: boundary, other tenant.
insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude, boundary, is_active)
values
  ('d6e00000-0000-4000-8000-000000000001', 'd6a00000-0000-4000-8000-00000000000a', 'd6f00000-0000-4000-8000-000000000001', 'Boundary plot', 'd6c00000-0000-4000-8000-000000000001', 3, 27.5, 77.6,
   'SRID=4326;POLYGON((77.5995 27.4995,77.6005 27.4995,77.6005 27.5005,77.5995 27.5005,77.5995 27.4995))', true),
  ('d6e00000-0000-4000-8000-000000000002', 'd6a00000-0000-4000-8000-00000000000a', 'd6f00000-0000-4000-8000-000000000001', 'Pin-only plot', 'd6c00000-0000-4000-8000-000000000001', 3, 27.5, 77.6, null, true),
  ('d6e00000-0000-4000-8000-000000000003', 'd6a00000-0000-4000-8000-00000000000a', 'd6f00000-0000-4000-8000-000000000001', 'Old plot', 'd6c00000-0000-4000-8000-000000000001', 3, 27.5, 77.6,
   'SRID=4326;POLYGON((77.5995 27.4995,77.6005 27.4995,77.6005 27.5005,77.5995 27.5005,77.5995 27.4995))', false),
  ('d6e00000-0000-4000-8000-000000000004', 'd6a00000-0000-4000-8000-00000000000b', 'd6f00000-0000-4000-8000-000000000003', 'Other tenant plot', 'd6c00000-0000-4000-8000-000000000002', 3, 27.5, 77.6,
   'SRID=4326;POLYGON((77.5995 27.4995,77.6005 27.4995,77.6005 27.5005,77.5995 27.5005,77.5995 27.4995))', true);

-- Pixel files as the worker would upload them.
insert into storage.objects (bucket_id, name)
values
  ('field-rasters', 'd6a00000-0000-4000-8000-00000000000a/d6e00000-0000-4000-8000-000000000001/20261120T053000Z-s2-l2a-v1.json'),
  ('field-rasters', 'd6a00000-0000-4000-8000-00000000000b/d6e00000-0000-4000-8000-000000000004/20261120T053000Z-s2-l2a-v1.json');

select throws_ok(
  $$insert into public.field_observations (tenant_id, field_id, observed_at, source, processing_version, cloud_cover_pct, quality, ndvi_mean, ndre_mean, ndmi_mean, raster_path)
    values ('d6a00000-0000-4000-8000-00000000000a', 'd6e00000-0000-4000-8000-000000000001', now(), 'sentinel-2-l2a', 's2-l2a-v1', 3, 'good', 0.6, 0.3, 0.2, '../../etc/passwd.json')$$,
  '23514', null, 'pixel file paths must be tenant/field/file.json'
);

-- ── The worker role ───────────────────────────────────────────────────────
set local role crop_worker;

select is(
  (select count(*)::integer from public.fields where id::text like 'd6e00000%'),
  2, 'the worker sees only active fields that have a boundary (any tenant)'
);
select throws_ok(
  $$select name from public.fields limit 1$$,
  '42501', null, 'the worker cannot read field names'
);
select throws_ok(
  $$select count(*) from public.farmers$$,
  '42501', null, 'the worker cannot read farmers'
);
select throws_ok(
  $$select count(*) from public.bookings$$,
  '42501', null, 'the worker cannot read bookings'
);
select throws_ok(
  $$select count(*) from storage.objects$$,
  '42501', null, 'the worker cannot use the Storage tables'
);
select lives_ok(
  $$insert into public.field_observations (tenant_id, field_id, observed_at, source, processing_version, cloud_cover_pct, quality, ndvi_mean, ndre_mean, ndmi_mean, raster_path)
    values ('d6a00000-0000-4000-8000-00000000000a', 'd6e00000-0000-4000-8000-000000000001', '2026-11-20 05:30+00', 'sentinel-2-l2a', 's2-l2a-v1', 3, 'good', 0.6, 0.3, 0.2,
            'd6a00000-0000-4000-8000-00000000000a/d6e00000-0000-4000-8000-000000000001/20261120T053000Z-s2-l2a-v1.json')$$,
  'the worker adds a Sentinel-2 observation'
);
select throws_ok(
  $$insert into public.field_observations (tenant_id, field_id, observed_at, source, processing_version, cloud_cover_pct, quality)
    values ('d6a00000-0000-4000-8000-00000000000a', 'd6e00000-0000-4000-8000-000000000002', now(), 'sentinel-2-l2a', 's2-l2a-v1', 90, 'cloudy')$$,
  '42501', null, 'the worker cannot add observations for a field without a boundary'
);
select throws_ok(
  $$insert into public.field_observations (tenant_id, field_id, observed_at, source, processing_version, cloud_cover_pct, quality)
    values ('d6a00000-0000-4000-8000-00000000000b', 'd6e00000-0000-4000-8000-000000000001', now(), 'sentinel-2-l2a', 's2-l2a-v1', 90, 'cloudy')$$,
  '42501', null, 'the worker cannot file an observation under another tenant'
);
select throws_ok(
  $$update public.field_observations set ndvi_mean = 0.9$$,
  '42501', null, 'the worker cannot change observations'
);
select throws_ok(
  $$delete from public.field_observations$$,
  '42501', null, 'the worker cannot delete observations'
);
select lives_ok(
  $$insert into public.field_scan_status (field_id, tenant_id, last_checked_at)
    values ('d6e00000-0000-4000-8000-000000000001', 'd6a00000-0000-4000-8000-00000000000a', now())
    on conflict (field_id) do update set last_checked_at = excluded.last_checked_at, last_error = null$$,
  'the worker records when it checked a field'
);
select throws_ok(
  $$insert into public.field_scan_status (field_id, tenant_id, last_checked_at)
    values ('d6e00000-0000-4000-8000-000000000002', 'd6a00000-0000-4000-8000-00000000000a', now())$$,
  '42501', null, 'the worker cannot record status for fields it cannot see'
);
select throws_ok(
  $$select public.set_field_boundary('d6e00000-0000-4000-8000-000000000001', null)$$,
  '42501', null, 'the worker cannot change boundaries'
);

-- ── Users ─────────────────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'd6000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.field_scan_status where field_id = 'd6e00000-0000-4000-8000-000000000001'),
  1, 'the farmer reads the scan status of their field'
);
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'field-rasters'),
  1, 'the farmer reads only their own field''s pixel files'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('field-rasters', 'd6a00000-0000-4000-8000-00000000000a/d6e00000-0000-4000-8000-000000000001/fake.json')$$,
  '42501', null, 'users cannot upload pixel files'
);

set local "request.jwt.claim.sub" = 'd6000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::integer from public.field_scan_status),
  0, 'another farmer reads no scan status'
);
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'field-rasters'),
  0, 'another farmer reads no pixel files'
);

reset role;
set local role anon;
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'field-rasters'),
  0, 'anonymous users read no pixel files'
);

select * from finish();
rollback;
