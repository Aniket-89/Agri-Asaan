begin;

create extension if not exists pgtap;

select plan(20);

-- Fixtures (fake data only). North has a rate of 450/acre, South has none.
-- Booking 1 (North) and booking 2 (South) are in progress for the pilot;
-- booking 3 (North) is only assigned.
insert into auth.users (id, aud, role, email, created_at)
values
  ('d5000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'jp-org-admin@example.test', now()),
  ('d5000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'jp-north@example.test', now()),
  ('d5000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'jp-south@example.test', now()),
  ('d5000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'jp-pilot@example.test', now()),
  ('d5000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'jp-other-pilot@example.test', now()),
  ('d5000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'jp-farmer@example.test', now());

insert into public.organizations (id, name, slug)
values ('d5a00000-0000-4000-8000-00000000000a', 'JP Tenant', 'jp-tenant');
insert into public.organization_settings (tenant_id, upi_id, upi_payee_name)
values ('d5a00000-0000-4000-8000-00000000000a', 'jp.demo@example', 'JP Demo');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
select 'd5a00000-0000-4000-8000-00000000000a', 'd5a00000-0000-4000-8000-00000000000a', member.user_id, member.role::public.organization_role
from (values
  ('d5000000-0000-4000-8000-000000000001'::uuid, 'organization_admin'),
  ('d5000000-0000-4000-8000-000000000002'::uuid, 'regional_admin'),
  ('d5000000-0000-4000-8000-000000000003'::uuid, 'regional_admin'),
  ('d5000000-0000-4000-8000-000000000004'::uuid, 'pilot'),
  ('d5000000-0000-4000-8000-000000000005'::uuid, 'pilot'),
  ('d5000000-0000-4000-8000-000000000006'::uuid, 'farmer')
) as member(user_id, role);

insert into public.regions (id, tenant_id, name, rate_per_acre)
values
  ('d5100000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'North', 450),
  ('d5100000-0000-4000-8000-000000000002', 'd5a00000-0000-4000-8000-00000000000a', 'South', null);
insert into public.villages (id, tenant_id, region_id, name)
values
  ('d5200000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'd5100000-0000-4000-8000-000000000001', 'North Village'),
  ('d5200000-0000-4000-8000-000000000002', 'd5a00000-0000-4000-8000-00000000000a', 'd5100000-0000-4000-8000-000000000002', 'South Village');
insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values
  ('d5a00000-0000-4000-8000-00000000000a', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002'),
  ('d5a00000-0000-4000-8000-00000000000a', 'd5100000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000003');

insert into public.pilot_profiles (tenant_id, user_id, home_region_id, is_active)
values ('d5a00000-0000-4000-8000-00000000000a', 'd5000000-0000-4000-8000-000000000004', 'd5100000-0000-4000-8000-000000000001', true);
insert into public.drones (id, tenant_id, uid, model, home_region_id, status)
values ('d5d00000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'JP-01', 'Demo', 'd5100000-0000-4000-8000-000000000001', 'active');
insert into public.spray_slots (id, tenant_id, name_en, name_hi, start_time, end_time)
values ('d5500000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'Morning', 'सुबह', '06:00', '09:00');

insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at, profile_id)
values ('d5f00000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'd5200000-0000-4000-8000-000000000001', 'JP Farmer', '9000000901', now(), 'd5000000-0000-4000-8000-000000000006');

insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values ('d5c00000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ');
insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
select field.id, 'd5a00000-0000-4000-8000-00000000000a', 'd5f00000-0000-4000-8000-000000000001', field.name,
  'd5c00000-0000-4000-8000-000000000001', field.acres, 29, 77
from (values
  ('d5e00000-0000-4000-8000-000000000001'::uuid, 'Plot A', 2),
  ('d5e00000-0000-4000-8000-000000000002'::uuid, 'Plot B', 1),
  ('d5e00000-0000-4000-8000-000000000003'::uuid, 'Plot C', 1)
) as field(id, name, acres);

insert into public.bookings (id, tenant_id, farmer_id, village_id, region_id, status, preferred_date, slot_id, total_acres)
values
  ('d5b00000-0000-4000-8000-000000000001', 'd5a00000-0000-4000-8000-00000000000a', 'd5f00000-0000-4000-8000-000000000001', 'd5200000-0000-4000-8000-000000000001', 'd5100000-0000-4000-8000-000000000001', 'in_progress', current_date, 'd5500000-0000-4000-8000-000000000001', 2),
  ('d5b00000-0000-4000-8000-000000000002', 'd5a00000-0000-4000-8000-00000000000a', 'd5f00000-0000-4000-8000-000000000001', 'd5200000-0000-4000-8000-000000000002', 'd5100000-0000-4000-8000-000000000002', 'in_progress', current_date + 1, 'd5500000-0000-4000-8000-000000000001', 1),
  ('d5b00000-0000-4000-8000-000000000003', 'd5a00000-0000-4000-8000-00000000000a', 'd5f00000-0000-4000-8000-000000000001', 'd5200000-0000-4000-8000-000000000001', 'd5100000-0000-4000-8000-000000000001', 'assigned', current_date + 2, 'd5500000-0000-4000-8000-000000000001', 1);
insert into public.booking_fields (tenant_id, booking_id, farmer_id, field_id, field_name, crop_code, crop_name_en, crop_name_hi, area_acres, latitude, longitude)
values
  ('d5a00000-0000-4000-8000-00000000000a', 'd5b00000-0000-4000-8000-000000000001', 'd5f00000-0000-4000-8000-000000000001', 'd5e00000-0000-4000-8000-000000000001', 'Plot A', 'wheat', 'Wheat', 'गेहूँ', 2, 29, 77),
  ('d5a00000-0000-4000-8000-00000000000a', 'd5b00000-0000-4000-8000-000000000002', 'd5f00000-0000-4000-8000-000000000001', 'd5e00000-0000-4000-8000-000000000002', 'Plot B', 'wheat', 'Wheat', 'गेहूँ', 1, 29, 77),
  ('d5a00000-0000-4000-8000-00000000000a', 'd5b00000-0000-4000-8000-000000000003', 'd5f00000-0000-4000-8000-000000000001', 'd5e00000-0000-4000-8000-000000000003', 'Plot C', 'wheat', 'Wheat', 'गेहूँ', 1, 29, 77);
insert into public.booking_assignments (tenant_id, booking_id, pilot_user_id, drone_id, work_period)
select 'd5a00000-0000-4000-8000-00000000000a', booking.id, 'd5000000-0000-4000-8000-000000000004', 'd5d00000-0000-4000-8000-000000000001',
  tstzrange(now() + make_interval(days => booking.n * 2), now() + make_interval(days => booking.n * 2, hours => 2))
from (values
  ('d5b00000-0000-4000-8000-000000000001'::uuid, 0),
  ('d5b00000-0000-4000-8000-000000000002'::uuid, 1),
  ('d5b00000-0000-4000-8000-000000000003'::uuid, 2)
) as booking(id, n);

set local role authenticated;

-- ── Completion fixes the amount ────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000004';
select lives_ok(
  $$select public.complete_job('d5b00000-0000-4000-8000-000000000001', array['d5e00000-0000-4000-8000-000000000001'::uuid], array[2.5])$$,
  'the pilot completes a job'
);
select is(
  (select amount_due::text || '|' || rate_per_acre::text from public.bookings where id = 'd5b00000-0000-4000-8000-000000000001'),
  '1125.00|450.00', 'the amount is the region rate times the acres sprayed'
);
select lives_ok(
  $$select public.complete_job('d5b00000-0000-4000-8000-000000000002', array['d5e00000-0000-4000-8000-000000000002'::uuid], array[1])$$,
  'a job in a region without a rate can still be completed'
);
select is(
  (select amount_due from public.bookings where id = 'd5b00000-0000-4000-8000-000000000002'),
  null, 'with no region rate there is no amount due'
);
select is(
  (select amount_due from public.list_my_jobs('d5a00000-0000-4000-8000-00000000000a') where booking_id = 'd5b00000-0000-4000-8000-000000000001'),
  1125.00::numeric, 'the pilot''s job list shows the amount due'
);
select is(
  (select upi_id || '|' || payee_name || '|' || amount_due::text from public.get_booking_payment('d5b00000-0000-4000-8000-000000000001')),
  'jp.demo@example|JP Demo|1125.00', 'the pilot gets the UPI details for the QR'
);

-- ── Who sees payment details ───────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000006';
select is(
  (select amount_due from public.get_booking_payment('d5b00000-0000-4000-8000-000000000001')),
  1125.00::numeric, 'the farmer sees what they owe'
);
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000005';
select is(
  (select count(*)::integer from public.get_booking_payment('d5b00000-0000-4000-8000-000000000001')),
  0, 'another pilot sees nothing'
);

-- ── Recording payment ──────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000006';
select throws_ok(
  $$select public.record_job_payment('d5b00000-0000-4000-8000-000000000001')$$,
  '42501', null, 'a farmer cannot mark their own job paid'
);
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select public.record_job_payment('d5b00000-0000-4000-8000-000000000001')$$,
  'P0002', null, 'another region''s admin cannot record payment'
);
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000004';
select throws_ok(
  $$select public.record_job_payment('d5b00000-0000-4000-8000-000000000003')$$,
  '23514', 'only a completed job can be paid', 'a job that is not completed cannot be paid'
);
select throws_ok(
  $$select public.record_job_payment('d5b00000-0000-4000-8000-000000000002')$$,
  '23514', 'this job has no amount due', 'a job without an amount cannot be marked paid'
);
select lives_ok(
  $$select public.record_job_payment('d5b00000-0000-4000-8000-000000000001')$$,
  'the pilot records the payment'
);
select is(
  (select (paid_at is not null)::text || '|' || paid_recorded_by::text from public.bookings where id = 'd5b00000-0000-4000-8000-000000000001'),
  'true|d5000000-0000-4000-8000-000000000004', 'the payment time and who recorded it are stored'
);
select throws_ok(
  $$select public.record_job_payment('d5b00000-0000-4000-8000-000000000001')$$,
  '23514', 'this job is already paid', 'a job cannot be paid twice'
);

-- ── Rates ──────────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000002';
update public.regions set rate_per_acre = 1 where id = 'd5100000-0000-4000-8000-000000000001';
select is(
  (select rate_per_acre from public.regions where id = 'd5100000-0000-4000-8000-000000000001'),
  450.00::numeric, 'a regional admin cannot change the rate'
);
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000001';
select lives_ok(
  $$update public.regions set rate_per_acre = 500 where id = 'd5100000-0000-4000-8000-000000000001'$$,
  'an organization admin sets the rate'
);
select is(
  (select amount_due from public.bookings where id = 'd5b00000-0000-4000-8000-000000000001'),
  1125.00::numeric, 'changing the rate does not change past jobs'
);
select throws_ok(
  $$update public.regions set rate_per_acre = 0 where id = 'd5100000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a rate must be above zero'
);

-- A region manager can record a payment too.
reset role;
update public.regions set rate_per_acre = 300 where id = 'd5100000-0000-4000-8000-000000000002';
update public.bookings set amount_due = 300, rate_per_acre = 300 where id = 'd5b00000-0000-4000-8000-000000000002';
set local role authenticated;
set local "request.jwt.claim.sub" = 'd5000000-0000-4000-8000-000000000003';
select lives_ok(
  $$select public.record_job_payment('d5b00000-0000-4000-8000-000000000002')$$,
  'the region''s admin records a payment (for example cash paid later)'
);

select * from finish();
rollback;
