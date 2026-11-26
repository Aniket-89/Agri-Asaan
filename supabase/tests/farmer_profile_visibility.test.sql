begin;

create extension if not exists pgtap;

select plan(8);

-- Fixtures (fake data only): one tenant with a regional admin, a mitra, a
-- pilot, an unrelated pilot, and two farmers with logins. Farmer 1 has a
-- booking that the mitra confirmed and the pilot is assigned to.
insert into auth.users (id, aud, role, email, created_at)
values
  ('f7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pv-regional@example.test', now()),
  ('f7000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pv-mitra@example.test', now()),
  ('f7000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pv-pilot@example.test', now()),
  ('f7000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'pv-other-pilot@example.test', now()),
  ('f7000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'pv-farmer-1@example.test', now()),
  ('f7000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'pv-farmer-2@example.test', now());

insert into public.organizations (id, name, slug)
values ('f7a00000-0000-4000-8000-00000000000a', 'PV Tenant', 'pv-tenant');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
select 'f7a00000-0000-4000-8000-00000000000a', 'f7a00000-0000-4000-8000-00000000000a', member.user_id, member.role::public.organization_role
from (values
  ('f7000000-0000-4000-8000-000000000001'::uuid, 'regional_admin'),
  ('f7000000-0000-4000-8000-000000000002'::uuid, 'mitra'),
  ('f7000000-0000-4000-8000-000000000003'::uuid, 'pilot'),
  ('f7000000-0000-4000-8000-000000000004'::uuid, 'pilot'),
  ('f7000000-0000-4000-8000-000000000005'::uuid, 'farmer'),
  ('f7000000-0000-4000-8000-000000000006'::uuid, 'farmer')
) as member(user_id, role);

insert into public.regions (id, tenant_id, name)
values ('f7100000-0000-4000-8000-000000000001', 'f7a00000-0000-4000-8000-00000000000a', 'PV Region');
insert into public.villages (id, tenant_id, region_id, name)
values ('f7200000-0000-4000-8000-000000000001', 'f7a00000-0000-4000-8000-00000000000a', 'f7100000-0000-4000-8000-000000000001', 'PV Village');

insert into public.pilot_profiles (tenant_id, user_id, home_region_id, is_active)
values ('f7a00000-0000-4000-8000-00000000000a', 'f7000000-0000-4000-8000-000000000003', 'f7100000-0000-4000-8000-000000000001', true);
insert into public.drones (id, tenant_id, uid, model, home_region_id, status)
values ('f7d00000-0000-4000-8000-000000000001', 'f7a00000-0000-4000-8000-00000000000a', 'PV-01', 'Demo', 'f7100000-0000-4000-8000-000000000001', 'active');

insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at, profile_id)
values
  ('f7f00000-0000-4000-8000-000000000001', 'f7a00000-0000-4000-8000-00000000000a', 'f7200000-0000-4000-8000-000000000001', 'PV Farmer 1', '9000000701', now(), 'f7000000-0000-4000-8000-000000000005'),
  ('f7f00000-0000-4000-8000-000000000002', 'f7a00000-0000-4000-8000-00000000000a', 'f7200000-0000-4000-8000-000000000001', 'PV Farmer 2', '9000000702', now(), 'f7000000-0000-4000-8000-000000000006');

insert into public.bookings (id, tenant_id, farmer_id, village_id, region_id, status, preferred_date, total_acres)
values ('f7b00000-0000-4000-8000-000000000001', 'f7a00000-0000-4000-8000-00000000000a', 'f7f00000-0000-4000-8000-000000000001',
  'f7200000-0000-4000-8000-000000000001', 'f7100000-0000-4000-8000-000000000001', 'confirmed', current_date + 3, 2);
insert into public.booking_status_history (tenant_id, booking_id, from_status, to_status, actor_id)
values ('f7a00000-0000-4000-8000-00000000000a', 'f7b00000-0000-4000-8000-000000000001', 'requested', 'confirmed', 'f7000000-0000-4000-8000-000000000002');
insert into public.booking_assignments (tenant_id, booking_id, pilot_user_id, drone_id, work_period)
values ('f7a00000-0000-4000-8000-00000000000a', 'f7b00000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000003',
  'f7d00000-0000-4000-8000-000000000001', tstzrange(now() + interval '3 days', now() + interval '3 days 2 hours'));

set local role authenticated;

-- ── A farmer sees only themselves and the staff on their own bookings ──────
set local "request.jwt.claim.sub" = 'f7000000-0000-4000-8000-000000000005';
select is((select count(*)::integer from public.profiles where id = 'f7000000-0000-4000-8000-000000000005'), 1, 'a farmer sees their own name');
select is((select count(*)::integer from public.profiles where id = 'f7000000-0000-4000-8000-000000000002'), 1, 'a farmer sees the mitra who acted on their booking');
select is((select count(*)::integer from public.profiles where id = 'f7000000-0000-4000-8000-000000000003'), 1, 'a farmer sees the pilot assigned to their booking');
select is((select count(*)::integer from public.profiles where id = 'f7000000-0000-4000-8000-000000000006'), 0, 'a farmer cannot see another farmer''s name');
select is(
  (select count(*)::integer from public.profiles where id in ('f7000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000004')),
  0, 'a farmer cannot list staff unrelated to their bookings'
);

-- The other farmer has no bookings: they see only themselves.
set local "request.jwt.claim.sub" = 'f7000000-0000-4000-8000-000000000006';
select is((select count(*)::integer from public.profiles where id::text like 'f7000000-%'), 1, 'a farmer without bookings sees only their own name');

-- ── Staff visibility is unchanged ──────────────────────────────────────────
set local "request.jwt.claim.sub" = 'f7000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.profiles where id::text like 'f7000000-%'), 6, 'a mitra still sees the names of members of their organization');
set local "request.jwt.claim.sub" = 'f7000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.profiles where id::text like 'f7000000-%'), 6, 'a regional admin still sees the names of members of their organization');

select * from finish();
rollback;
