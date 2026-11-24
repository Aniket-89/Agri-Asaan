begin;

create extension if not exists pgtap;

select plan(40);

-- Fixtures (fake data only).
-- Tenant A: org admin, regional admins for North and South, a mitra (village
-- N1), a farmer login linked to farmer F1, and a pilot. Tenant B: org admin.
insert into auth.users (id, aud, role, email)
values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'bk-org-admin@example.test'),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'bk-regional-north@example.test'),
  ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'bk-regional-south@example.test'),
  ('a1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'bk-mitra@example.test'),
  ('a1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'bk-farmer@example.test'),
  ('a1000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'bk-pilot@example.test'),
  ('a1000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'bk-admin-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('ab000000-0000-4000-8000-00000000000a', 'BK Tenant A', 'bk-tenant-a'),
  ('ab000000-0000-4000-8000-00000000000b', 'BK Tenant B', 'bk-tenant-b');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000001', 'organization_admin'),
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000002', 'regional_admin'),
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000003', 'regional_admin'),
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000004', 'mitra'),
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000005', 'farmer'),
  ('ab000000-0000-4000-8000-00000000000a', 'ab000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000006', 'pilot'),
  ('ab000000-0000-4000-8000-00000000000b', 'ab000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000007', 'organization_admin');

insert into public.regions (id, tenant_id, name)
values
  ('ab100000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-00000000000a', 'North'),
  ('ab200000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-00000000000a', 'South');

insert into public.villages (id, tenant_id, region_id, name)
values
  ('ab110000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-00000000000a', 'ab100000-0000-4000-8000-000000000001', 'N1'),
  ('ab120000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-00000000000a', 'ab100000-0000-4000-8000-000000000001', 'N2'),
  ('ab210000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-00000000000a', 'ab200000-0000-4000-8000-000000000002', 'S1');

insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values
  ('ab000000-0000-4000-8000-00000000000a', 'ab100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002'),
  ('ab000000-0000-4000-8000-00000000000a', 'ab200000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003');

insert into public.mitra_villages (tenant_id, village_id, user_id)
values ('ab000000-0000-4000-8000-00000000000a', 'ab110000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004');

insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values ('abc00000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ');

insert into public.farmers (id, tenant_id, village_id, full_name, phone, profile_id, consent_recorded_at)
values
  ('abf10000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-00000000000a', 'ab110000-0000-4000-8000-000000000001', 'F1', '9000000201', 'a1000000-0000-4000-8000-000000000005', now()),
  ('abf20000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-00000000000a', 'ab120000-0000-4000-8000-000000000002', 'F2', '9000000202', null, now());

insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude, is_active)
values
  ('abfa0000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-00000000000a', 'abf10000-0000-4000-8000-000000000001', 'F1 A', 'abc00000-0000-4000-8000-000000000001', 2.00, 29.0, 77.0, true),
  ('abfa0000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-00000000000a', 'abf10000-0000-4000-8000-000000000001', 'F1 B', 'abc00000-0000-4000-8000-000000000001', 1.50, 29.1, 77.1, true),
  ('abfa0000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-00000000000a', 'abf10000-0000-4000-8000-000000000001', 'F1 inactive', 'abc00000-0000-4000-8000-000000000001', 1.00, 29.2, 77.2, false),
  ('abfa0000-0000-4000-8000-000000000004', 'ab000000-0000-4000-8000-00000000000a', 'abf10000-0000-4000-8000-000000000001', 'F1 D', 'abc00000-0000-4000-8000-000000000001', 0.75, 29.3, 77.3, true),
  ('abfb0000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-00000000000a', 'abf20000-0000-4000-8000-000000000002', 'F2 A', 'abc00000-0000-4000-8000-000000000001', 3.00, 29.4, 77.4, true);

create temporary table bk_dates as
select
  (now() at time zone 'Asia/Kolkata')::date + 3 as soon,
  (now() at time zone 'Asia/Kolkata')::date - 1 as yesterday,
  (now() at time zone 'Asia/Kolkata')::date + 61 as too_late;
grant select on bk_dates to authenticated;

set local role authenticated;

-- ── Mitra (village N1) creates a booking ───────────────────────────────────
set local "request.jwt.claim.sub" = 'a1000000-0000-4000-8000-000000000004';

select lives_ok(
  $$select public.create_booking('abb00000-0000-4000-8000-000000000001', 'abf10000-0000-4000-8000-000000000001',
      array['abfa0000-0000-4000-8000-000000000001', 'abfa0000-0000-4000-8000-000000000002']::uuid[],
      (select soon from bk_dates), '  Spray before the rain  ')$$,
  'mitra can book two fields for a farmer in their village'
);
select is(
  (select status::text || '|' || total_acres::text || '|' || notes from public.bookings where id = 'abb00000-0000-4000-8000-000000000001'),
  'requested|3.50|Spray before the rain',
  'booking starts as requested with summed acres and trimmed notes'
);
select is(
  (select village_id::text || '|' || region_id::text || '|' || requested_by::text from public.bookings where id = 'abb00000-0000-4000-8000-000000000001'),
  'ab110000-0000-4000-8000-000000000001|ab100000-0000-4000-8000-000000000001|a1000000-0000-4000-8000-000000000004',
  'booking snapshots village and region and records the requester'
);
select is(
  (select string_agg(field_name || ':' || crop_code || ':' || area_acres, ',' order by field_name) from public.booking_fields where booking_id = 'abb00000-0000-4000-8000-000000000001'),
  'F1 A:wheat:2.00,F1 B:wheat:1.50',
  'booking lines snapshot field name, crop, and acreage'
);
select is(
  (select count(*)::integer from public.booking_status_history where booking_id = 'abb00000-0000-4000-8000-000000000001' and from_status is null and to_status = 'requested'),
  1, 'creation writes the first status history row'
);
select is(
  public.create_booking('abb00000-0000-4000-8000-000000000001', 'abf10000-0000-4000-8000-000000000001',
    array['abfa0000-0000-4000-8000-000000000001']::uuid[], (select soon from bk_dates)),
  'abb00000-0000-4000-8000-000000000001'::uuid,
  'retrying with the same booking id returns the existing booking'
);
select is((select count(*)::integer from public.bookings), 1, 'the retry did not create a second booking');
select throws_ok(
  $$select public.create_booking('abb00000-0000-4000-8000-000000000001', 'abf20000-0000-4000-8000-000000000002',
      array['abfb0000-0000-4000-8000-000000000001']::uuid[], (select soon from bk_dates))$$,
  '23505', null, 'a booking id cannot be reused for a different farmer'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf10000-0000-4000-8000-000000000001',
      array['abfa0000-0000-4000-8000-000000000001']::uuid[], (select soon from bk_dates))$$,
  '23514', 'a field already has an open booking', 'a field cannot have two open bookings'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf20000-0000-4000-8000-000000000002',
      array['abfb0000-0000-4000-8000-000000000001']::uuid[], (select soon from bk_dates))$$,
  '42501', null, 'mitra cannot book for farmers outside their villages'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf10000-0000-4000-8000-000000000001',
      array['abfb0000-0000-4000-8000-000000000001']::uuid[], (select soon from bk_dates))$$,
  '23514', 'fields must be active fields of this farmer', 'a booking cannot include another farmer''s field'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf10000-0000-4000-8000-000000000001',
      array['abfa0000-0000-4000-8000-000000000003']::uuid[], (select soon from bk_dates))$$,
  '23514', 'fields must be active fields of this farmer', 'inactive fields cannot be booked'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf10000-0000-4000-8000-000000000001',
      array['abfa0000-0000-4000-8000-000000000004']::uuid[], (select yesterday from bk_dates))$$,
  '23514', 'preferred date must be within the next 60 days', 'the preferred date cannot be in the past'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf10000-0000-4000-8000-000000000001',
      array['abfa0000-0000-4000-8000-000000000004']::uuid[], (select too_late from bk_dates))$$,
  '23514', 'preferred date must be within the next 60 days', 'the preferred date is at most 60 days ahead'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf10000-0000-4000-8000-000000000001',
      array[]::uuid[], (select soon from bk_dates))$$,
  '23514', 'choose between 1 and 20 different fields', 'a booking needs at least one field'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf10000-0000-4000-8000-000000000001',
      array['abfa0000-0000-4000-8000-000000000004', 'abfa0000-0000-4000-8000-000000000004']::uuid[], (select soon from bk_dates))$$,
  '23514', 'choose between 1 and 20 different fields', 'the same field cannot be listed twice'
);
select throws_ok(
  $$insert into public.bookings (id, tenant_id, farmer_id, village_id, region_id, preferred_date, total_acres)
    values (gen_random_uuid(), 'ab000000-0000-4000-8000-00000000000a', 'abf10000-0000-4000-8000-000000000001',
      'ab110000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001', current_date, 1)$$,
  '42501', null, 'bookings cannot be inserted directly, only through create_booking'
);
select throws_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000001', 'confirmed')$$,
  '42501', null, 'a mitra cannot confirm bookings'
);

