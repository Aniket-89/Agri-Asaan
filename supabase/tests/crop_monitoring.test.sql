begin;

create extension if not exists pgtap;

select plan(19);

-- Fixtures (fake data only): a tenant with a mitra and two farmers, and a
-- second tenant with an organization admin.
insert into auth.users (id, aud, role, email, created_at)
values
  ('d5000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'cm-mitra@example.test', now()),
  ('d5000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'cm-farmer-1@example.test', now()),
  ('d5000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cm-farmer-2@example.test', now()),
  ('d5000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'cm-other-admin@example.test', now());

insert into public.organizations (id, name, slug)
values
  ('d5a00000-0000-4000-8000-00000000000a', 'CM Tenant', 'cm-tenant'),
  ('d5a00000-0000-4000-8000-00000000000b', 'CM Other', 'cm-other');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('d5a00000-0000-4000-8000-00000000000a', 'd5a00000-0000-4000-8000-00000000000a', 'd5000000-0000-4000-8000-000000000001', 'mitra'),
  ('d5a00000-0000-4000-8000-00000000000a', 'd5a00000-0000-4000-8000-00000000000a', 'd5000000-0000-4000-8000-000000000002', 'farmer'),
  ('d5a00000-0000-4000-8000-00000000000a', 'd5a00000-0000-4000-8000-00000000000a', 'd5000000-0000-4000-8000-000000000003', 'farmer'),
  ('d5a00000-0000-4000-8000-00000000000b', 'd5a00000-0000-4000-8000-00000000000b', 'd5000000-0000-4000-8000-000000000004', 'organization_admin');

insert into public.regions (id, tenant_id, name)
values ('d5100000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'CM Region');
insert into public.villages (id, tenant_id, region_id, name)
values ('d5200000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'd5100000-0000-4000-8000-000000000001', 'CM Village');
insert into public.mitra_villages (tenant_id, village_id, user_id)
values ('d5a00000-0000-4000-8000-00000000000a', 'd5200000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001');
insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values ('d5c00000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ');

insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at, profile_id)
values
  ('d5f00000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'd5200000-0000-4000-8000-000000000001', 'CM Farmer 1', '9000000901', now(), 'd5000000-0000-4000-8000-000000000002'),
  ('d5f00000-0000-4000-8000-000000000002', 'd5a00000-0000-4000-8000-00000000000a', 'd5200000-0000-4000-8000-000000000001', 'CM Farmer 2', '9000000902', now(), 'd5000000-0000-4000-8000-000000000003');

insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
values
  ('d5e00000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'd5f00000-0000-4000-8000-000000000001', 'Plot one', 'd5c00000-0000-4000-8000-000000000001', 3, 27.5, 77.6),
  ('d5e00000-0000-4000-8000-000000000002', 'd5a00000-0000-4000-8000-00000000000a', 'd5f00000-0000-4000-8000-000000000002', 'Plot two', 'd5c00000-0000-4000-8000-000000000001', 3, 27.5, 77.6);

-- About 2.7 acres around the pin (27.5 N, 77.6 E). GeoJSON is lon, lat.
create temporary table shapes (name text primary key, shape jsonb) on commit drop;
insert into shapes values
  ('square', '{"type":"Polygon","coordinates":[[[77.5995,27.4995],[77.6005,27.4995],[77.6005,27.5005],[77.5995,27.5005],[77.5995,27.4995]]]}'),
  ('bigger', '{"type":"Polygon","coordinates":[[[77.5993,27.4994],[77.6007,27.4994],[77.6007,27.5006],[77.5993,27.5006],[77.5993,27.4994]]]}'),
  ('far', '{"type":"Polygon","coordinates":[[[77.6995,27.4995],[77.7005,27.4995],[77.7005,27.5005],[77.6995,27.5005],[77.6995,27.4995]]]}'),
  ('tiny', '{"type":"Polygon","coordinates":[[[77.6,27.5],[77.6001,27.5],[77.6001,27.5001],[77.6,27.5001],[77.6,27.5]]]}'),
  ('bowtie', '{"type":"Polygon","coordinates":[[[77.5995,27.4995],[77.6005,27.5005],[77.6005,27.4995],[77.5995,27.5005],[77.5995,27.4995]]]}'),
  ('point', '{"type":"Point","coordinates":[77.6,27.5]}');
grant select on shapes to authenticated, anon;

-- A real-source observation for field one, as the worker would add it.
insert into public.field_observations (tenant_id, field_id, observed_at, source, processing_version, cloud_cover_pct, quality, ndvi_mean, ndre_mean, ndmi_mean)
values ('d5a00000-0000-4000-8000-00000000000a', 'd5e00000-0000-4000-8000-000000000001', '2026-11-20 05:30+00', 'sentinel-2-l2a', 's2-l2a-v1', 4, 'good', 0.61, 0.38, 0.22);

-- ── Farmer ─────────────────────────────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000002';

select lives_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000001', (select shape from shapes where name = 'square'))$$,
  'a farmer draws the boundary of their own field'
);
select is(
  (select count(*)::integer from public.field_observations where field_id = 'd5e00000-0000-4000-8000-000000000001'),
  1, 'drawing a boundary adds no simulated passes; the farmer reads their field''s real passes'
);
select throws_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000002', (select shape from shapes where name = 'square'))$$,
  'P0002', null, 'a farmer cannot draw another farmer''s boundary'
);
select throws_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000001', (select shape from shapes where name = 'far'))$$,
  '23514', null, 'a boundary far from the field pin is rejected'
);
select throws_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000001', (select shape from shapes where name = 'tiny'))$$,
  '23514', null, 'a boundary under 0.05 acres is rejected'
);
select throws_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000001', (select shape from shapes where name = 'bowtie'))$$,
  '23514', null, 'a self-crossing boundary is rejected'
);
select throws_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000001', (select shape from shapes where name = 'point'))$$,
  '23514', null, 'a shape that is not a polygon is rejected'
);
select throws_ok(
  $$update public.fields set latitude = 27.6 where id = 'd5e00000-0000-4000-8000-000000000001'$$,
  '23514', null, 'the pin cannot move far away from the boundary'
);
select lives_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000001', (select shape from shapes where name = 'bigger'))$$,
  'a farmer redraws the boundary'
);

