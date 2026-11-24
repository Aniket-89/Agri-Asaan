begin;

create extension if not exists pgtap;

select plan(32);

-- Fixtures (fake data only). Tenant A: org admin, North regional admin, a
-- mitra, pilots P1 (North), P2 (South), P3 (unavailable); drones D1 (North),
-- D2 (South), D3 (maintenance). Tenant B: an admin, a pilot, and a drone.
-- Slots: Morning 06:00-09:00, Overlap 08:00-10:00, Evening 16:00-18:30.
insert into auth.users (id, aud, role, email)
values
  ('a5000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'as-org-admin@example.test'),
  ('a5000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'as-regional@example.test'),
  ('a5000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'as-mitra@example.test'),
  ('a5000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'as-pilot-1@example.test'),
  ('a5000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'as-pilot-2@example.test'),
  ('a5000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'as-pilot-3@example.test'),
  ('a5000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'as-admin-b@example.test'),
  ('a5000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'as-pilot-b@example.test');

update public.profiles set full_name = 'AS Pilot One' where id = 'a5000000-0000-4000-8000-000000000004';
update public.profiles set full_name = 'AS Pilot Two' where id = 'a5000000-0000-4000-8000-000000000005';

insert into public.organizations (id, name, slug)
values
  ('a5a00000-0000-4000-8000-00000000000a', 'AS Tenant', 'as-tenant'),
  ('a5a00000-0000-4000-8000-00000000000b', 'AS Other', 'as-other');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('a5a00000-0000-4000-8000-00000000000a', 'a5a00000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-000000000001', 'organization_admin'),
  ('a5a00000-0000-4000-8000-00000000000a', 'a5a00000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-000000000002', 'regional_admin'),
  ('a5a00000-0000-4000-8000-00000000000a', 'a5a00000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-000000000003', 'mitra'),
  ('a5a00000-0000-4000-8000-00000000000a', 'a5a00000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-000000000004', 'pilot'),
  ('a5a00000-0000-4000-8000-00000000000a', 'a5a00000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-000000000005', 'pilot'),
  ('a5a00000-0000-4000-8000-00000000000a', 'a5a00000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-000000000006', 'pilot'),
  ('a5a00000-0000-4000-8000-00000000000b', 'a5a00000-0000-4000-8000-00000000000b', 'a5000000-0000-4000-8000-000000000007', 'organization_admin'),
  ('a5a00000-0000-4000-8000-00000000000b', 'a5a00000-0000-4000-8000-00000000000b', 'a5000000-0000-4000-8000-000000000008', 'pilot');

insert into public.regions (id, tenant_id, name)
values
  ('a5100000-0000-4000-8000-000000000001', 'a5a00000-0000-4000-8000-00000000000a', 'North'),
  ('a5100000-0000-4000-8000-000000000002', 'a5a00000-0000-4000-8000-00000000000a', 'South'),
  ('a5100000-0000-4000-8000-000000000009', 'a5a00000-0000-4000-8000-00000000000b', 'B Region');

insert into public.villages (id, tenant_id, region_id, name)
values
  ('a5110000-0000-4000-8000-000000000001', 'a5a00000-0000-4000-8000-00000000000a', 'a5100000-0000-4000-8000-000000000001', 'N1'),
  ('a5120000-0000-4000-8000-000000000002', 'a5a00000-0000-4000-8000-00000000000a', 'a5100000-0000-4000-8000-000000000002', 'S1');

insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values ('a5a00000-0000-4000-8000-00000000000a', 'a5100000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002');
insert into public.mitra_villages (tenant_id, village_id, user_id)
values ('a5a00000-0000-4000-8000-00000000000a', 'a5110000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000003');

insert into public.pilot_profiles (tenant_id, user_id, home_region_id, is_active)
values
  ('a5a00000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-000000000004', 'a5100000-0000-4000-8000-000000000001', true),
  ('a5a00000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-000000000005', 'a5100000-0000-4000-8000-000000000002', true),
  ('a5a00000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-000000000006', 'a5100000-0000-4000-8000-000000000001', false),
  ('a5a00000-0000-4000-8000-00000000000b', 'a5000000-0000-4000-8000-000000000008', 'a5100000-0000-4000-8000-000000000009', true);

insert into public.drones (id, tenant_id, uid, model, home_region_id, status)
values
  ('a5d00000-0000-4000-8000-000000000001', 'a5a00000-0000-4000-8000-00000000000a', 'AS-N-01', 'Demo', 'a5100000-0000-4000-8000-000000000001', 'active'),
  ('a5d00000-0000-4000-8000-000000000002', 'a5a00000-0000-4000-8000-00000000000a', 'AS-S-01', 'Demo', 'a5100000-0000-4000-8000-000000000002', 'active'),
  ('a5d00000-0000-4000-8000-000000000003', 'a5a00000-0000-4000-8000-00000000000a', 'AS-N-02', 'Demo', 'a5100000-0000-4000-8000-000000000001', 'maintenance'),
  ('a5d00000-0000-4000-8000-000000000009', 'a5a00000-0000-4000-8000-00000000000b', 'AS-B-01', 'Demo', 'a5100000-0000-4000-8000-000000000009', 'active');

insert into public.spray_slots (id, tenant_id, name_en, name_hi, start_time, end_time)
values
  ('a5500000-0000-4000-8000-000000000001', 'a5a00000-0000-4000-8000-00000000000a', 'Morning', 'सुबह', '06:00', '09:00'),
  ('a5500000-0000-4000-8000-000000000002', 'a5a00000-0000-4000-8000-00000000000a', 'Overlap', 'बीच', '08:00', '10:00'),
  ('a5500000-0000-4000-8000-000000000003', 'a5a00000-0000-4000-8000-00000000000a', 'Evening', 'शाम', '16:00', '18:30'),
  ('a5500000-0000-4000-8000-000000000004', 'a5a00000-0000-4000-8000-00000000000a', 'Midnight', 'आधी रात', '00:00', '00:01');

insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values ('a5c00000-0000-4000-8000-000000000001', 'a5a00000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ');

insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at)
values
  ('a5f10000-0000-4000-8000-000000000001', 'a5a00000-0000-4000-8000-00000000000a', 'a5110000-0000-4000-8000-000000000001', 'AS F North', '9000000401', now()),
  ('a5f20000-0000-4000-8000-000000000002', 'a5a00000-0000-4000-8000-00000000000a', 'a5120000-0000-4000-8000-000000000002', 'AS F South', '9000000402', now());

insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
values ('a5fa0000-0000-4000-8000-000000000001', 'a5a00000-0000-4000-8000-00000000000a', 'a5f10000-0000-4000-8000-000000000001', 'North A', 'a5c00000-0000-4000-8000-000000000001', 2, 29, 77);

-- Bookings written directly (fixtures): B1 Morning, B2 Overlap, B3 Evening
-- are confirmed in North; B4 is requested in South; B5 has no slot; B6 is
-- today at 00:00-00:01 (already over).
insert into public.bookings (id, tenant_id, farmer_id, village_id, region_id, status, preferred_date, slot_id, total_acres)
select booking.id, 'a5a00000-0000-4000-8000-00000000000a', booking.farmer_id, booking.village_id, booking.region_id,
  booking.status::public.booking_status, (now() at time zone 'Asia/Kolkata')::date + booking.day_offset, booking.slot_id, 2
from (values
  ('a5b00000-0000-4000-8000-000000000001'::uuid, 'a5f10000-0000-4000-8000-000000000001'::uuid, 'a5110000-0000-4000-8000-000000000001'::uuid, 'a5100000-0000-4000-8000-000000000001'::uuid, 'confirmed', 3, 'a5500000-0000-4000-8000-000000000001'::uuid),
  ('a5b00000-0000-4000-8000-000000000002'::uuid, 'a5f10000-0000-4000-8000-000000000001'::uuid, 'a5110000-0000-4000-8000-000000000001'::uuid, 'a5100000-0000-4000-8000-000000000001'::uuid, 'confirmed', 3, 'a5500000-0000-4000-8000-000000000002'::uuid),
  ('a5b00000-0000-4000-8000-000000000003'::uuid, 'a5f10000-0000-4000-8000-000000000001'::uuid, 'a5110000-0000-4000-8000-000000000001'::uuid, 'a5100000-0000-4000-8000-000000000001'::uuid, 'confirmed', 3, 'a5500000-0000-4000-8000-000000000003'::uuid),
  ('a5b00000-0000-4000-8000-000000000004'::uuid, 'a5f20000-0000-4000-8000-000000000002'::uuid, 'a5120000-0000-4000-8000-000000000002'::uuid, 'a5100000-0000-4000-8000-000000000002'::uuid, 'requested', 3, 'a5500000-0000-4000-8000-000000000001'::uuid),
  ('a5b00000-0000-4000-8000-000000000005'::uuid, 'a5f10000-0000-4000-8000-000000000001'::uuid, 'a5110000-0000-4000-8000-000000000001'::uuid, 'a5100000-0000-4000-8000-000000000001'::uuid, 'confirmed', 3, null),
  ('a5b00000-0000-4000-8000-000000000006'::uuid, 'a5f10000-0000-4000-8000-000000000001'::uuid, 'a5110000-0000-4000-8000-000000000001'::uuid, 'a5100000-0000-4000-8000-000000000001'::uuid, 'confirmed', 0, 'a5500000-0000-4000-8000-000000000004'::uuid)
) as booking (id, farmer_id, village_id, region_id, status, day_offset, slot_id);

insert into public.booking_fields (tenant_id, booking_id, farmer_id, field_id, field_name, crop_code, crop_name_en, crop_name_hi, area_acres, latitude, longitude)
values ('a5a00000-0000-4000-8000-00000000000a', 'a5b00000-0000-4000-8000-000000000001', 'a5f10000-0000-4000-8000-000000000001',
        'a5fa0000-0000-4000-8000-000000000001', 'North A', 'wheat', 'Wheat', 'गेहूँ', 2, 29, 77);

set local role authenticated;

-- ── Options (North regional admin) ─────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::integer from public.list_assignment_options('a5b00000-0000-4000-8000-000000000001') where kind = 'pilot'),
  2, 'options list only available pilots of the organization (borrowing across regions allowed)'
);
select is(
  (select id from public.list_assignment_options('a5b00000-0000-4000-8000-000000000001') where kind = 'pilot' limit 1),
  'a5000000-0000-4000-8000-000000000004'::uuid, 'home-region pilots are listed first'
);
select is(
  (select count(*)::integer from public.list_assignment_options('a5b00000-0000-4000-8000-000000000001') where kind = 'drone'),
  2, 'options list only active drones of the organization'
);

-- ── Assign ─────────────────────────────────────────────────────────────────
select lives_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000004', 'a5d00000-0000-4000-8000-000000000001')$$,
  'a regional admin can assign a pilot and drone to a confirmed booking in their region'
);
select is(
  (select status::text from public.bookings where id = 'a5b00000-0000-4000-8000-000000000001'),
  'assigned', 'the booking becomes assigned'
);
select is(
  (select count(*)::integer from public.booking_status_history
   where booking_id = 'a5b00000-0000-4000-8000-000000000001' and from_status = 'confirmed' and to_status = 'assigned'
     and actor_id = 'a5000000-0000-4000-8000-000000000002'),
  1, 'assignment is recorded in status history with the actor'
);
select lives_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000004', 'a5d00000-0000-4000-8000-000000000001')$$,
  'submitting the same assignment again is harmless'
);
select is(
  (select count(*)::integer from public.booking_status_history where booking_id = 'a5b00000-0000-4000-8000-000000000001'),
  1, 'a repeated identical assignment writes no extra history'
);

-- ── Overlap prevention ─────────────────────────────────────────────────────
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000004', 'a5d00000-0000-4000-8000-000000000002')$$,
  '23514', 'pilot already has a job in this slot', 'a pilot cannot be in two overlapping slots'
);
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000005', 'a5d00000-0000-4000-8000-000000000001')$$,
  '23514', 'drone already has a job in this slot', 'a drone cannot be in two overlapping slots'
);
select is(
  (select count(*)::integer from public.list_assignment_options('a5b00000-0000-4000-8000-000000000002')
   where id in ('a5000000-0000-4000-8000-000000000004', 'a5d00000-0000-4000-8000-000000000001')),
  0, 'busy pilots and drones are not offered for an overlapping slot'
);
select lives_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000004', 'a5d00000-0000-4000-8000-000000000001')$$,
  'the same pilot and drone can take a non-overlapping slot that day'
);

