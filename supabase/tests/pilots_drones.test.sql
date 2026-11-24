begin;

create extension if not exists pgtap;

select plan(32);

-- Fixtures (fake data only).
-- Tenant A: org admin, regional admin (North), two pilots, a mitra.
-- Tenant B: org admin.
insert into auth.users (id, aud, role, email)
values
  ('91111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'pd-org-admin-a@example.test'),
  ('92222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'pd-regional-north@example.test'),
  ('93333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'pd-pilot-north@example.test'),
  ('94444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'pd-pilot-south@example.test'),
  ('95555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'pd-mitra@example.test'),
  ('96666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'pd-org-admin-b@example.test'),
  ('97777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'pd-pilot-noprofile-1@example.test'),
  ('98888888-8888-4888-8888-888888888888', 'authenticated', 'authenticated', 'pd-pilot-noprofile-2@example.test');

insert into public.organizations (id, name, slug)
values
  ('9a000000-0000-4000-8000-00000000000a', 'PD Tenant A', 'pd-tenant-a'),
  ('9b000000-0000-4000-8000-00000000000b', 'PD Tenant B', 'pd-tenant-b');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('9a000000-0000-4000-8000-00000000000a', '9a000000-0000-4000-8000-00000000000a', '91111111-1111-4111-8111-111111111111', 'organization_admin'),
  ('9a000000-0000-4000-8000-00000000000a', '9a000000-0000-4000-8000-00000000000a', '92222222-2222-4222-8222-222222222222', 'regional_admin'),
  ('9a000000-0000-4000-8000-00000000000a', '9a000000-0000-4000-8000-00000000000a', '93333333-3333-4333-8333-333333333333', 'pilot'),
  ('9a000000-0000-4000-8000-00000000000a', '9a000000-0000-4000-8000-00000000000a', '94444444-4444-4444-8444-444444444444', 'pilot'),
  ('9a000000-0000-4000-8000-00000000000a', '9a000000-0000-4000-8000-00000000000a', '95555555-5555-4555-8555-555555555555', 'mitra'),
  ('9b000000-0000-4000-8000-00000000000b', '9b000000-0000-4000-8000-00000000000b', '96666666-6666-4666-8666-666666666666', 'organization_admin'),
  ('9a000000-0000-4000-8000-00000000000a', '9a000000-0000-4000-8000-00000000000a', '97777777-7777-4777-8777-777777777777', 'pilot'),
  ('9a000000-0000-4000-8000-00000000000a', '9a000000-0000-4000-8000-00000000000a', '98888888-8888-4888-8888-888888888888', 'pilot');

insert into public.regions (id, tenant_id, name)
values
  ('9a100000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-00000000000a', 'North'),
  ('9a200000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-00000000000a', 'South'),
  ('9b100000-0000-4000-8000-000000000001', '9b000000-0000-4000-8000-00000000000b', 'B Region');

insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values ('9a000000-0000-4000-8000-00000000000a', '9a100000-0000-4000-8000-000000000001', '92222222-2222-4222-8222-222222222222');

insert into public.drones (id, tenant_id, uid, model, home_region_id)
values
  ('9ad10000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-00000000000a', 'UA-NORTH-01', 'Demo Sprayer 10L', '9a100000-0000-4000-8000-000000000001'),
  ('9ad20000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-00000000000a', 'UA-SOUTH-01', 'Demo Sprayer 10L', '9a200000-0000-4000-8000-000000000002'),
  ('9bd10000-0000-4000-8000-000000000001', '9b000000-0000-4000-8000-00000000000b', 'UB-01', 'Demo Sprayer 16L', null);

insert into public.pilot_profiles (tenant_id, user_id, home_region_id, license_number)
values
  ('9a000000-0000-4000-8000-00000000000a', '93333333-3333-4333-8333-333333333333', '9a100000-0000-4000-8000-000000000001', 'RPC-DEMO-0001'),
  ('9a000000-0000-4000-8000-00000000000a', '94444444-4444-4444-8444-444444444444', '9a200000-0000-4000-8000-000000000002', null);

-- ── Database invariants ────────────────────────────────────────────────────
select throws_ok(
  $$insert into public.drones (tenant_id, uid, model) values ('9a000000-0000-4000-8000-00000000000a', 'ua-north-01', 'Dup')$$,
  '23505', null, 'drone UIDs are unique per tenant, ignoring case'
);
select lives_ok(
  $$insert into public.drones (tenant_id, uid, model) values ('9b000000-0000-4000-8000-00000000000b', 'UA-NORTH-01', 'Same UID other tenant')$$,
  'another tenant may use the same UID (uniqueness is per tenant)'
);
select throws_ok(
  $$insert into public.drones (tenant_id, uid, model, home_region_id) values ('9a000000-0000-4000-8000-00000000000a', 'UA-X', 'X', '9b100000-0000-4000-8000-000000000001')$$,
  '23503', null, 'a drone cannot be homed in another tenant''s region'
);
select throws_ok(
  $$insert into public.drones (tenant_id, uid, model) values ('9a000000-0000-4000-8000-00000000000a', 'bad uid!', 'X')$$,
  '23514', null, 'drone UIDs use letters, digits, and hyphens only'
);
select throws_ok(
  $$insert into public.pilot_profiles (tenant_id, user_id) values ('9a000000-0000-4000-8000-00000000000a', '95555555-5555-4555-8555-555555555555')$$,
  '23514', null, 'only a pilot member can have a pilot profile'
);
select throws_ok(
  $$insert into public.pilot_profiles (tenant_id, user_id) values ('9b000000-0000-4000-8000-00000000000b', '93333333-3333-4333-8333-333333333333')$$,
  '23514', null, 'a pilot profile cannot be created in a tenant the pilot is not a member of'
);

set local role authenticated;

-- ── Organization admin ─────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '91111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.drones), 2, 'organization admin sees their tenant''s drones only');
select lives_ok(
  $$insert into public.drones (tenant_id, uid, model) values ('9a000000-0000-4000-8000-00000000000a', 'UA-SPARE-01', 'Spare, no home region')$$,
  'organization admin can add a drone without a home region'
);
select throws_ok(
  $$insert into public.pilot_profiles (tenant_id, user_id, home_region_id) values ('9a000000-0000-4000-8000-00000000000a', '97777777-7777-4777-8777-777777777777', '9a100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'organization admins cannot create pilot profiles directly (invite flow only, ADR 0012)'
);
select throws_ok(
  $$insert into public.drones (tenant_id, uid, model) values ('9b000000-0000-4000-8000-00000000000b', 'UB-INJECT', 'X')$$,
  '42501', null, 'organization admin cannot add drones to another tenant'
);

-- ── Regional admin (North) ─────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '92222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.drones), 3, 'regional admin sees the whole tenant fleet');
select is((select count(*)::integer from public.pilot_profiles), 2, 'regional admin sees every pilot profile in the tenant');
select throws_ok(
  $$insert into public.pilot_profiles (tenant_id, user_id, home_region_id) values ('9a000000-0000-4000-8000-00000000000a', '97777777-7777-4777-8777-777777777777', '9a100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'regional admins cannot create pilot profiles directly either (invite flow only)'
);
select throws_ok(
  $$insert into public.pilot_profiles (tenant_id, user_id, home_region_id) values ('9a000000-0000-4000-8000-00000000000a', '98888888-8888-4888-8888-888888888888', '9a200000-0000-4000-8000-000000000002')$$,
  '42501', null, 'regional admin cannot create a pilot profile in another region'
);
select lives_ok(
  $$insert into public.drones (tenant_id, uid, model, home_region_id) values ('9a000000-0000-4000-8000-00000000000a', 'UA-NORTH-02', 'Demo Sprayer 10L', '9a100000-0000-4000-8000-000000000001')$$,
  'regional admin can add a drone to their region'
);
select throws_ok(
  $$insert into public.drones (tenant_id, uid, model, home_region_id) values ('9a000000-0000-4000-8000-00000000000a', 'UA-SOUTH-02', 'X', '9a200000-0000-4000-8000-000000000002')$$,
  '42501', null, 'regional admin cannot add drones to another region'
);
select throws_ok(
  $$insert into public.drones (tenant_id, uid, model) values ('9a000000-0000-4000-8000-00000000000a', 'UA-NOHOME', 'X')$$,
  '42501', null, 'regional admin cannot add drones without a home region'
);
update public.drones set status = 'maintenance' where id = '9ad10000-0000-4000-8000-000000000001';
select is(
  (select status::text from public.drones where id = '9ad10000-0000-4000-8000-000000000001'),
  'maintenance', 'regional admin can change the status of a drone in their region'
);
update public.drones set status = 'retired' where id = '9ad20000-0000-4000-8000-000000000002';
select is(
  (select status::text from public.drones where id = '9ad20000-0000-4000-8000-000000000002'),
  'active', 'regional admin cannot change drones homed in other regions'
);
select throws_ok(
  $$update public.drones set home_region_id = '9a200000-0000-4000-8000-000000000002' where id = '9ad10000-0000-4000-8000-000000000001'$$,
  '42501', null, 'regional admin cannot move a drone into a region they do not manage'
);
update public.pilot_profiles set is_active = false where user_id = '94444444-4444-4444-8444-444444444444';
select is(
  (select is_active from public.pilot_profiles where user_id = '94444444-4444-4444-8444-444444444444'),
  true, 'regional admin cannot change pilots homed in other regions'
);
update public.pilot_profiles set is_active = false where user_id = '93333333-3333-4333-8333-333333333333';
select is(
  (select is_active from public.pilot_profiles where user_id = '93333333-3333-4333-8333-333333333333'),
  false, 'regional admin can mark a pilot in their region unavailable'
);
select throws_ok(
  $$update public.drones set tenant_id = '9b000000-0000-4000-8000-00000000000b' where id = '9ad10000-0000-4000-8000-000000000001'$$,
  '42501', null, 'drones cannot be moved to another tenant'
);
delete from public.drones where id = '9ad10000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.drones where id = '9ad10000-0000-4000-8000-000000000001'),
  1, 'regional admins cannot delete drones'
);

-- ── Pilot ──────────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '93333333-3333-4333-8333-333333333333';
select is((select count(*)::integer from public.pilot_profiles), 1, 'a pilot sees only their own profile');
select is((select count(*)::integer from public.drones), 0, 'pilots do not see the fleet until jobs are assigned');
update public.pilot_profiles set is_active = true where user_id = '93333333-3333-4333-8333-333333333333';
select is(
  (select is_active from public.pilot_profiles where user_id = '93333333-3333-4333-8333-333333333333'),
  false, 'a pilot cannot change their own availability'
);

-- ── Mitra ──────────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '95555555-5555-4555-8555-555555555555';
select is((select count(*)::integer from public.drones), 0, 'mitras do not see the fleet');
select is((select count(*)::integer from public.pilot_profiles), 0, 'mitras do not see pilot profiles');

-- ── Organization admin of tenant B ─────────────────────────────────────────
set local "request.jwt.claim.sub" = '96666666-6666-4666-8666-666666666666';
select is(
  (select count(*)::integer from public.drones where tenant_id = '9a000000-0000-4000-8000-00000000000a'),
  0, 'another tenant sees none of tenant A''s drones'
);
select is((select count(*)::integer from public.pilot_profiles), 0, 'another tenant sees none of tenant A''s pilots');

-- ── Organization admin deletes ─────────────────────────────────────────────
set local "request.jwt.claim.sub" = '91111111-1111-4111-8111-111111111111';
select lives_ok(
  $$delete from public.drones where uid = 'UA-SPARE-01'$$,
  'organization admin can delete a drone'
);

select * from finish();
rollback;
