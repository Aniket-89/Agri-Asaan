begin;

create extension if not exists pgtap;

select plan(24);

-- Fixtures (fake data only). Tenant S: org admin, North regional admin, a
-- mitra for village N1, farmers in N1 and N2. North capacity: 2 available
-- pilots (+1 unavailable) and 2 active drones (+1 in maintenance) => 2.
insert into auth.users (id, aud, role, email)
values
  ('c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sl-org-admin@example.test'),
  ('c1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sl-regional@example.test'),
  ('c1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sl-mitra@example.test'),
  ('c1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'sl-pilot-1@example.test'),
  ('c1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'sl-pilot-2@example.test'),
  ('c1000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'sl-pilot-3@example.test'),
  ('c1000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'sl-admin-t@example.test');

insert into public.organizations (id, name, slug)
values
  ('cc000000-0000-4000-8000-00000000000a', 'SL Tenant', 'sl-tenant'),
  ('cc000000-0000-4000-8000-00000000000b', 'SL Other', 'sl-other');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000001', 'organization_admin'),
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000002', 'regional_admin'),
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000003', 'mitra'),
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000004', 'pilot'),
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000005', 'pilot'),
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000006', 'pilot'),
  ('cc000000-0000-4000-8000-00000000000b', 'cc000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-000000000007', 'organization_admin');

insert into public.regions (id, tenant_id, name)
values ('cc100000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-00000000000a', 'North');

insert into public.villages (id, tenant_id, region_id, name)
values
  ('cc110000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-00000000000a', 'cc100000-0000-4000-8000-000000000001', 'N1'),
  ('cc120000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-00000000000a', 'cc100000-0000-4000-8000-000000000001', 'N2');

insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values ('cc000000-0000-4000-8000-00000000000a', 'cc100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002');
insert into public.mitra_villages (tenant_id, village_id, user_id)
values ('cc000000-0000-4000-8000-00000000000a', 'cc110000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003');

insert into public.pilot_profiles (tenant_id, user_id, home_region_id, is_active)
values
  ('cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000004', 'cc100000-0000-4000-8000-000000000001', true),
  ('cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000005', 'cc100000-0000-4000-8000-000000000001', true),
  ('cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000006', 'cc100000-0000-4000-8000-000000000001', false);

insert into public.drones (tenant_id, uid, model, home_region_id, status)
values
  ('cc000000-0000-4000-8000-00000000000a', 'SL-01', 'Demo', 'cc100000-0000-4000-8000-000000000001', 'active'),
  ('cc000000-0000-4000-8000-00000000000a', 'SL-02', 'Demo', 'cc100000-0000-4000-8000-000000000001', 'active'),
  ('cc000000-0000-4000-8000-00000000000a', 'SL-03', 'Demo', 'cc100000-0000-4000-8000-000000000001', 'maintenance');

insert into public.spray_slots (id, tenant_id, name_en, name_hi, start_time, end_time, is_active)
values
  ('cc500000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-00000000000a', 'Morning', 'सुबह', '06:00', '09:00', true),
  ('cc500000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-00000000000a', 'Evening', 'शाम', '16:00', '18:30', true),
  ('cc500000-0000-4000-8000-000000000003', 'cc000000-0000-4000-8000-00000000000a', 'Midnight', 'आधी रात', '00:00', '00:01', true),
  ('cc500000-0000-4000-8000-000000000004', 'cc000000-0000-4000-8000-00000000000a', 'Old slot', 'पुराना', '12:00', '13:00', false),
  ('cc500000-0000-4000-8000-000000000009', 'cc000000-0000-4000-8000-00000000000b', 'Other tenant', 'अन्य', '06:00', '09:00', true);

insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values ('ccc00000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ');

insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at)
values
  ('ccf10000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-00000000000a', 'cc110000-0000-4000-8000-000000000001', 'SL F1', '9000000301', now()),
  ('ccf20000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-00000000000a', 'cc110000-0000-4000-8000-000000000001', 'SL F2', '9000000302', now()),
  ('ccf30000-0000-4000-8000-000000000003', 'cc000000-0000-4000-8000-00000000000a', 'cc120000-0000-4000-8000-000000000002', 'SL F3 (N2)', '9000000303', now());

insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
values
  ('ccfa0000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-00000000000a', 'ccf10000-0000-4000-8000-000000000001', 'F1 A', 'ccc00000-0000-4000-8000-000000000001', 1, 29, 77),
  ('ccfa0000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-00000000000a', 'ccf20000-0000-4000-8000-000000000002', 'F2 A', 'ccc00000-0000-4000-8000-000000000001', 1, 29, 77),
  ('ccfa0000-0000-4000-8000-000000000003', 'cc000000-0000-4000-8000-00000000000a', 'ccf20000-0000-4000-8000-000000000002', 'F2 B', 'ccc00000-0000-4000-8000-000000000001', 1, 29, 77);

create temporary table sl_dates as
select
  (now() at time zone 'Asia/Kolkata')::date as today,
  (now() at time zone 'Asia/Kolkata')::date + 3 as soon,
  (now() at time zone 'Asia/Kolkata')::date + 61 as too_late;
grant select on sl_dates to authenticated;

select throws_ok(
  $$insert into public.spray_slots (tenant_id, name_en, name_hi, start_time, end_time)
    values ('cc000000-0000-4000-8000-00000000000a', 'Backwards', 'उल्टा', '10:00', '09:00')$$,
  '23514', null, 'a slot must end after it starts'
);

set local role authenticated;

-- ── Slot configuration ─────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000003';
select is(
  (select count(*)::integer from public.spray_slots where tenant_id = 'cc000000-0000-4000-8000-00000000000a'),
  4, 'members can read their organization''s slots'
);
select is(
  (select count(*)::integer from public.spray_slots where tenant_id = 'cc000000-0000-4000-8000-00000000000b'),
  0, 'members cannot read another organization''s slots'
);

set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000002';
select throws_ok(
  $$insert into public.spray_slots (tenant_id, name_en, name_hi, start_time, end_time)
    values ('cc000000-0000-4000-8000-00000000000a', 'RA slot', 'स्लॉट', '19:00', '20:00')$$,
  '42501', null, 'regional admins cannot create slots'
);

set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000001';
select lives_ok(
  $$insert into public.spray_slots (tenant_id, name_en, name_hi, start_time, end_time)
    values ('cc000000-0000-4000-8000-00000000000a', 'Late', 'देर', '19:00', '20:00')$$,
  'organization admins can create slots'
);
select throws_ok(
  $$update public.spray_slots set start_time = '05:00' where id = 'cc500000-0000-4000-8000-000000000001'$$,
  '42501', null, 'slot times cannot be changed once created (bookings reserve them)'
);
select lives_ok(
  $$update public.spray_slots set name_en = 'Early', is_active = true where id = 'cc500000-0000-4000-8000-000000000001'$$,
  'organization admins can rename or deactivate slots'
);
select throws_ok(
  $$delete from public.spray_slots where id = 'cc500000-0000-4000-8000-000000000004'$$,
  '42501', null, 'slots are never deleted'
);

-- ── Availability (mitra of N1) ─────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000003';
select is(
  (select available from public.list_slot_availability('ccf10000-0000-4000-8000-000000000001', (select soon from sl_dates))
   where slot_id = 'cc500000-0000-4000-8000-000000000001'),
  2, 'capacity counts only available pilots and active drones'
);
select is(
  (select count(*)::integer from public.list_slot_availability('ccf10000-0000-4000-8000-000000000001', (select soon from sl_dates))
   where slot_id = 'cc500000-0000-4000-8000-000000000004'),
  0, 'inactive slots are not offered'
);
select is(
  (select available from public.list_slot_availability('ccf10000-0000-4000-8000-000000000001', (select today from sl_dates))
   where slot_id = 'cc500000-0000-4000-8000-000000000003'),
  0, 'a slot that already started today shows no places'
);
select throws_ok(
  $$select * from public.list_slot_availability('ccf30000-0000-4000-8000-000000000003', (select soon from sl_dates))$$,
  '42501', null, 'availability is only shown to people who can book for the farmer'
);
select throws_ok(
  $$select * from public.list_slot_availability('ccf10000-0000-4000-8000-000000000001', (select too_late from sl_dates))$$,
  '23514', null, 'availability is limited to the next 60 days'
);

-- ── Capacity enforcement ───────────────────────────────────────────────────
select lives_ok(
  $$select public.create_booking('ccb00000-0000-4000-8000-000000000001', 'ccf10000-0000-4000-8000-000000000001',
      array['ccfa0000-0000-4000-8000-000000000001']::uuid[], (select soon from sl_dates), 'cc500000-0000-4000-8000-000000000001')$$,
  'a booking reserves a place in the slot'
);
select is(
  (select slot_id from public.bookings where id = 'ccb00000-0000-4000-8000-000000000001'),
  'cc500000-0000-4000-8000-000000000001'::uuid, 'the booking records its slot'
);
select lives_ok(
  $$select public.create_booking('ccb00000-0000-4000-8000-000000000002', 'ccf20000-0000-4000-8000-000000000002',
      array['ccfa0000-0000-4000-8000-000000000002']::uuid[], (select soon from sl_dates), 'cc500000-0000-4000-8000-000000000001')$$,
  'a second booking takes the last place'
);
select is(
  (select available from public.list_slot_availability('ccf10000-0000-4000-8000-000000000001', (select soon from sl_dates))
   where slot_id = 'cc500000-0000-4000-8000-000000000001'),
  0, 'the slot now shows no places'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'ccf20000-0000-4000-8000-000000000002',
      array['ccfa0000-0000-4000-8000-000000000003']::uuid[], (select soon from sl_dates), 'cc500000-0000-4000-8000-000000000001')$$,
  '23514', 'this slot is full', 'a full slot cannot be booked'
);
select is(
  (select available from public.list_slot_availability('ccf10000-0000-4000-8000-000000000001', (select soon from sl_dates))
   where slot_id = 'cc500000-0000-4000-8000-000000000002'),
  2, 'other slots keep their own capacity'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'ccf20000-0000-4000-8000-000000000002',
      array['ccfa0000-0000-4000-8000-000000000003']::uuid[], (select soon from sl_dates), 'cc500000-0000-4000-8000-000000000009')$$,
  '23514', 'choose an available slot', 'another organization''s slot cannot be booked'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'ccf20000-0000-4000-8000-000000000002',
      array['ccfa0000-0000-4000-8000-000000000003']::uuid[], (select soon from sl_dates), 'cc500000-0000-4000-8000-000000000004')$$,
  '23514', 'choose an available slot', 'an inactive slot cannot be booked'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'ccf20000-0000-4000-8000-000000000002',
      array['ccfa0000-0000-4000-8000-000000000003']::uuid[], (select today from sl_dates), 'cc500000-0000-4000-8000-000000000003')$$,
  '23514', 'choose an available slot', 'a slot that already started today cannot be booked'
);

-- Cancelling frees the place; an unavailable pilot shrinks capacity again.
set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select public.set_booking_status('ccb00000-0000-4000-8000-000000000001', 'cancelled', 'Freed for test')$$,
  'the regional admin cancels a booking'
);
set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000003';
select is(
  (select available from public.list_slot_availability('ccf10000-0000-4000-8000-000000000001', (select soon from sl_dates))
   where slot_id = 'cc500000-0000-4000-8000-000000000001'),
  1, 'a cancelled booking frees its place'
);

select * from finish();
rollback;