-- ── Reassign ───────────────────────────────────────────────────────────────
select lives_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000005', 'a5d00000-0000-4000-8000-000000000002')$$,
  'a region manager can reassign (borrowing a South pilot and drone)'
);
select results_eq(
  $$select is_current, ended_at is not null from public.booking_assignments
    where booking_id = 'a5b00000-0000-4000-8000-000000000001' order by assigned_at, is_current$$,
  $$values (false, true), (true, false)$$,
  'reassigning ends the previous assignment and keeps it as history'
);
select lives_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000004', 'a5d00000-0000-4000-8000-000000000001')$$,
  'a reassignment frees the previous pilot and drone for that slot'
);

-- ── Rules ──────────────────────────────────────────────────────────────────
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000004', 'a5000000-0000-4000-8000-000000000005', 'a5d00000-0000-4000-8000-000000000002')$$,
  'P0002', null, 'a regional admin cannot assign bookings outside their regions'
);

set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000004', 'a5000000-0000-4000-8000-000000000005', 'a5d00000-0000-4000-8000-000000000002')$$,
  '23514', 'only confirmed bookings can be assigned', 'a requested booking must be confirmed before assignment'
);
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000005', 'a5000000-0000-4000-8000-000000000005', 'a5d00000-0000-4000-8000-000000000002')$$,
  '23514', 'booking has no slot', 'a booking without a slot cannot be assigned'
);
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000006', 'a5000000-0000-4000-8000-000000000005', 'a5d00000-0000-4000-8000-000000000002')$$,
  '23514', 'this slot has already ended', 'a slot that has ended cannot be assigned'
);
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000006', 'a5d00000-0000-4000-8000-000000000001')$$,
  '23514', 'pilot is not available', 'an unavailable pilot cannot be assigned'
);
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000008', 'a5d00000-0000-4000-8000-000000000001')$$,
  '23514', 'pilot is not available', 'a pilot from another organization cannot be assigned'
);
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000004', 'a5d00000-0000-4000-8000-000000000003')$$,
  '23514', 'drone is not available', 'a drone in maintenance cannot be assigned'
);

