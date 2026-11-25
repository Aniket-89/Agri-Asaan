begin;

create extension if not exists pgtap;

select plan(34);

-- Fixtures (fake data only). Tenant A: org admin, North regional admin, a
-- mitra, pilots P1 and P2, one drone. Tenant B: an admin. J1 is today and
-- assigned to P1 (two fields: 2 and 3 acres); J2 is in two days, also P1.
insert into auth.users (id, aud, role, email)
values
  ('a6000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'jb-org-admin@example.test'),
  ('a6000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'jb-regional@example.test'),
  ('a6000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'jb-mitra@example.test'),
  ('a6000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'jb-pilot-1@example.test'),
  ('a6000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'jb-pilot-2@example.test'),
  ('a6000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'jb-admin-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('a6a00000-0000-4000-8000-00000000000a', 'JB Tenant', 'jb-tenant'),
  ('a6a00000-0000-4000-8000-00000000000b', 'JB Other', 'jb-other');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('a6a00000-0000-4000-8000-00000000000a', 'a6a00000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-000000000001', 'organization_admin'),
  ('a6a00000-0000-4000-8000-00000000000a', 'a6a00000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-000000000002', 'regional_admin'),
  ('a6a00000-0000-4000-8000-00000000000a', 'a6a00000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-000000000003', 'mitra'),
  ('a6a00000-0000-4000-8000-00000000000a', 'a6a00000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-000000000004', 'pilot'),
  ('a6a00000-0000-4000-8000-00000000000a', 'a6a00000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-000000000005', 'pilot'),
  ('a6a00000-0000-4000-8000-00000000000b', 'a6a00000-0000-4000-8000-00000000000b', 'a6000000-0000-4000-8000-000000000007', 'organization_admin');

insert into public.regions (id, tenant_id, name)
values ('a6100000-0000-4000-8000-000000000001', 'a6a00000-0000-4000-8000-00000000000a', 'North');
insert into public.villages (id, tenant_id, region_id, name)
values ('a6110000-0000-4000-8000-000000000001', 'a6a00000-0000-4000-8000-00000000000a', 'a6100000-0000-4000-8000-000000000001', 'N1');
insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values ('a6a00000-0000-4000-8000-00000000000a', 'a6100000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002');
insert into public.mitra_villages (tenant_id, village_id, user_id)
values ('a6a00000-0000-4000-8000-00000000000a', 'a6110000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000003');

insert into public.pilot_profiles (tenant_id, user_id, home_region_id)
values
  ('a6a00000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-000000000004', 'a6100000-0000-4000-8000-000000000001'),
  ('a6a00000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-000000000005', 'a6100000-0000-4000-8000-000000000001');
insert into public.drones (id, tenant_id, uid, model, home_region_id)
values ('a6d00000-0000-4000-8000-000000000001', 'a6a00000-0000-4000-8000-00000000000a', 'JB-N-01', 'Demo', 'a6100000-0000-4000-8000-000000000001');
insert into public.spray_slots (id, tenant_id, name_en, name_hi, start_time, end_time)
values ('a6500000-0000-4000-8000-000000000001', 'a6a00000-0000-4000-8000-00000000000a', 'Morning', 'सुबह', '06:00', '09:00');
insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values ('a6c00000-0000-4000-8000-000000000001', 'a6a00000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ');
insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at)
values ('a6f10000-0000-4000-8000-000000000001', 'a6a00000-0000-4000-8000-00000000000a', 'a6110000-0000-4000-8000-000000000001', 'JB Farmer', '9000000501', now());
insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
values
  ('a6fa0000-0000-4000-8000-000000000001', 'a6a00000-0000-4000-8000-00000000000a', 'a6f10000-0000-4000-8000-000000000001', 'Plot A', 'a6c00000-0000-4000-8000-000000000001', 2, 29, 77),
  ('a6fa0000-0000-4000-8000-000000000002', 'a6a00000-0000-4000-8000-00000000000a', 'a6f10000-0000-4000-8000-000000000001', 'Plot B', 'a6c00000-0000-4000-8000-000000000001', 3, 29, 77),
  ('a6fa0000-0000-4000-8000-000000000003', 'a6a00000-0000-4000-8000-00000000000a', 'a6f10000-0000-4000-8000-000000000001', 'Plot C', 'a6c00000-0000-4000-8000-000000000001', 1, 29, 77);

insert into public.bookings (id, tenant_id, farmer_id, village_id, region_id, status, preferred_date, slot_id, total_acres)
values
  ('a6b00000-0000-4000-8000-000000000001', 'a6a00000-0000-4000-8000-00000000000a', 'a6f10000-0000-4000-8000-000000000001',
   'a6110000-0000-4000-8000-000000000001', 'a6100000-0000-4000-8000-000000000001', 'assigned',
   (now() at time zone 'Asia/Kolkata')::date, 'a6500000-0000-4000-8000-000000000001', 5),
  ('a6b00000-0000-4000-8000-000000000002', 'a6a00000-0000-4000-8000-00000000000a', 'a6f10000-0000-4000-8000-000000000001',
   'a6110000-0000-4000-8000-000000000001', 'a6100000-0000-4000-8000-000000000001', 'assigned',
   (now() at time zone 'Asia/Kolkata')::date + 2, 'a6500000-0000-4000-8000-000000000001', 1);

insert into public.booking_fields (tenant_id, booking_id, farmer_id, field_id, field_name, crop_code, crop_name_en, crop_name_hi, area_acres, latitude, longitude)
values
  ('a6a00000-0000-4000-8000-00000000000a', 'a6b00000-0000-4000-8000-000000000001', 'a6f10000-0000-4000-8000-000000000001', 'a6fa0000-0000-4000-8000-000000000001', 'Plot A', 'wheat', 'Wheat', 'गेहूँ', 2, 29, 77),
  ('a6a00000-0000-4000-8000-00000000000a', 'a6b00000-0000-4000-8000-000000000001', 'a6f10000-0000-4000-8000-000000000001', 'a6fa0000-0000-4000-8000-000000000002', 'Plot B', 'wheat', 'Wheat', 'गेहूँ', 3, 29, 77),
  ('a6a00000-0000-4000-8000-00000000000a', 'a6b00000-0000-4000-8000-000000000002', 'a6f10000-0000-4000-8000-000000000001', 'a6fa0000-0000-4000-8000-000000000003', 'Plot C', 'wheat', 'Wheat', 'गेहूँ', 1, 29, 77);

-- Assignments written directly (the slot may already be over today).
insert into public.booking_assignments (tenant_id, booking_id, pilot_user_id, drone_id, work_period)
select booking.tenant_id, booking.id, 'a6000000-0000-4000-8000-000000000004', 'a6d00000-0000-4000-8000-000000000001',
  tstzrange((booking.preferred_date + time '06:00') at time zone 'Asia/Kolkata', (booking.preferred_date + time '09:00') at time zone 'Asia/Kolkata')
from public.bookings as booking
where booking.id in ('a6b00000-0000-4000-8000-000000000001', 'a6b00000-0000-4000-8000-000000000002');

select throws_ok(
  $$update public.booking_fields set actual_acres = 5
    where booking_id = 'a6b00000-0000-4000-8000-000000000001' and field_id = 'a6fa0000-0000-4000-8000-000000000001'$$,
  '23514', null, 'actual acres can never exceed twice a field''s booked acres (typo guard)'
);

set local role authenticated;

-- ── Start ──────────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a6000000-0000-4000-8000-000000000005';
select throws_ok(
  $$select public.start_job('a6b00000-0000-4000-8000-000000000001')$$,
  'P0002', null, 'a pilot cannot start (or see) a job assigned to someone else'
);
set local "request.jwt.claim.sub" = 'a6000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select public.start_job('a6b00000-0000-4000-8000-000000000001')$$,
  '42501', null, 'a mitra who can see the booking cannot start the job'
);
set local "request.jwt.claim.sub" = 'a6000000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.start_job('a6b00000-0000-4000-8000-000000000001')$$,
  '42501', null, 'a regional admin cannot start the job for the pilot'
);

set local "request.jwt.claim.sub" = 'a6000000-0000-4000-8000-000000000004';
select throws_ok(
  $$select public.start_job('a6b00000-0000-4000-8000-000000000002')$$,
  '23514', 'a job can only be started on its day', 'a job cannot be started before its day'
);
select lives_ok(
  $$select public.start_job('a6b00000-0000-4000-8000-000000000001')$$,
  'the assigned pilot can start the job on its day'
);
select results_eq(
  $$select status::text, started_at is not null from public.bookings where id = 'a6b00000-0000-4000-8000-000000000001'$$,
  $$values ('in_progress'::text, true)$$,
  'the job is in progress with a start time'
);
select is(
  (select count(*)::integer from public.booking_status_history
   where booking_id = 'a6b00000-0000-4000-8000-000000000001' and from_status = 'assigned' and to_status = 'in_progress'
     and actor_id = 'a6000000-0000-4000-8000-000000000004'),
  1, 'starting is recorded in status history'
);
select throws_ok(
  $$select public.start_job('a6b00000-0000-4000-8000-000000000001')$$,
  '23514', 'only an assigned job can be started', 'a job cannot be started twice'
);

-- ── Complete: validation ───────────────────────────────────────────────────
select throws_ok(
  $$select public.complete_job('a6b00000-0000-4000-8000-000000000001',
    array['a6fa0000-0000-4000-8000-000000000001']::uuid[], array[2]::numeric[])$$,
  '23514', null, 'every booked field needs a value'
);
select throws_ok(
  $$select public.complete_job('a6b00000-0000-4000-8000-000000000001',
    array['a6fa0000-0000-4000-8000-000000000001', 'a6fa0000-0000-4000-8000-000000000002']::uuid[], array[4.01, 3]::numeric[])$$,
  '23514', null, 'acres cannot exceed twice the booked acres'
);
select throws_ok(
  $$select public.complete_job('a6b00000-0000-4000-8000-000000000001',
    array['a6fa0000-0000-4000-8000-000000000001', 'a6fa0000-0000-4000-8000-000000000002']::uuid[], array[-1, 3]::numeric[])$$,
  '23514', null, 'acres cannot be negative'
);
select throws_ok(
  $$select public.complete_job('a6b00000-0000-4000-8000-000000000001',
    array['a6fa0000-0000-4000-8000-000000000001', 'a6fa0000-0000-4000-8000-000000000003']::uuid[], array[1, 1]::numeric[])$$,
  '23514', null, 'a field from another booking is rejected'
);
select throws_ok(
  $$select public.complete_job('a6b00000-0000-4000-8000-000000000001',
    array['a6fa0000-0000-4000-8000-000000000001', 'a6fa0000-0000-4000-8000-000000000002']::uuid[], array[0, 0]::numeric[])$$,
  '23514', 'the acres sprayed must be more than zero', 'a job with nothing sprayed cannot be completed'
);
select throws_ok(
  $$select public.complete_job('a6b00000-0000-4000-8000-000000000002',
    array['a6fa0000-0000-4000-8000-000000000003']::uuid[], array[1]::numeric[])$$,
  '23514', 'only a started job can be completed', 'a job must be started before it is completed'
);

-- ── Complete ───────────────────────────────────────────────────────────────
select lives_ok(
  $$select public.complete_job('a6b00000-0000-4000-8000-000000000001',
    array['a6fa0000-0000-4000-8000-000000000001', 'a6fa0000-0000-4000-8000-000000000002']::uuid[],
    array[1.5, 3]::numeric[], 'Fake note: wind picked up')$$,
  'the assigned pilot can complete the job with actual acres per field'
);
select results_eq(
  $$select status::text, actual_total_acres, completion_notes from public.bookings where id = 'a6b00000-0000-4000-8000-000000000001'$$,
  $$values ('completed'::text, 4.50::numeric, 'Fake note: wind picked up'::text)$$,
  'the job is completed with the total sprayed and the note'
);
select results_eq(
  $$select field_name, actual_acres from public.booking_fields
    where booking_id = 'a6b00000-0000-4000-8000-000000000001' order by field_name$$,
  $$values ('Plot A'::text, 1.50::numeric), ('Plot B'::text, 3.00::numeric)$$,
  'actual acres are stored per field'
);
select throws_ok(
  $$update public.booking_fields set actual_acres = 2 where booking_id = 'a6b00000-0000-4000-8000-000000000001'$$,
  '42501', null, 'pilots cannot write actual acres directly'
);
select results_eq(
  $$select status::text, actual_total_acres from public.list_my_jobs('a6a00000-0000-4000-8000-00000000000a')
    where booking_id = 'a6b00000-0000-4000-8000-000000000001'$$,
  $$values ('completed'::text, 4.50::numeric)$$,
  'a completed job stays on the pilot''s list (Completed tab) with the acres sprayed'
);

-- ── Review: denied ─────────────────────────────────────────────────────────
select throws_ok(
  $$select public.set_booking_status('a6b00000-0000-4000-8000-000000000001', 'verified')$$,
  '42501', null, 'the pilot cannot verify their own job'
);
set local "request.jwt.claim.sub" = 'a6000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select public.set_booking_status('a6b00000-0000-4000-8000-000000000001', 'verified')$$,
  '42501', null, 'a mitra cannot verify a job'
);
set local "request.jwt.claim.sub" = 'a6000000-0000-4000-8000-000000000007';
select throws_ok(
  $$select public.set_booking_status('a6b00000-0000-4000-8000-000000000001', 'verified')$$,
  'P0002', null, 'another organization''s admin cannot verify (or see) the job'
);

-- ── Send back ──────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a6000000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.set_booking_status('a6b00000-0000-4000-8000-000000000001', 'in_progress')$$,
  '23514', 'a reason is required to send a job back', 'sending a job back needs a reason'
);
select lives_ok(
  $$select public.set_booking_status('a6b00000-0000-4000-8000-000000000001', 'in_progress', 'Fake reason: Plot A looks fully sprayed')$$,
  'a region manager can send a completed job back to the pilot'
);
select results_eq(
  $$select status::text, completed_at is null from public.bookings where id = 'a6b00000-0000-4000-8000-000000000001'$$,
  $$values ('in_progress'::text, true)$$,
  'the job is back in progress'
);

set local "request.jwt.claim.sub" = 'a6000000-0000-4000-8000-000000000004';
select results_eq(
  $$select sent_back_reason, (fields -> 0 ->> 'actual_acres')::numeric
    from public.list_my_jobs('a6a00000-0000-4000-8000-00000000000a')
    where booking_id = 'a6b00000-0000-4000-8000-000000000001'$$,
  $$values ('Fake reason: Plot A looks fully sprayed'::text, 1.50::numeric)$$,
  'the pilot sees the job again with the reason and their previous acres'
);
select lives_ok(
  $$select public.complete_job('a6b00000-0000-4000-8000-000000000001',
    array['a6fa0000-0000-4000-8000-000000000001', 'a6fa0000-0000-4000-8000-000000000002']::uuid[], array[2.3, 3]::numeric[])$$,
  'the pilot can record a mission-plan area above the booked acres (2.3 on a 2-acre field)'
);

-- ── Verify ─────────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a6000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select public.set_booking_status('a6b00000-0000-4000-8000-000000000001', 'verified')$$,
  'a region manager can verify a completed job'
);
select results_eq(
  $$select status::text, actual_total_acres, verified_by, verified_at is not null
    from public.bookings where id = 'a6b00000-0000-4000-8000-000000000001'$$,
  $$values ('verified'::text, 5.30::numeric, 'a6000000-0000-4000-8000-000000000002'::uuid, true)$$,
  'verification records the corrected total, who verified, and when'
);
select is(
  (select array_agg(to_status::text order by id) from public.booking_status_history
   where booking_id = 'a6b00000-0000-4000-8000-000000000001'),
  array['in_progress', 'completed', 'in_progress', 'completed', 'verified'],
  'the full execution trail is in status history'
);
select throws_ok(
  $$select public.set_booking_status('a6b00000-0000-4000-8000-000000000001', 'verified')$$,
  '23514', 'status change not allowed', 'a job cannot be verified twice'
);
select throws_ok(
  $$select public.set_booking_status('a6b00000-0000-4000-8000-000000000001', 'cancelled')$$,
  '23514', 'status change not allowed', 'a verified job cannot be cancelled'
);
select throws_ok(
  $$select public.set_booking_status('a6b00000-0000-4000-8000-000000000002', 'verified')$$,
  '23514', 'status change not allowed', 'a job that was not completed cannot be verified'
);

select * from finish();
rollback;
