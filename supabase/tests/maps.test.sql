begin;

create extension if not exists pgtap;

select plan(7);

-- Fixtures (fake data only): tenant A with mitras for villages V1 and V2,
-- one field in V1 with a boundary and one without; tenant B with an admin.
insert into auth.users (id, aud, role, email)
values
  ('a7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'mp-mitra-1@example.test'),
  ('a7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'mp-mitra-2@example.test'),
  ('a7000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'mp-admin-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('a7a00000-0000-4000-8000-00000000000a', 'MP Tenant', 'mp-tenant'),
  ('a7a00000-0000-4000-8000-00000000000b', 'MP Other', 'mp-other');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('a7a00000-0000-4000-8000-00000000000a', 'a7a00000-0000-4000-8000-00000000000a', 'a7000000-0000-4000-8000-000000000001', 'mitra'),
  ('a7a00000-0000-4000-8000-00000000000a', 'a7a00000-0000-4000-8000-00000000000a', 'a7000000-0000-4000-8000-000000000002', 'mitra'),
  ('a7a00000-0000-4000-8000-00000000000b', 'a7a00000-0000-4000-8000-00000000000b', 'a7000000-0000-4000-8000-000000000003', 'organization_admin');

insert into public.regions (id, tenant_id, name)
values ('a7100000-0000-4000-8000-000000000001', 'a7a00000-0000-4000-8000-00000000000a', 'North');
insert into public.villages (id, tenant_id, region_id, name)
values
  ('a7110000-0000-4000-8000-000000000001', 'a7a00000-0000-4000-8000-00000000000a', 'a7100000-0000-4000-8000-000000000001', 'V1'),
  ('a7110000-0000-4000-8000-000000000002', 'a7a00000-0000-4000-8000-00000000000a', 'a7100000-0000-4000-8000-000000000001', 'V2');
insert into public.mitra_villages (tenant_id, village_id, user_id)
values
  ('a7a00000-0000-4000-8000-00000000000a', 'a7110000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001'),
  ('a7a00000-0000-4000-8000-00000000000a', 'a7110000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-000000000002');

insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values ('a7c00000-0000-4000-8000-000000000001', 'a7a00000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ');
insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at)
values ('a7f10000-0000-4000-8000-000000000001', 'a7a00000-0000-4000-8000-00000000000a', 'a7110000-0000-4000-8000-000000000001', 'MP Farmer', '9000000601', now());
insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude, boundary)
values
  ('a7fa0000-0000-4000-8000-000000000001', 'a7a00000-0000-4000-8000-00000000000a', 'a7f10000-0000-4000-8000-000000000001',
   'Boundary plot', 'a7c00000-0000-4000-8000-000000000001', 1, 29.0005, 77.0005,
   'SRID=4326;POLYGON((77 29, 77.001 29, 77.001 29.001, 77 29.001, 77 29))'),
  ('a7fa0000-0000-4000-8000-000000000002', 'a7a00000-0000-4000-8000-00000000000a', 'a7f10000-0000-4000-8000-000000000001',
   'Pin-only plot', 'a7c00000-0000-4000-8000-000000000001', 1, 29.01, 77.01, null);

select is(
  (select prosecdef from pg_proc where oid = 'public.boundary_geojson(public.fields)'::regprocedure),
  false, 'boundary_geojson runs with the caller''s rights (security invoker)'
);
select is(
  has_function_privilege('anon', 'public.boundary_geojson(public.fields)', 'execute'),
  false, 'anonymous users cannot call boundary_geojson'
);

set local role authenticated;

set local "request.jwt.claim.sub" = 'a7000000-0000-4000-8000-000000000001';
select is(
  (select public.boundary_geojson(field) ->> 'type' from public.fields as field where id = 'a7fa0000-0000-4000-8000-000000000001'),
  'Polygon', 'the boundary comes back as a GeoJSON Polygon'
);
select is(
  (select jsonb_array_length(public.boundary_geojson(field) -> 'coordinates' -> 0)
   from public.fields as field where id = 'a7fa0000-0000-4000-8000-000000000001'),
  5, 'the polygon ring keeps all its vertices'
);
select is(
  (select public.boundary_geojson(field) from public.fields as field where id = 'a7fa0000-0000-4000-8000-000000000002'),
  null, 'a field without a boundary returns null'
);

set local "request.jwt.claim.sub" = 'a7000000-0000-4000-8000-000000000002';
select is(
  (select count(public.boundary_geojson(field))::integer from public.fields as field
   where tenant_id = 'a7a00000-0000-4000-8000-00000000000a'),
  0, 'a mitra of another village gets no boundaries (RLS still applies)'
);

set local "request.jwt.claim.sub" = 'a7000000-0000-4000-8000-000000000003';
select is(
  (select count(public.boundary_geojson(field))::integer from public.fields as field
   where tenant_id = 'a7a00000-0000-4000-8000-00000000000a'),
  0, 'another organization''s admin gets no boundaries'
);

select * from finish();
rollback;