-- ── Denied callers ─────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000005', 'a5d00000-0000-4000-8000-000000000002')$$,
  '42501', null, 'a mitra who can see the booking still cannot assign'
);
select throws_ok(
  $$select * from public.list_assignment_options('a5b00000-0000-4000-8000-000000000003')$$,
  '42501', null, 'a mitra cannot list assignment options'
);
select throws_ok(
  $$insert into public.booking_assignments (tenant_id, booking_id, pilot_user_id, drone_id, work_period)
    values ('a5a00000-0000-4000-8000-00000000000a', 'a5b00000-0000-4000-8000-000000000003',
            'a5000000-0000-4000-8000-000000000005', 'a5d00000-0000-4000-8000-000000000002', tstzrange(now(), now() + interval '1 hour'))$$,
  '42501', null, 'clients cannot write assignments directly'
);

set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000007';
select throws_ok(
  $$select public.assign_booking('a5b00000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000008', 'a5d00000-0000-4000-8000-000000000009')$$,
  'P0002', null, 'another organization''s admin cannot assign (or see) the booking'
);

-- ── Pilot visibility ───────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000005';
select results_eq(
  $$select id from public.bookings$$,
  $$values ('a5b00000-0000-4000-8000-000000000001'::uuid)$$,
  'a pilot sees only the bookings currently assigned to them'
);
select results_eq(
  $$select booking_id, farmer_name, drone_uid, jsonb_array_length(fields)
    from public.list_my_jobs('a5a00000-0000-4000-8000-00000000000a')$$,
  $$values ('a5b00000-0000-4000-8000-000000000001'::uuid, 'AS F North'::text, 'AS-S-01'::text, 1)$$,
  'My jobs lists the pilot''s job with farmer, drone, and fields'
);