select throws_ok(
  $$insert into public.field_observations (tenant_id, field_id, observed_at, source, processing_version, cloud_cover_pct, quality, ndvi_mean, ndre_mean, ndmi_mean)
    values ('d5a00000-0000-4000-8000-00000000000a', 'd5e00000-0000-4000-8000-000000000001', now(), 'sentinel-2-l2a', 'x', 0, 'good', 0.9, 0.5, 0.4)$$,
  '42501', null, 'users cannot write observations'
);
select throws_ok(
  $$update public.field_observations set ndvi_mean = 0.9 where field_id = 'd5e00000-0000-4000-8000-000000000001'$$,
  '42501', null, 'users cannot change observations'
);

-- ── Another farmer in the same tenant ─────────────────────────────────────
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000003';
select is(
  (select count(*)::integer from public.field_observations where field_id = 'd5e00000-0000-4000-8000-000000000001'),
  0, 'another farmer cannot read the observations'
);

-- ── Mitra for the village ─────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000001';
select lives_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000002', (select shape from shapes where name = 'square'))$$,
  'a mitra draws the boundary for a farmer they manage'
);
select is(
  (select count(*)::integer from public.field_observations where field_id = 'd5e00000-0000-4000-8000-000000000001'),
  1, 'the mitra reads the observations of farmers they manage'
);

-- ── Another tenant ────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000004';
select is(
  (select count(*)::integer from public.field_observations),
  0, 'an admin of another tenant reads no observations'
);
select throws_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000001', null)$$,
  'P0002', null, 'an admin of another tenant cannot clear the boundary'
);

reset role;
set local role anon;
select throws_ok(
  $$select public.set_field_boundary('d5e00000-0000-4000-8000-000000000001', null)$$,
  '42501', null, 'anonymous users cannot set boundaries'
);

-- Even the table owner cannot rewrite history, and simulated rows are gone
-- for good.
reset role;
select throws_ok(
  $$insert into public.field_observations (tenant_id, field_id, observed_at, source, processing_version, cloud_cover_pct, quality)
    values ('d5a00000-0000-4000-8000-00000000000a', 'd5e00000-0000-4000-8000-000000000001', now(), 'simulated-demo', 'demo-sim-1', 90, 'cloudy')$$,
  '23514', null, 'simulated observations are no longer accepted'
);
select throws_ok(
  $$update public.field_observations set ndvi_mean = 0.9 where field_id = 'd5e00000-0000-4000-8000-000000000001'$$,
  '42501', null, 'observations are append-only'
);

select * from finish();
rollback;
