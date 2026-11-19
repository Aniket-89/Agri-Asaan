begin;

create extension if not exists pgtap;

select plan(23);

insert into auth.users (id, aud, role, email)
values
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'owner@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'system@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'developer@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'organization@example.test'),
  ('77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'suspended@example.test'),
  ('88888888-8888-4888-8888-888888888888', 'authenticated', 'authenticated', 'ordinary@example.test');

insert into public.platform_staff (user_id, role, status)
values
  ('33333333-3333-4333-8333-333333333333', 'platform_owner', 'active'),
  ('44444444-4444-4444-8444-444444444444', 'system_admin', 'active'),
  ('55555555-5555-4555-8555-555555555555', 'developer', 'active'),
  ('77777777-7777-4777-8777-777777777777', 'developer', 'suspended');

reset role;
set local role anon;
select is((select count(*)::integer from public.platform_staff), 0, 'unauthenticated users cannot access platform_staff');
select is((select count(*)::integer from public.organizations), 0, 'unauthenticated users cannot access organizations');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '55555555-5555-4555-8555-555555555555';
select throws_ok(
  $$select public.provision_customer_organization(
    'Developer Org', 'developer-org', 'customer',
    'organization@example.test', null, null, '{}'::text[])$$,
  'P0001',
  null,
  'developers cannot provision organizations'
);
select is(public.is_platform_staff(), true, 'developer is active platform staff');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '77777777-7777-4777-8777-777777777777';
select is(public.is_platform_staff(), false, 'suspended staff lose platform access');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-8444-444444444444';
select ok(
  public.provision_customer_organization(
    'System Org', 'system-org', 'customer',
    'ORGANIZATION@example.test', 'System Org Brand', '#2563EB', array['crop_monitoring']
  ) is not null,
  'system administrators can provision organizations'
);
select is(
  (select count(*)::integer from public.organizations where slug = 'system-org'),
  1,
  'authorized provisioning creates the organization'
);
select is(
  (select count(*)::integer from public.organization_members
   where organization_id = (select id from public.organizations where slug = 'system-org')
     and user_id = '66666666-6666-4666-8666-666666666666'
     and role = 'organization_admin'),
  1,
  'authorized provisioning establishes the initial organization admin membership'
);
select throws_ok(
  $$select public.provision_customer_organization(
    'Missing Admin Org', 'missing-admin-org', 'customer',
    'missing@example.test', null, null, '{}'::text[])$$,
  'P0001',
  null,
  'provisioning rejects an email without an existing profile'
);
select is(
  (select count(*)::integer from public.organizations where slug = 'missing-admin-org'),
  0,
  'failed email lookup does not create an organization'
);

select throws_ok(
  $$select public.manage_platform_staff(
    '33333333-3333-4333-8333-333333333333',
    'platform_owner', 'active')$$,
  'P0001',
  null,
  'system administrators cannot assign platform owner'
);

select throws_ok(
  $$select public.manage_platform_staff(
    '33333333-3333-4333-8333-333333333333',
    'developer', 'active')$$,
  'P0001',
  null,
  'system administrators cannot demote an existing platform owner'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '66666666-6666-4666-8666-666666666666';
select throws_ok(
  $$insert into public.organizations (name, slug)
    values ('Direct Org', 'direct-org')$$,
  '42501',
  null,
  'organization administrator cannot create a direct organization record'
);
select is((select count(*)::integer from public.platform_staff), 0, 'organization administrator cannot access platform staff');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-4333-8333-333333333333';
select is(public.is_platform_owner(), true, 'platform owner helper recognizes platform owner');
select is(public.is_system_admin(), false, 'platform owner is not automatically system admin');
select is((select count(*)::integer from public.platform_staff where user_id = auth.uid()), 1, 'platform owner can access platform staff without organization membership');
select is((select count(*)::integer from public.organization_members where user_id = auth.uid()), 0, 'platform owner bootstrap does not create organization membership');
select ok(
  public.provision_customer_organization(
    'Owner Org', 'owner-org', 'customer',
    'organization@example.test', null, null, '{}'::text[]) is not null,
  'platform owners can provision organizations'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '88888888-8888-4888-8888-888888888888';
select is(public.is_platform_staff(), false, 'ordinary user without organization membership is not platform staff');
select is((select count(*)::integer from public.platform_staff), 0, 'ordinary user cannot access platform staff records');
select is((select count(*)::integer from public.organization_members), 0, 'ordinary user has no organization membership');

reset role;
set local role anon;
select throws_ok(
  $$select public.bootstrap_platform_owner('33333333-3333-4333-8333-333333333333')$$,
  '42501',
  null,
  'bootstrap RPC is not executable by anonymous users'
);

select * from finish();
rollback;
