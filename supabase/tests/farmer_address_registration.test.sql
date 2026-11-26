begin;

create extension if not exists pgtap;

select plan(32);

-- Fixtures (fake data only). One tenant open for farmer sign-ups on
-- ar.example.test: org admin, North and South regional admins, a mitra for
-- North Village, a pilot and drone homed in North, and four farmer logins.
insert into auth.users (id, aud, role, email, created_at)
values
  ('d3000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ar-org-admin@example.test', now()),
  ('d3000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ar-north@example.test', now()),
  ('d3000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'ar-south@example.test', now()),
  ('d3000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'ar-mitra@example.test', now()),
  ('d3000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'ar-pilot@example.test', now()),
  ('d3000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'ar-f1@example.test', now()),
  ('d3000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'ar-f2@example.test', now()),
  ('d3000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'ar-f3@example.test', now()),
  ('d3000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'ar-f4@example.test', now());

insert into public.organizations (id, name, slug)
values ('d3a00000-0000-4000-8000-00000000000a', 'AR Tenant', 'ar-tenant');
insert into public.organization_domains (tenant_id, hostname, is_primary, is_verified)
values ('d3a00000-0000-4000-8000-00000000000a', 'ar.example.test', true, true);
insert into public.organization_features (tenant_id, feature_key, enabled)
values ('d3a00000-0000-4000-8000-00000000000a', 'farmer_self_registration', true);

insert into public.organization_members (tenant_id, organization_id, user_id, role)
select 'd3a00000-0000-4000-8000-00000000000a', 'd3a00000-0000-4000-8000-00000000000a', member.user_id, member.role::public.organization_role
from (values
  ('d3000000-0000-4000-8000-000000000001'::uuid, 'organization_admin'),
  ('d3000000-0000-4000-8000-000000000002'::uuid, 'regional_admin'),
  ('d3000000-0000-4000-8000-000000000003'::uuid, 'regional_admin'),
  ('d3000000-0000-4000-8000-000000000004'::uuid, 'mitra'),
  ('d3000000-0000-4000-8000-000000000005'::uuid, 'pilot')
) as member(user_id, role);

insert into public.regions (id, tenant_id, name)
values
  ('d3100000-0000-4000-8000-000000000001', 'd3a00000-0000-4000-8000-00000000000a', 'North'),
  ('d3100000-0000-4000-8000-000000000002', 'd3a00000-0000-4000-8000-00000000000a', 'South');
insert into public.villages (id, tenant_id, region_id, name)
values
  ('d3200000-0000-4000-8000-000000000001', 'd3a00000-0000-4000-8000-00000000000a', 'd3100000-0000-4000-8000-000000000001', 'North Village'),
  ('d3200000-0000-4000-8000-000000000002', 'd3a00000-0000-4000-8000-00000000000a', 'd3100000-0000-4000-8000-000000000002', 'South Village');
insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values
  ('d3a00000-0000-4000-8000-00000000000a', 'd3100000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002'),
  ('d3a00000-0000-4000-8000-00000000000a', 'd3100000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000003');
insert into public.mitra_villages (tenant_id, village_id, user_id)
values ('d3a00000-0000-4000-8000-00000000000a', 'd3200000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000004');

insert into public.pilot_profiles (tenant_id, user_id, home_region_id, is_active)
values ('d3a00000-0000-4000-8000-00000000000a', 'd3000000-0000-4000-8000-000000000005', 'd3100000-0000-4000-8000-000000000001', true);
insert into public.drones (id, tenant_id, uid, model, home_region_id, status)
values ('d3d00000-0000-4000-8000-000000000001', 'd3a00000-0000-4000-8000-00000000000a', 'AR-01', 'Demo', 'd3100000-0000-4000-8000-000000000001', 'active');
insert into public.spray_slots (id, tenant_id, name_en, name_hi, start_time, end_time)
values ('d3500000-0000-4000-8000-000000000001', 'd3a00000-0000-4000-8000-00000000000a', 'Morning', 'सुबह', '06:00', '09:00');
insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values ('d3c00000-0000-4000-8000-000000000001', 'd3a00000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ');

set local role authenticated;

-- ── Region coverage (LGD codes: district 167 Mathura with tehsils 764
-- Mathura and 761 Chhata; district 118 Agra with tehsil 766 Agra; tehsil 304
-- Dehradun) ───────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000001';
select lives_ok(
  $$insert into public.region_districts (tenant_id, region_id, district_code) values ('d3a00000-0000-4000-8000-00000000000a', 'd3100000-0000-4000-8000-000000000001', 167)$$,
  'an organization admin adds a district to a region'
);
select throws_ok(
  $$insert into public.region_districts (tenant_id, region_id, district_code) values ('d3a00000-0000-4000-8000-00000000000a', 'd3100000-0000-4000-8000-000000000002', 167)$$,
  '23505', null, 'a district belongs to one region per organization'
);
select lives_ok(
  $$insert into public.region_subdistricts (tenant_id, region_id, subdistrict_code) values ('d3a00000-0000-4000-8000-00000000000a', 'd3100000-0000-4000-8000-000000000002', 761)$$,
  'a single tehsil can go to another region'
);
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000002';
select throws_ok(
  $$insert into public.region_districts (tenant_id, region_id, district_code) values ('d3a00000-0000-4000-8000-00000000000a', 'd3100000-0000-4000-8000-000000000001', 118)$$,
  '42501', null, 'regional admins cannot change region coverage'
);
select is((select count(*)::integer from public.region_districts), 1, 'a regional admin sees their region''s districts');
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000004';
select is((select count(*)::integer from public.region_districts), 0, 'mitras see no region coverage');

-- ── Self-registration with an address ──────────────────────────────────────
reset role;
set local role anon;
select is(public.farmer_registration_open('ar.example.test'), true, 'anyone can check that a site takes farmer sign-ups');
select is(public.farmer_registration_open('unknown.example.test'), false, 'unknown sites are closed');
reset role;
set local role authenticated;

set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000011';
select lives_ok(
  $$select public.register_self_as_farmer('ar.example.test', 'AR Farmer One', '9876500011', 764, 'Fake Town', 'Near the fake well', '281001')$$,
  'a farmer registers with a tehsil and address and no village'
);
select is(
  (select coalesce(region_id::text, 'none') || '|' || coalesce(village_id::text, 'none') from public.farmers where profile_id = auth.uid()),
  'd3100000-0000-4000-8000-000000000001|none', 'the tehsil''s district places the farmer in its region, without a village'
);

set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000012';
select public.register_self_as_farmer('ar.example.test', 'AR Farmer Two', '9876500012', 766, 'Far Town', 'Fake road 2', '282001');
select is(
  (select region_id from public.farmers where profile_id = auth.uid()),
  null, 'a tehsil outside every region leaves the farmer without a region'
);

set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000013';
select public.register_self_as_farmer('ar.example.test', 'AR Farmer Three', '9876500013', 764, 'North Village', 'Fake lane 3', '281001', 'd3200000-0000-4000-8000-000000000001');
select is(
  (select region_id::text || '|' || village_id::text from public.farmers where profile_id = auth.uid()),
  'd3100000-0000-4000-8000-000000000001|d3200000-0000-4000-8000-000000000001', 'a listed village places the farmer directly'
);

set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000014';
select throws_ok(
  $$select public.register_self_as_farmer('ar.example.test', 'AR Farmer Four', '9876500014', 764, '  ', 'Fake road 4', '281001')$$,
  '23514', null, 'the village or town name is required'
);
select throws_ok(
  $$select public.register_self_as_farmer('ar.example.test', 'AR Farmer Four', '9876500014', 764, 'Fake Town', 'Fake road 4', '2810')$$,
  '23514', null, 'an invalid pincode is refused'
);
select throws_ok(
  $$select public.register_self_as_farmer('ar.example.test', 'AR Farmer Four', '9876500014', 999999, 'Fake Town', 'Fake road 4', '281001')$$,
  '22023', 'choose your tehsil', 'an unknown tehsil is refused'
);
select is((select count(*)::integer from public.organization_members where user_id = auth.uid()), 0, 'a refused registration leaves no membership');
select public.register_self_as_farmer('ar.example.test', 'AR Farmer Four', '9876500014', 304, 'Lost Town', 'Fake road 4', '248001');

-- A tehsil entry wins over its district: Chhata (761) is in Mathura district
-- (North) but listed for South.
reset role;
insert into auth.users (id, aud, role, email, created_at)
values ('d3000000-0000-4000-8000-000000000015', 'authenticated', 'authenticated', 'ar-f5@example.test', now());
set local role authenticated;
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000015';
select public.register_self_as_farmer('ar.example.test', 'AR Farmer Five', '9876500015', 761, 'Chhata', 'Fake road 5', '281401');
select is(
  (select region_id from public.farmers where profile_id = auth.uid()),
  'd3100000-0000-4000-8000-000000000002'::uuid, 'a tehsil listed for another region overrides its district'
);

-- ── Who sees farmers not placed yet ────────────────────────────────────────
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::integer from public.farmers where profile_id = 'd3000000-0000-4000-8000-000000000011'),
  1, 'the region''s admin sees a farmer placed in their region by tehsil'
);
select is(
  (select count(*)::integer from public.farmers where profile_id in ('d3000000-0000-4000-8000-000000000012', 'd3000000-0000-4000-8000-000000000014')),
  0, 'a regional admin does not see farmers outside every region'
);
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000003';
select is(
  (select count(*)::integer from public.farmers where profile_id = 'd3000000-0000-4000-8000-000000000011'),
  0, 'another region''s admin does not see the farmer'
);
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000004';
select is(
  (select string_agg(full_name, ',' order by full_name) from public.farmers),
  'AR Farmer Three', 'a mitra sees only farmers placed in their villages'
);
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.farmers where region_id is null),
  2, 'the organization admin sees farmers outside every region'
);

-- Covering a district brings its waiting farmers into the region.
insert into public.region_districts (tenant_id, region_id, district_code)
values ('d3a00000-0000-4000-8000-00000000000a', 'd3100000-0000-4000-8000-000000000002', 118);
select is(
  (select region_id from public.farmers where profile_id = 'd3000000-0000-4000-8000-000000000012'),
  'd3100000-0000-4000-8000-000000000002'::uuid, 'adding a district to a region assigns waiting farmers to it'
);

-- ── Booking by region ──────────────────────────────────────────────────────
reset role;
insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
select field.id, 'd3a00000-0000-4000-8000-00000000000a', farmer.id, 'Plot', 'd3c00000-0000-4000-8000-000000000001', 2, 27.5, 77.6
from (values
  ('d3f00000-0000-4000-8000-000000000011'::uuid, 'd3000000-0000-4000-8000-000000000011'::uuid),
  ('d3f00000-0000-4000-8000-000000000014'::uuid, 'd3000000-0000-4000-8000-000000000014'::uuid)
) as field(id, profile_id)
join public.farmers as farmer on farmer.profile_id = field.profile_id;
set local role authenticated;

set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000011';
select is(
  (select available from public.list_slot_availability((select id from public.farmers where profile_id = auth.uid()), current_date + 3)),
  1, 'a farmer not placed yet sees their region''s capacity'
);
select lives_ok(
  $$select public.create_booking('d3b00000-0000-4000-8000-000000000001', (select id from public.farmers where profile_id = auth.uid()),
      array['d3f00000-0000-4000-8000-000000000011'::uuid], current_date + 3, 'd3500000-0000-4000-8000-000000000001')$$,
  'a farmer not placed yet can book'
);
select is(
  (select coalesce(village_id::text, 'none') || '|' || region_id::text from public.bookings where id = 'd3b00000-0000-4000-8000-000000000001'),
  'none|d3100000-0000-4000-8000-000000000001', 'the booking is in the farmer''s region, without a village'
);

set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000014';
select is(
  (select max(available) from public.list_slot_availability((select id from public.farmers where profile_id = auth.uid()), current_date + 3)),
  0, 'a farmer outside every region sees no available places'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), (select id from public.farmers where profile_id = auth.uid()),
      array['d3f00000-0000-4000-8000-000000000014'::uuid], current_date + 3, 'd3500000-0000-4000-8000-000000000001')$$,
  '23514', 'this address is outside the service area', 'a farmer outside every region cannot book yet'
);

-- The assigned pilot sees the farmer's address in place of a village.
reset role;
update public.bookings set status = 'assigned' where id = 'd3b00000-0000-4000-8000-000000000001';
insert into public.booking_assignments (tenant_id, booking_id, pilot_user_id, drone_id, work_period)
values ('d3a00000-0000-4000-8000-00000000000a', 'd3b00000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000005',
  'd3d00000-0000-4000-8000-000000000001', tstzrange(now() + interval '3 days', now() + interval '3 days 2 hours'));
set local role authenticated;
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000005';
select is(
  (select village_name from public.list_my_jobs('d3a00000-0000-4000-8000-00000000000a')),
  'Fake Town, Near the fake well, Mathura, Mathura, 281001', 'the pilot''s job shows the address when there is no village'
);

-- ── Placing a farmer in a village ──────────────────────────────────────────
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000002';
select throws_ok(
  $$update public.farmers set village_id = 'd3200000-0000-4000-8000-000000000002' where profile_id = 'd3000000-0000-4000-8000-000000000011'$$,
  '42501', null, 'a regional admin cannot place a farmer in another region''s village'
);
update public.farmers set village_id = 'd3200000-0000-4000-8000-000000000001' where profile_id = 'd3000000-0000-4000-8000-000000000011';
select is(
  (select village_id from public.bookings where id = 'd3b00000-0000-4000-8000-000000000001'),
  'd3200000-0000-4000-8000-000000000001'::uuid, 'placing the farmer moves their open bookings into the village'
);
set local "request.jwt.claim.sub" = 'd3000000-0000-4000-8000-000000000004';
select is(
  (select count(*)::integer from public.farmers where profile_id = 'd3000000-0000-4000-8000-000000000011'),
  1, 'once placed, the village''s mitra sees the farmer'
);

select * from finish();
rollback;
