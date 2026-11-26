begin;

create extension if not exists pgtap;

select plan(22);

-- Fixtures (fake data only).
-- Tenant A accepts farmer sign-ups on sr-a.example.test. Tenant B has a
-- domain but the feature is off. An unverified domain of tenant A must not
-- work either. Region A2 is inactive.
insert into auth.users (id, aud, role, email)
values
  ('91111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'sr-new@example.test'),
  ('92222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'sr-staff@example.test'),
  ('93333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'sr-other@example.test');

insert into public.organizations (id, name, slug)
values
  ('9a000000-0000-4000-8000-00000000000a', 'SR Tenant A', 'sr-tenant-a'),
  ('9b000000-0000-4000-8000-00000000000b', 'SR Tenant B', 'sr-tenant-b');

insert into public.organization_domains (tenant_id, hostname, is_primary, is_verified)
values
  ('9a000000-0000-4000-8000-00000000000a', 'sr-a.example.test', true, true),
  ('9a000000-0000-4000-8000-00000000000a', 'sr-a-unverified.example.test', false, false),
  ('9b000000-0000-4000-8000-00000000000b', 'sr-b.example.test', true, true);

insert into public.organization_features (tenant_id, feature_key, enabled)
values
  ('9a000000-0000-4000-8000-00000000000a', 'farmer_self_registration', true),
  ('9b000000-0000-4000-8000-00000000000b', 'farmer_self_registration', false);

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('9a000000-0000-4000-8000-00000000000a', '9a000000-0000-4000-8000-00000000000a', '92222222-2222-4222-8222-222222222222', 'mitra');

insert into public.regions (id, tenant_id, name, is_active)
values
  ('9a100000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-00000000000a', 'SR Region A1', true),
  ('9a100000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-00000000000a', 'SR Region A2', false),
  ('9b100000-0000-4000-8000-000000000001', '9b000000-0000-4000-8000-00000000000b', 'SR Region B1', true);

insert into public.villages (id, tenant_id, region_id, name, is_active)
values
  ('9a200000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-00000000000a', '9a100000-0000-4000-8000-000000000001', 'SR Village A1', true),
  ('9a200000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-00000000000a', '9a100000-0000-4000-8000-000000000001', 'SR Village A1 closed', false),
  ('9a200000-0000-4000-8000-000000000003', '9a000000-0000-4000-8000-00000000000a', '9a100000-0000-4000-8000-000000000002', 'SR Village in closed region', true),
  ('9b200000-0000-4000-8000-000000000001', '9b000000-0000-4000-8000-00000000000b', '9b100000-0000-4000-8000-000000000001', 'SR Village B1', true);

-- ── Village list (public) ───────────────────────────────────────────────────
set local role anon;

select is(
  (select array_agg(village_name order by village_name) from public.get_farmer_registration_villages('SR-A.example.test ')),
  array['SR Village A1'],
  'anon sees only active villages in active regions of a tenant accepting sign-ups (hostname normalised)'
);
select is(
  (select count(*)::integer from public.get_farmer_registration_villages('sr-b.example.test')),
  0,
  'no villages when the tenant has farmer sign-up switched off'
);
select is(
  (select count(*)::integer from public.get_farmer_registration_villages('sr-a-unverified.example.test')),
  0,
  'no villages through an unverified domain'
);
select is(
  (select count(*)::integer from public.get_farmer_registration_villages('unknown.example.test')),
  0,
  'no villages for an unknown hostname'
);

select throws_ok(
  $$select public.register_self_as_farmer('sr-a.example.test', 'Anon', '9876500001', '281001', 'Fake Town', 'Fake address 1', '9a200000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'anon cannot call register_self_as_farmer'
);

select throws_ok(
  $$select public.farmer_registration_tenant('sr-a.example.test')$$,
  '42501',
  null,
  'the internal tenant lookup is not callable by anon'
);

-- ── Registration as a new account ───────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claim.sub" = '91111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.register_self_as_farmer('sr-b.example.test', 'Fake Farmer', '9876500001', '281001', 'Fake Town', 'Fake address 1', '9b200000-0000-4000-8000-000000000001')$$,
  '42501',
  'this site does not accept farmer registrations',
  'cannot join a tenant with farmer sign-up switched off'
);
select throws_ok(
  $$select public.register_self_as_farmer('sr-a-unverified.example.test', 'Fake Farmer', '9876500001', '281001', 'Fake Town', 'Fake address 1', '9a200000-0000-4000-8000-000000000001')$$,
  '42501',
  'this site does not accept farmer registrations',
  'cannot join through an unverified domain'
);
select throws_ok(
  $$select public.register_self_as_farmer('sr-a.example.test', 'Fake Farmer', '9876500001', '281001', 'Fake Town', 'Fake address 1', '9b200000-0000-4000-8000-000000000001')$$,
  '22023',
  'village not available for registration',
  'cannot pick a village of another tenant'
);
select throws_ok(
  $$select public.register_self_as_farmer('sr-a.example.test', 'Fake Farmer', '9876500001', '281001', 'Fake Town', 'Fake address 1', '9a200000-0000-4000-8000-000000000002')$$,
  '22023',
  'village not available for registration',
  'cannot pick an inactive village'
);
select throws_ok(
  $$select public.register_self_as_farmer('sr-a.example.test', 'Fake Farmer', '9876500001', '281001', 'Fake Town', 'Fake address 1', '9a200000-0000-4000-8000-000000000003')$$,
  '22023',
  'village not available for registration',
  'cannot pick a village in an inactive region'
);
select throws_ok(
  $$select public.register_self_as_farmer('sr-a.example.test', 'Fake Farmer', '12345', '281001', 'Fake Town', 'Fake address 1', '9a200000-0000-4000-8000-000000000001')$$,
  '23514',
  null,
  'an invalid phone is rejected and nothing is created'
);
select is(
  (select count(*)::integer from public.organization_members where user_id = '91111111-1111-4111-8111-111111111111'),
  0,
  'a failed registration leaves no membership behind'
);

select lives_ok(
  $$select public.register_self_as_farmer('sr-a.example.test', '  Fake Farmer  ', '9876500001', '281001', 'Fake Town', 'Fake address 1', '9a200000-0000-4000-8000-000000000001')$$,
  'a signed-in account can register as a farmer'
);

reset role;

select is(
  (select role::text from public.organization_members
   where organization_id = '9a000000-0000-4000-8000-00000000000a' and user_id = '91111111-1111-4111-8111-111111111111'),
  'farmer',
  'the new membership role is farmer'
);
select is(
  (select row(full_name, phone, village_id, profile_id, registered_by)::text from public.farmers
   where profile_id = '91111111-1111-4111-8111-111111111111'),
  row('Fake Farmer', '9876500001', '9a200000-0000-4000-8000-000000000001'::uuid,
      '91111111-1111-4111-8111-111111111111'::uuid, '91111111-1111-4111-8111-111111111111'::uuid)::text,
  'the farmer record is linked to the login, trimmed, and registered by the farmer'
);
select isnt(
  (select consent_recorded_at from public.farmers where profile_id = '91111111-1111-4111-8111-111111111111'),
  null,
  'consent time is recorded'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '91111111-1111-4111-8111-111111111111';

select is(
  (select count(*)::integer from public.farmers),
  1,
  'the new farmer sees their own farmer record through RLS'
);
select throws_ok(
  $$select public.register_self_as_farmer('sr-a.example.test', 'Fake Farmer', '9876500001', '281001', 'Fake Town', 'Fake address 1', '9a200000-0000-4000-8000-000000000001')$$,
  '23505',
  'already a member of this organization',
  'registering twice is rejected'
);

-- ── Existing staff cannot change role by self-registering ───────────────────
set local "request.jwt.claim.sub" = '92222222-2222-4222-8222-222222222222';

select throws_ok(
  $$select public.register_self_as_farmer('sr-a.example.test', 'Fake Staff', '9876500002', '281001', 'Fake Town', 'Fake address 1', '9a200000-0000-4000-8000-000000000001')$$,
  '23505',
  'already a member of this organization',
  'an existing member (mitra) cannot self-register'
);

reset role;

select is(
  (select role::text from public.organization_members where user_id = '92222222-2222-4222-8222-222222222222'),
  'mitra',
  'the existing member keeps their role'
);

-- ── The other account has not been touched ──────────────────────────────────
select is(
  (select count(*)::integer from public.organization_members where user_id = '93333333-3333-4333-8333-333333333333'),
  0,
  'registration affects only the caller'
);

select * from finish();
rollback;
