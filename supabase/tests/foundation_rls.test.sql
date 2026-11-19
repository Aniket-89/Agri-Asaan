begin;

create extension if not exists pgtap;

select plan(9);

insert into auth.users (id, aud, role, email)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'member-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'member-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Organization A', 'organization-a'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Organization B', 'organization-b');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'super_admin');

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
set role = 'super_admin'
where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = '11111111-1111-4111-8111-111111111111';

select is(
  (select role::text from public.organization_members
   where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and user_id = '11111111-1111-4111-8111-111111111111'),
  'admin',
  'user cannot elevate their own membership role to super_admin'
);

reset role;
set local role anon;

select is((select count(*)::integer from public.organizations), 0, 'unauthenticated users cannot access organizations');
select is((select count(*)::integer from public.organization_members), 0, 'unauthenticated users cannot access memberships');
select is((select count(*)::integer from public.organization_settings), 0, 'unauthenticated users cannot access organization settings');

select * from finish();
rollback;
