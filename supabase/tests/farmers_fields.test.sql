begin;

create extension if not exists pgtap;

select plan(41);

-- Fixtures (fake data only).
-- Tenant A: org admin, regional admin (North), mitra (village N1), a farmer
-- member with a linked login, and a pilot. Tenant B: org admin.
insert into auth.users (id, aud, role, email)
values
  ('81111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'ff-org-admin-a@example.test'),
  ('82222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'ff-regional-north@example.test'),
  ('83333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'ff-mitra-n1@example.test'),
  ('84444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'ff-farmer-login@example.test'),
  ('85555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'ff-pilot@example.test'),
  ('86666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'ff-org-admin-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('8a000000-0000-4000-8000-00000000000a', 'FF Tenant A', 'ff-tenant-a'),
  ('8b000000-0000-4000-8000-00000000000b', 'FF Tenant B', 'ff-tenant-b');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('8a000000-0000-4000-8000-00000000000a', '8a000000-0000-4000-8000-00000000000a', '81111111-1111-4111-8111-111111111111', 'organization_admin'),
  ('8a000000-0000-4000-8000-00000000000a', '8a000000-0000-4000-8000-00000000000a', '82222222-2222-4222-8222-222222222222', 'regional_admin'),
  ('8a000000-0000-4000-8000-00000000000a', '8a000000-0000-4000-8000-00000000000a', '83333333-3333-4333-8333-333333333333', 'mitra'),
  ('8a000000-0000-4000-8000-00000000000a', '8a000000-0000-4000-8000-00000000000a', '84444444-4444-4444-8444-444444444444', 'farmer'),
  ('8a000000-0000-4000-8000-00000000000a', '8a000000-0000-4000-8000-00000000000a', '85555555-5555-4555-8555-555555555555', 'pilot'),
  ('8b000000-0000-4000-8000-00000000000b', '8b000000-0000-4000-8000-00000000000b', '86666666-6666-4666-8666-666666666666', 'organization_admin');

insert into public.regions (id, tenant_id, name)
values
  ('8a100000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-00000000000a', 'North'),
  ('8a200000-0000-4000-8000-000000000002', '8a000000-0000-4000-8000-00000000000a', 'South'),
  ('8b100000-0000-4000-8000-000000000001', '8b000000-0000-4000-8000-00000000000b', 'B Region');

insert into public.villages (id, tenant_id, region_id, name)
values
  ('8a110000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-00000000000a', '8a100000-0000-4000-8000-000000000001', 'N1'),
  ('8a120000-0000-4000-8000-000000000002', '8a000000-0000-4000-8000-00000000000a', '8a100000-0000-4000-8000-000000000001', 'N2'),
  ('8a210000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-00000000000a', '8a200000-0000-4000-8000-000000000002', 'S1'),
  ('8b110000-0000-4000-8000-000000000001', '8b000000-0000-4000-8000-00000000000b', '8b100000-0000-4000-8000-000000000001', 'B1');

insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values ('8a000000-0000-4000-8000-00000000000a', '8a100000-0000-4000-8000-000000000001', '82222222-2222-4222-8222-222222222222');

insert into public.mitra_villages (tenant_id, village_id, user_id)
values ('8a000000-0000-4000-8000-00000000000a', '8a110000-0000-4000-8000-000000000001', '83333333-3333-4333-8333-333333333333');

insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values
  ('8ac00000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ'),
  ('8bc00000-0000-4000-8000-000000000001', '8b000000-0000-4000-8000-00000000000b', 'rice', 'Rice', 'धान');

insert into public.farmers (id, tenant_id, village_id, full_name, phone, profile_id, consent_recorded_at)
values
  ('8af10000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-00000000000a', '8a110000-0000-4000-8000-000000000001', 'Farmer N1', '9000000001', '84444444-4444-4444-8444-444444444444', now()),
  ('8af20000-0000-4000-8000-000000000002', '8a000000-0000-4000-8000-00000000000a', '8a120000-0000-4000-8000-000000000002', 'Farmer N2', '9000000002', null, now()),
  ('8af30000-0000-4000-8000-000000000003', '8a000000-0000-4000-8000-00000000000a', '8a210000-0000-4000-8000-000000000001', 'Farmer S1', '9000000003', null, now());

insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
values
  ('8aff0000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-00000000000a', '8af10000-0000-4000-8000-000000000001', 'North plot', '8ac00000-0000-4000-8000-000000000001', 2.50, 29.000000, 77.000000),
  ('8aff0000-0000-4000-8000-000000000002', '8a000000-0000-4000-8000-00000000000a', '8af20000-0000-4000-8000-000000000002', 'N2 plot', '8ac00000-0000-4000-8000-000000000001', 1.00, 29.100000, 77.100000),
  ('8aff0000-0000-4000-8000-000000000003', '8a000000-0000-4000-8000-00000000000a', '8af30000-0000-4000-8000-000000000003', 'S1 plot', '8ac00000-0000-4000-8000-000000000001', 4.00, 26.900000, 75.800000);

-- ── Database invariants ────────────────────────────────────────────────────
select ok(
  (select extensions.st_astext(location::extensions.geometry) from public.fields where id = '8aff0000-0000-4000-8000-000000000001') = 'POINT(77 29)',
  'field location is generated from the pin as SRID 4326'
);
select throws_ok(
  $$insert into public.farmers (tenant_id, village_id, full_name, phone, consent_recorded_at)
    values ('8a000000-0000-4000-8000-00000000000a', '8b110000-0000-4000-8000-000000000001', 'X', '9000000009', now())$$,
  '23503', null, 'a farmer cannot belong to another tenant''s village'
);
select throws_ok(
  $$insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('8a000000-0000-4000-8000-00000000000a', '8af10000-0000-4000-8000-000000000001', 'Rice plot', '8bc00000-0000-4000-8000-000000000001', 1, 29, 77)$$,
  '23503', null, 'a field cannot use another tenant''s crop'
);
select throws_ok(
  $$insert into public.farmers (tenant_id, village_id, full_name, phone, consent_recorded_at)
    values ('8a000000-0000-4000-8000-00000000000a', '8a110000-0000-4000-8000-000000000001', 'X', '12345', now())$$,
  '23514', null, 'farmer phone must be a 10-digit Indian mobile number'
);
select throws_ok(
  $$update public.farmers set profile_id = '83333333-3333-4333-8333-333333333333' where id = '8af20000-0000-4000-8000-000000000002'$$,
  '23514', null, 'a farmer can only be linked to a farmer member''s login'
);
select throws_ok(
  $$insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('8a000000-0000-4000-8000-00000000000a', '8af10000-0000-4000-8000-000000000001', ' NORTH PLOT ', '8ac00000-0000-4000-8000-000000000001', 1, 29, 77)$$,
  '23505', null, 'field names are unique per farmer, ignoring case and spacing'
);
select throws_ok(
  $$insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('8a000000-0000-4000-8000-00000000000a', '8af10000-0000-4000-8000-000000000001', 'Zero', '8ac00000-0000-4000-8000-000000000001', 0, 29, 77)$$,
  '23514', null, 'field area must be positive'
);

set local role authenticated;

-- ── Organization admin ─────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '81111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.farmers), 3, 'organization admin sees every farmer in the tenant');
select is((select count(*)::integer from public.fields), 3, 'organization admin sees every field in the tenant');
select throws_ok(
  $$insert into public.farmers (tenant_id, village_id, full_name, phone, consent_recorded_at)
    values ('8b000000-0000-4000-8000-00000000000b', '8b110000-0000-4000-8000-000000000001', 'Injected', '9000000010', now())$$,
  '42501', null, 'organization admin cannot register farmers in another tenant'
);
select is((select count(*)::integer from public.tenant_crops), 1, 'members see only their tenant''s crops');

-- ── Regional admin (North) ─────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '82222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.farmers), 2, 'regional admin sees farmers in their region only');
select is((select count(*)::integer from public.fields), 2, 'regional admin sees fields in their region only');
select throws_ok(
  $$insert into public.farmers (tenant_id, village_id, full_name, phone, consent_recorded_at)
    values ('8a000000-0000-4000-8000-00000000000a', '8a210000-0000-4000-8000-000000000001', 'South', '9000000011', now())$$,
  '42501', null, 'regional admin cannot register farmers outside their region'
);
update public.farmers set full_name = 'Hijacked' where id = '8af30000-0000-4000-8000-000000000003';
select is(
  (select count(*)::integer from public.farmers where full_name = 'Hijacked'),
  0, 'regional admin cannot edit farmers outside their region'
);
select throws_ok(
  $$update public.farmers set village_id = '8a210000-0000-4000-8000-000000000001' where id = '8af20000-0000-4000-8000-000000000002'$$,
  '42501', null, 'regional admin cannot move a farmer into a region they do not manage'
);

-- ── Mitra (village N1) ─────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '83333333-3333-4333-8333-333333333333';
select is((select count(*)::integer from public.farmers), 1, 'mitra sees farmers in their villages only');
select is((select phone from public.farmers where id = '8af10000-0000-4000-8000-000000000001'), '9000000001', 'mitra can read the phone of farmers in their village');
select lives_ok(
  $$insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at)
    values ('8af40000-0000-4000-8000-000000000004', '8a000000-0000-4000-8000-00000000000a', '8a110000-0000-4000-8000-000000000001', 'Registered by mitra', '9000000012', '2000-01-01')$$,
  'mitra can register a farmer in their village'
);
select is(
  (select registered_by from public.farmers where id = '8af40000-0000-4000-8000-000000000004'),
  '83333333-3333-4333-8333-333333333333'::uuid,
  'registered_by is set to the caller'
);
select ok(
  (select consent_recorded_at > now() - interval '1 minute' from public.farmers where id = '8af40000-0000-4000-8000-000000000004'),
  'consent time comes from the server clock, not the client'
);
select throws_ok(
  $$insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at)
    values ('8af40000-0000-4000-8000-000000000004', '8a000000-0000-4000-8000-00000000000a', '8a110000-0000-4000-8000-000000000001', 'Registered by mitra', '9000000012', now())$$,
  '23505', null, 'retrying a registration with the same id cannot create a duplicate'
);
select throws_ok(
  $$insert into public.farmers (tenant_id, village_id, full_name, phone, consent_recorded_at)
    values ('8a000000-0000-4000-8000-00000000000a', '8a120000-0000-4000-8000-000000000002', 'Not my village', '9000000013', now())$$,
  '42501', null, 'mitra cannot register farmers outside their villages'
);
select throws_ok(
  $$insert into public.farmers (tenant_id, village_id, full_name, phone, profile_id, consent_recorded_at)
    values ('8a000000-0000-4000-8000-00000000000a', '8a110000-0000-4000-8000-000000000001', 'Linked', '9000000014', '84444444-4444-4444-8444-444444444444', now())$$,
  '42501', null, 'mitra cannot link a farmer to a login'
);
select lives_ok(
  $$insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('8a000000-0000-4000-8000-00000000000a', '8af10000-0000-4000-8000-000000000001', 'Second plot', '8ac00000-0000-4000-8000-000000000001', 1.25, 29.010000, 77.010000)$$,
  'mitra can add a field for a farmer in their village'
);
select throws_ok(
  $$insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('8a000000-0000-4000-8000-00000000000a', '8af20000-0000-4000-8000-000000000002', 'Sneaky', '8ac00000-0000-4000-8000-000000000001', 1, 29, 77)$$,
  '42501', null, 'mitra cannot add fields for farmers outside their villages'
);
select throws_ok(
  $$update public.fields set boundary = 'SRID=4326;POLYGON((77 29,77.01 29,77.01 29.01,77 29))' where id = '8aff0000-0000-4000-8000-000000000001'$$,
  '42501', null, 'field boundaries cannot be written through the API'
);
delete from public.farmers where id = '8af10000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.farmers where id = '8af10000-0000-4000-8000-000000000001'),
  1, 'mitra cannot delete farmers'
);
select throws_ok(
  $$insert into public.tenant_crops (tenant_id, code, name_en, name_hi) values ('8a000000-0000-4000-8000-00000000000a', 'maize', 'Maize', 'मक्का')$$,
  '42501', null, 'only organization admins manage the crop list'
);

-- ── Farmer with a linked login ─────────────────────────────────────────────
set local "request.jwt.claim.sub" = '84444444-4444-4444-8444-444444444444';
select is((select count(*)::integer from public.farmers), 1, 'a linked farmer sees only their own record');
select is((select count(*)::integer from public.fields), 2, 'a linked farmer sees their own fields');
select throws_ok(
  $$insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('8a000000-0000-4000-8000-00000000000a', '8af10000-0000-4000-8000-000000000001', 'Self-added', '8ac00000-0000-4000-8000-000000000001', 1, 29, 77)$$,
  '42501', null, 'a linked farmer cannot add fields themselves (mitra/admin flow for the MVP)'
);
update public.farmers set full_name = 'Self-renamed' where id = '8af10000-0000-4000-8000-000000000001';
select is(
  (select full_name from public.farmers where id = '8af10000-0000-4000-8000-000000000001'),
  'Farmer N1', 'a linked farmer cannot edit their record directly'
);

-- ── Pilot ──────────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '85555555-5555-4555-8555-555555555555';
select is((select count(*)::integer from public.farmers), 0, 'pilots see no farmers until jobs are assigned');
select is((select count(*)::integer from public.fields), 0, 'pilots see no fields until jobs are assigned');

-- ── Organization admin of tenant B ─────────────────────────────────────────
set local "request.jwt.claim.sub" = '86666666-6666-4666-8666-666666666666';
select is((select count(*)::integer from public.farmers), 0, 'another tenant sees none of tenant A''s farmers');
select is((select count(*)::integer from public.fields), 0, 'another tenant sees none of tenant A''s fields');

-- ── Organization admin deletes; role change revokes mitra access ──────────
set local "request.jwt.claim.sub" = '81111111-1111-4111-8111-111111111111';
select lives_ok(
  $$delete from public.farmers where id = '8af40000-0000-4000-8000-000000000004'$$,
  'organization admin can delete a farmer'
);
select is(
  (select count(*)::integer from public.farmers where id = '8af40000-0000-4000-8000-000000000004'),
  0, 'the deleted farmer is gone'
);

reset role;
update public.organization_members set role = 'farmer' where user_id = '83333333-3333-4333-8333-333333333333';
set local role authenticated;
set local "request.jwt.claim.sub" = '83333333-3333-4333-8333-333333333333';
select is((select count(*)::integer from public.farmers), 0, 'a former mitra loses access to farmers');
select is((select count(*)::integer from public.fields), 0, 'a former mitra loses access to fields');

select * from finish();
rollback;