-- ── Farmer with a linked login ─────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a1000000-0000-4000-8000-000000000005';
select is((select count(*)::integer from public.bookings), 1, 'a farmer sees bookings for their own fields');
select lives_ok(
  $$select public.create_booking('abb00000-0000-4000-8000-000000000002', 'abf10000-0000-4000-8000-000000000001',
      array['abfa0000-0000-4000-8000-000000000004']::uuid[], (select soon from bk_dates))$$,
  'a farmer can book their own field directly'
);
select throws_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf20000-0000-4000-8000-000000000002',
      array['abfb0000-0000-4000-8000-000000000001']::uuid[], (select soon from bk_dates))$$,
  '42501', null, 'a farmer cannot book for another farmer'
);
select lives_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000002', 'cancelled', 'Changed my mind')$$,
  'a farmer can cancel their own requested booking'
);

-- ── Regression: a NULL requester must not unlock cancellation ──────────────
-- requested_by becomes NULL when the requester's profile is deleted. The
-- mitra can still see the booking (their village) but is neither its
-- requester nor a manager, so cancelling must be refused.
reset role;
insert into public.bookings (id, tenant_id, farmer_id, village_id, region_id, preferred_date, total_acres, requested_by)
values ('abb00000-0000-4000-8000-000000000009', 'ab000000-0000-4000-8000-00000000000a', 'abf10000-0000-4000-8000-000000000001',
  'ab110000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001', current_date + 3, 1, null);
