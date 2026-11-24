begin;

create extension if not exists pgtap;

select plan(19);

insert into auth.users (id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'member-a@example.test', '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'member-b@example.test', '{}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'no-membership@example.test', '{"full_name":"Uninvited User"}'::jsonb);

insert into public.organizations (id, name, slug)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Organization A', 'organization-a'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Organization B', 'organization-b');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'regional_admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'organization_admin');

insert into public.organization_settings (tenant_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

select is((select count(*)::integer from public.organizations), 1, 'member can access their own organization');
select is((select count(*)::integer from public.organizations where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'member cannot access another organization');
select is((select count(*)::integer from public.organization_settings where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'member can access own organization settings');
select is((select count(*)::integer from public.organization_settings where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'member cannot access another organization settings');

select throws_ok(
  $$insert into public.organization_features (tenant_id, feature_key, enabled)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cross_tenant_feature', true)$$,
  '42501',
  null,
  'member cannot create records for another tenant'
);

update public.organization_members
set role = 'organization_admin'
where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = '11111111-1111-4111-8111-111111111111';

select is(
  (select role::text from public.organization_members
   where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and user_id = '11111111-1111-4111-8111-111111111111'),
  'regional_admin',
  'user cannot elevate their own membership role to organization_admin'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-4333-8333-333333333333';
select is((select count(*)::integer from public.profiles where id = auth.uid()), 1, 'auth user creation initializes exactly one profile');
select is((select full_name from public.profiles where id = auth.uid()), 'Uninvited User', 'profile trigger copies the submitted full name');
select is((select count(*)::integer from public.organization_members), 0, 'authenticated user without membership sees no memberships');
select is((select count(*)::integer from public.organizations), 0, 'newly registered user has no organization');
select is(public.is_platform_staff(), false, 'newly registered user has no platform privileges');
select throws_ok(
  $$select public.create_organization_for_current_user('Public Org', 'public-org')$$,
  '42883',
  null,
  'self-service organization creation RPC is unavailable'
);
select throws_ok(
  $$insert into public.organizations (name, slug) values ('Public Org', 'public-org')$$,
  '42501',
  null,
  'newly registered user cannot create an organization directly'
);
select throws_ok(
  $$insert into public.organization_members (tenant_id, organization_id, user_id, role)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '33333333-3333-4333-8333-333333333333', 'farmer')$$,
  '42501',
  null,
  'newly registered user cannot create a membership directly'
);
select throws_ok(
  $$select public.add_organization_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333333',
    'farmer')$$,
  'P0001',
  null,
  'newly registered user cannot add an organization member through the RPC'
);
select throws_ok(
  $$insert into public.platform_staff (user_id, role)
    values ('33333333-3333-4333-8333-333333333333', 'platform_owner')$$,
  '42501',
  null,
  'newly registered user cannot grant themselves platform privileges'
);

reset role;
set local role anon;

select is((select count(*)::integer from public.organizations), 0, 'unauthenticated users cannot access organizations');
select is((select count(*)::integer from public.organization_members), 0, 'unauthenticated users cannot access memberships');
select is((select count(*)::integer from public.organization_settings), 0, 'unauthenticated users cannot access organization settings');

select * from finish();
rollback;
