begin;

create extension if not exists pgtap;

select plan(37);

-- Fixtures (fake data only). Tenant A has an organization admin, a regional
-- admin, a farmer, and a pilot. Tenant B has its own organization admin.
insert into auth.users (id, aud, role, email, phone)
values
  ('a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'org-admin-a@example.test', '910000000001'),
  ('a2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'regional-admin-a@example.test', '910000000002'),
  ('a3333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'farmer-a@example.test', '910000000003'),
  ('a4444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'pilot-a@example.test', '910000000004'),
  ('b1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'org-admin-b@example.test', '910000000005'),
  ('c1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'system-admin@example.test', null),
  ('c2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'new-user-1@example.test', null),
  ('c3333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'new-user-2@example.test', null);

insert into public.organizations (id, name, slug, is_active)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Tenant A', 'tenant-a', true),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Tenant B', 'tenant-b', true),
  ('cccccccc-0000-4000-8000-000000000003', 'Tenant Inactive', 'tenant-inactive', false);

insert into public.organization_settings (tenant_id, brand_name, brand_primary_color)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Brand A', '#112233'),
  ('bbbbbbbb-0000-4000-8000-000000000002', null, null),
  ('cccccccc-0000-4000-8000-000000000003', 'Brand Inactive', null);

insert into public.organization_domains (tenant_id, hostname, is_verified, is_primary)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'brand-a.example.test', true, true),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'pending-b.example.test', false, false),
  ('cccccccc-0000-4000-8000-000000000003', 'inactive.example.test', true, true);

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'organization_admin'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222', 'regional_admin'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'a3333333-3333-4333-8333-333333333333', 'farmer'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'a4444444-4444-4444-8444-444444444444', 'pilot'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'b1111111-1111-4111-8111-111111111111', 'organization_admin');

insert into public.platform_staff (user_id, role, status)
values ('c1111111-1111-4111-8111-111111111111', 'system_admin', 'active');

-- Legacy roles are blocked at the table level.
select throws_ok(
  $$insert into public.organization_members (tenant_id, organization_id, user_id, role)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'c2222222-2222-4222-8222-222222222222', 'super_admin')$$,
  '23514',
  null,
  'legacy super_admin role cannot be stored'
);

set local role authenticated;

-- ── Organization admin (tenant A) ──────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a1111111-1111-4111-8111-111111111111';

select is((select count(*)::integer from public.organization_members), 4, 'organization admin sees every member of their tenant');
select is(
  (select count(*)::integer from public.organization_members where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  0,
  'organization admin cannot see another tenant''s members'
);
select lives_ok(
  $$select public.add_organization_member('aaaaaaaa-0000-4000-8000-000000000001', 'c2222222-2222-4222-8222-222222222222', 'regional_admin')$$,
  'organization admin can add members'
);
select throws_ok(
  $$select public.add_organization_member('bbbbbbbb-0000-4000-8000-000000000002', 'c3333333-3333-4333-8333-333333333333', 'farmer')$$,
  'P0001',
  'only an organization or regional admin can add organization members',
  'organization admin cannot add members to another tenant'
);
select throws_ok(
  $$select public.add_organization_member('aaaaaaaa-0000-4000-8000-000000000001', 'c3333333-3333-4333-8333-333333333333', 'admin')$$,
  'P0001',
  'legacy organization role is not allowed',
  'add_organization_member rejects legacy roles'
);

update public.organizations set name = 'Tenant A Renamed' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select is(
  (select name from public.organizations where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Tenant A Renamed',
  'organization admin can rename their organization'
);
select throws_ok(
  $$update public.organizations set organization_type = 'agriasaan' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'organization admin cannot change organization type'
);
select throws_ok(
  $$update public.organizations set is_active = false where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'organization admin cannot change active status'
);
select throws_ok(
  $$update public.organizations set slug = 'hijacked' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'organization admin cannot change the slug'
);

select throws_ok(
  $$insert into public.organization_domains (tenant_id, hostname, is_verified)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'bank.example.test', true)$$,
  '42501',
  null,
  'organization admin cannot insert a verified domain'
);
select lives_ok(
  $$insert into public.organization_domains (tenant_id, hostname, is_verified)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'request-a.example.test', false)$$,
  'organization admin can request an unverified domain'
);
update public.organization_domains set is_verified = true where hostname = 'request-a.example.test';
select is(
  (select is_verified from public.organization_domains where hostname = 'request-a.example.test'),
  false,
  'organization admin cannot verify a domain'
);
select throws_ok(
  $$insert into public.organization_domains (tenant_id, hostname, is_verified)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'cross-tenant.example.test', false)$$,
  '42501',
  null,
  'organization admin cannot request a domain for another tenant'
);
select lives_ok(
  $$delete from public.organization_domains where hostname = 'request-a.example.test'$$,
  'organization admin can remove their own domain request'
);

select is(public.get_profile_phone('a3333333-3333-4333-8333-333333333333'), '910000000003', 'organization admin can read a farmer phone in their tenant');

-- ── Regional admin (tenant A) ──────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a2222222-2222-4222-8222-222222222222';

select is((select count(*)::integer from public.organization_members), 5, 'regional admin sees members of their tenant');
select lives_ok(
  $$select public.add_organization_member('aaaaaaaa-0000-4000-8000-000000000001', 'c3333333-3333-4333-8333-333333333333', 'farmer')$$,
  'regional admin can add a farmer'
);
select throws_ok(
  $$select public.add_organization_member('aaaaaaaa-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', 'organization_admin')$$,
  'P0001',
  'regional admins can only add mitra, farmer, or pilot members',
  'regional admin cannot add an organization admin'
);

update public.organization_members set role = 'farmer'
where user_id = 'a1111111-1111-4111-8111-111111111111';
select is(
  (select role::text from public.organization_members where user_id = 'a1111111-1111-4111-8111-111111111111'),
  'organization_admin',
  'regional admin cannot demote an organization admin'
);

update public.organization_members set role = 'mitra'
where user_id = 'a4444444-4444-4444-8444-444444444444';
select is(
  (select role::text from public.organization_members where user_id = 'a4444444-4444-4444-8444-444444444444'),
  'mitra',
  'regional admin can change an operational role'
);

select is(public.get_profile_phone('a3333333-3333-4333-8333-333333333333'), '910000000003', 'regional admin can read a farmer phone in their tenant');

-- ── Farmer (tenant A) ──────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'a3333333-3333-4333-8333-333333333333';

select is((select count(*)::integer from public.organization_members), 1, 'farmer sees only their own membership');
select throws_ok(
  $$select public.add_organization_member('aaaaaaaa-0000-4000-8000-000000000001', 'c3333333-3333-4333-8333-333333333333', 'farmer')$$,
  'P0001',
  'only an organization or regional admin can add organization members',
  'farmer cannot add members'
);
select throws_ok(
  $$select phone from public.profiles$$,
  '42501',
  null,
  'phone column cannot be selected directly'
);
select is(
  (select count(*)::integer from public.profiles where id = 'a1111111-1111-4111-8111-111111111111'),
  1,
  'farmer can still see names of members in their tenant'
);
select is(public.get_profile_phone('a1111111-1111-4111-8111-111111111111'), null, 'farmer cannot read another member''s phone');
select is(public.get_profile_phone(auth.uid()), '910000000003', 'farmer can read their own phone');
select throws_ok(
  $$update public.profiles set phone = '910000009999' where id = auth.uid()$$,
  '42501',
  null,
  'members cannot overwrite their phone directly'
);
select lives_ok(
  $$update public.profiles set full_name = 'Fake Farmer' where id = auth.uid()$$,
  'members can update their own name'
);

-- ── Organization admin (tenant B) ──────────────────────────────────────────
set local "request.jwt.claim.sub" = 'b1111111-1111-4111-8111-111111111111';

select is(public.get_profile_phone('a3333333-3333-4333-8333-333333333333'), null, 'admin of another tenant cannot read the phone');

-- ── System admin (platform staff) ──────────────────────────────────────────
set local "request.jwt.claim.sub" = 'c1111111-1111-4111-8111-111111111111';

select lives_ok(
  $$update public.organizations set organization_type = 'agriasaan' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'system admin can change organization type'
);
select lives_ok(
  $$update public.organization_domains set is_verified = true where hostname = 'pending-b.example.test'$$,
  'system admin can verify a domain'
);

-- ── Public branding (anonymous) ────────────────────────────────────────────
reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';

select is(
  (select brand_name from public.get_public_branding('Brand-A.example.test')),
  'Brand A',
  'public branding resolves a verified hostname case-insensitively'
);
select is(
  (select count(*)::integer from public.get_public_branding('inactive.example.test')),
  0,
  'public branding ignores inactive organizations'
);
select is(
  (select count(*)::integer from public.get_public_branding('unknown.example.test')),
  0,
  'public branding returns nothing for unknown hostnames'
);
select is(
  (select count(*)::integer from public.organization_settings),
  0,
  'anonymous users cannot read organization settings directly'
);

select * from finish();
rollback;