set local role authenticated;
set local "request.jwt.claim.sub" = 'a1000000-0000-4000-8000-000000000004';
select throws_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000009', 'cancelled')$$,
  '42501', null, 'a booking with no recorded requester cannot be cancelled by a non-manager'
);
reset role;
delete from public.bookings where id = 'abb00000-0000-4000-8000-000000000009';
set local role authenticated;

-- ── Regional admin for South: not their region ─────────────────────────────
set local "request.jwt.claim.sub" = 'a1000000-0000-4000-8000-000000000003';
select is((select count(*)::integer from public.bookings), 0, 'a regional admin cannot see other regions'' bookings');
select throws_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000001', 'confirmed')$$,
  'P0002', null, 'a regional admin cannot act on other regions'' bookings'
);

-- ── Regional admin for North ───────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a1000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.bookings), 2, 'the region''s admin sees its bookings');
select throws_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000001', 'rejected', '   ')$$,
  '23514', 'a reason is required to reject', 'rejecting requires a reason'
);
select lives_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000001', 'confirmed')$$,
  'the region''s admin can confirm a requested booking'
);
select throws_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000001', 'confirmed')$$,
  '23514', 'status change not allowed', 'a confirmed booking cannot be confirmed again'
);
select throws_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000001', 'completed')$$,
  '23514', 'status change not allowed', 'jumps that skip assignment are not allowed'
);

-- ── Mitra cannot cancel once confirmed ─────────────────────────────────────
set local "request.jwt.claim.sub" = 'a1000000-0000-4000-8000-000000000004';
select throws_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000001', 'cancelled')$$,
  '42501', null, 'the requester cannot cancel after confirmation'
);

-- ── Pilot and another tenant see nothing ───────────────────────────────────
set local "request.jwt.claim.sub" = 'a1000000-0000-4000-8000-000000000006';
select is((select count(*)::integer from public.bookings), 0, 'pilots see no bookings until assignment');
set local "request.jwt.claim.sub" = 'a1000000-0000-4000-8000-000000000007';
select is((select count(*)::integer from public.booking_fields), 0, 'another tenant sees no booking lines');
select throws_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000001', 'cancelled', 'cross-tenant')$$,
  'P0002', null, 'another tenant cannot change a booking'
);

-- ── Organization admin cancels a confirmed booking ─────────────────────────
set local "request.jwt.claim.sub" = 'a1000000-0000-4000-8000-000000000001';
select lives_ok(
  $$select public.set_booking_status('abb00000-0000-4000-8000-000000000001', 'cancelled', 'Weather alert')$$,
  'an organization admin can cancel a confirmed booking'
);
select is(
  (select string_agg(coalesce(from_status::text, '-') || '>' || to_status::text, ',' order by id)
   from public.booking_status_history where booking_id = 'abb00000-0000-4000-8000-000000000001'),
  '->requested,requested>confirmed,confirmed>cancelled',
  'status history records every transition in order'
);
select lives_ok(
  $$select public.create_booking(gen_random_uuid(), 'abf10000-0000-4000-8000-000000000001',
      array['abfa0000-0000-4000-8000-000000000001']::uuid[], (select soon from bk_dates))$$,
  'a field can be booked again once its earlier booking is closed'
);

-- ── Append-only history and snapshots ──────────────────────────────────────
reset role;
select throws_ok(
  $$update public.booking_status_history set reason = 'rewritten'$$,
  '42501', null, 'status history cannot be edited, even by privileged code'
);
select throws_ok(
  $$delete from public.booking_status_history$$,
  '42501', null, 'status history cannot be deleted'
);
update public.fields set area_acres = 9.00, name = 'Renamed later' where id = 'abfa0000-0000-4000-8000-000000000001';
select is(
  (select field_name || ':' || area_acres from public.booking_fields
   where booking_id = 'abb00000-0000-4000-8000-000000000001' and field_id = 'abfa0000-0000-4000-8000-000000000001'),
  'F1 A:2.00',
  'later field edits do not rewrite booking history'
);

select * from finish();
rollback;