set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000006';
select is(
  (select count(*)::integer from public.list_my_jobs('a5a00000-0000-4000-8000-00000000000a')),
  0, 'other pilots get no jobs they are not assigned to'
);

-- ── Cancelling frees the pilot and drone ───────────────────────────────────
set local "request.jwt.claim.sub" = 'a5000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select public.set_booking_status('a5b00000-0000-4000-8000-000000000003', 'cancelled', 'Fake reason: rain')$$,
  'a region manager can cancel an assigned booking'
);
select is(
  (select count(*)::integer from public.booking_assignments
   where booking_id = 'a5b00000-0000-4000-8000-000000000003' and is_current),
  0, 'cancelling ends the assignment'
);

-- ── The constraint is the guarantee, not the function ──────────────────────
reset role;
select throws_ok(
  $$insert into public.booking_assignments (tenant_id, booking_id, pilot_user_id, drone_id, work_period)
    select tenant_id, 'a5b00000-0000-4000-8000-000000000003', pilot_user_id, 'a5d00000-0000-4000-8000-000000000002', work_period
    from public.booking_assignments where booking_id = 'a5b00000-0000-4000-8000-000000000002' and is_current$$,
  '23P01', null, 'the exclusion constraint rejects an overlapping pilot even when written directly'
);

select * from finish();
rollback;
