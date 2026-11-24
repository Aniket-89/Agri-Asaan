begin;

create extension if not exists pgtap;

select plan(33);

-- Fixtures (fake data only).
-- Tenant A: org admin, two regional admins, mitra, farmer. Tenant B: org admin.
insert into auth.users (id, aud, role, email)
values
  ('71111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'territory-org-admin-a@example.test'),
  ('72222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'territory-regional-north@example.test'),
  ('73333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'territory-regional-south@example.test'),
  ('74444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'territory-mitra@example.test'),
  ('75555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'territory-farmer@example.test'),
  ('76666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'territory-org-admin-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('7a000000-0000-4000-8000-00000000000a', 'Territory Tenant A', 'territory-a'),
  ('7b000000-0000-4000-8000-00000000000b', 'Territory Tenant B', 'territory-b');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('7a000000-0000-4000-8000-00000000000a', '7a000000-0000-4000-8000-00000000000a', '71111111-1111-4111-8111-111111111111', 'organization_admin'),
  ('7a000000-0000-4000-8000-00000000000a', '7a000000-0000-4000-8000-00000000000a', '72222222-2222-4222-8222-222222222222', 'regional_admin'),
  ('7a000000-0000-4000-8000-00000000000a', '7a000000-0000-4000-8000-00000000000a', '73333333-3333-4333-8333-333333333333', 'regional_admin'),
  ('7a000000-0000-4000-8000-00000000000a', '7a000000-0000-4000-8000-00000000000a', '74444444-4444-4444-8444-444444444444', 'mitra'),
  ('7a000000-0000-4000-8000-00000000000a', '7a000000-0000-4000-8000-00000000000a', '75555555-5555-4555-8555-555555555555', 'farmer'),
  ('7b000000-0000-4000-8000-00000000000b', '7b000000-0000-4000-8000-00000000000b', '76666666-6666-4666-8666-666666666666', 'organization_admin');

insert into public.regions (id, tenant_id, name)
values
  ('7a100000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-00000000000a', 'North'),
  ('7a200000-0000-4000-8000-000000000002', '7a000000-0000-4000-8000-00000000000a', 'South'),
  ('7b100000-0000-4000-8000-000000000001', '7b000000-0000-4000-8000-00000000000b', 'B Region');

insert into public.villages (id, tenant_id, region_id, name, latitude, longitude)
values
  ('7a110000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-00000000000a', '7a100000-0000-4000-8000-000000000001', 'North Village 1', 28.613900, 77.209000),
  ('7a210000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-00000000000a', '7a200000-0000-4000-8000-000000000002', 'South Village 1', null, null),
  ('7b110000-0000-4000-8000-000000000001', '7b000000-0000-4000-8000-00000000000b', '7b100000-0000-4000-8000-000000000001', 'B Village 1', null, null);

insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values
  ('7a000000-0000-4000-8000-00000000000a', '7a100000-0000-4000-8000-000000000001', '72222222-2222-4222-8222-222222222222'),
  ('7a000000-0000-4000-8000-00000000000a', '7a200000-0000-4000-8000-000000000002', '73333333-3333-4333-8333-333333333333');

insert into public.mitra_villages (tenant_id, village_id, user_id)
values ('7a000000-0000-4000-8000-00000000000a', '7a110000-0000-4000-8000-000000000001', '74444444-4444-4444-8444-444444444444');

-- ── Database invariants ────────────────────────────────────────────────────
select ok(
  (select extensions.st_astext(location::extensions.geometry) from public.villages where id = '7a110000-0000-4000-8000-000000000001') = 'POINT(77.209 28.6139)',
  'village location is generated from latitude/longitude as SRID 4326'
);
select throws_ok(
  $$insert into public.villages (tenant_id, region_id, name)
    values ('7a000000-0000-4000-8000-00000000000a', '7b100000-0000-4000-8000-000000000001', 'Cross-tenant village')$$,
  '23503',
  null,
  'a village cannot reference another tenant''s region'
);
select throws_ok(
  $$insert into public.mitra_villages (tenant_id, village_id, user_id)
    values ('7a000000-0000-4000-8000-00000000000a', '7a110000-0000-4000-8000-000000000001', '75555555-5555-4555-8555-555555555555')$$,
  '23514',
  null,
  'only a mitra can be assigned to a village'
);
select throws_ok(
  $$insert into public.regional_admin_regions (tenant_id, region_id, user_id)
    values ('7a000000-0000-4000-8000-00000000000a', '7a100000-0000-4000-8000-000000000001', '74444444-4444-4444-8444-444444444444')$$,
  '23514',
  null,
  'only a regional admin can be assigned to a region'
);
select throws_ok(
  $$insert into public.mitra_villages (tenant_id, village_id, user_id)
    values ('7b000000-0000-4000-8000-00000000000b', '7b110000-0000-4000-8000-000000000001', '74444444-4444-4444-8444-444444444444')$$,
  '23514',
  null,
  'a member cannot be assigned to another tenant''s village'
);
select throws_ok(
  $$insert into public.villages (tenant_id, region_id, name, latitude)
    values ('7a000000-0000-4000-8000-00000000000a', '7a100000-0000-4000-8000-000000000001', 'Half pin', 28.5)$$,
  '23514',
  null,
  'latitude and longitude must be provided together'
);
select throws_ok(
  $$insert into public.villages (tenant_id, region_id, name)
    values ('7a000000-0000-4000-8000-00000000000a', '7a100000-0000-4000-8000-000000000001', '  north village 1 ')$$,
  '23505',
  null,
  'village names are unique within a region, ignoring case and spacing'
);

set local role authenticated;

-- ── Organization admin (tenant A) ──────────────────────────────────────────
set local "request.jwt.claim.sub" = '71111111-1111-4111-8111-111111111111';

select is((select count(*)::integer from public.regions), 2, 'organization admin sees only their tenant''s regions');
select lives_ok(
  $$insert into public.regions (tenant_id, name) values ('7a000000-0000-4000-8000-00000000000a', 'East')$$,
  'organization admin can create a region'
);
select throws_ok(
  $$insert into public.regions (tenant_id, name) values ('7b000000-0000-4000-8000-00000000000b', 'Injected')$$,
  '42501',
  null,
  'organization admin cannot create a region in another tenant'
);
select lives_ok(
  $$insert into public.villages (tenant_id, region_id, name)
    values ('7a000000-0000-4000-8000-00000000000a', '7a200000-0000-4000-8000-000000000002', 'South Village 2')$$,
  'organization admin can add a village to any region of their tenant'
);
select is((select count(*)::integer from public.mitra_villages), 1, 'organization admin sees mitra assignments');
select is((select count(*)::integer from public.regional_admin_regions), 2, 'organization admin sees regional admin assignments');

-- ── Regional admin (North only) ────────────────────────────────────────────
set local "request.jwt.claim.sub" = '72222222-2222-4222-8222-222222222222';

select is((select count(*)::integer from public.villages), 3, 'regional admin can read every village of their tenant');
select lives_ok(
  $$insert into public.villages (tenant_id, region_id, name)
    values ('7a000000-0000-4000-8000-00000000000a', '7a100000-0000-4000-8000-000000000001', 'North Village 2')$$,
  'regional admin can add a village to their region'
);
select throws_ok(
  $$insert into public.villages (tenant_id, region_id, name)
    values ('7a000000-0000-4000-8000-00000000000a', '7a200000-0000-4000-8000-000000000002', 'Not my region')$$,
  '42501',
  null,
  'regional admin cannot add a village to another region'
);
update public.villages set name = 'Renamed by North' where id = '7a210000-0000-4000-8000-000000000001';
select is(
  (select name from public.villages where id = '7a210000-0000-4000-8000-000000000001'),
  'South Village 1',
  'regional admin cannot edit villages outside their region'
);
select throws_ok(
  $$update public.villages set region_id = '7a200000-0000-4000-8000-000000000002'
    where id = '7a110000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'regional admin cannot move a village into a region they do not manage'
);
select throws_ok(
  $$insert into public.regions (tenant_id, name) values ('7a000000-0000-4000-8000-00000000000a', 'Self-made')$$,
  '42501',
  null,
  'regional admin cannot create regions'
);
select throws_ok(
  $$insert into public.regional_admin_regions (tenant_id, region_id, user_id)
    values ('7a000000-0000-4000-8000-00000000000a', '7a200000-0000-4000-8000-000000000002', '72222222-2222-4222-8222-222222222222')$$,
  '42501',
  null,
  'regional admin cannot assign themselves to another region'
);
select is((select count(*)::integer from public.mitra_villages), 1, 'regional admin sees mitra assignments in their region');
delete from public.mitra_villages where village_id = '7a110000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.mitra_villages), 0, 'regional admin can remove a mitra assignment in their region');
select lives_ok(
  $$insert into public.mitra_villages (tenant_id, village_id, user_id)
    values ('7a000000-0000-4000-8000-00000000000a', '7a110000-0000-4000-8000-000000000001', '74444444-4444-4444-8444-444444444444')$$,
  'regional admin can assign a mitra to a village in their region'
);
select throws_ok(
  $$insert into public.mitra_villages (tenant_id, village_id, user_id)
    values ('7a000000-0000-4000-8000-00000000000a', '7a210000-0000-4000-8000-000000000001', '74444444-4444-4444-8444-444444444444')$$,
  '42501',
  null,
  'regional admin cannot assign mitras outside their region'
);
select throws_ok(
  $$update public.villages set tenant_id = '7b000000-0000-4000-8000-00000000000b' where id = '7a110000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'villages cannot be moved to another tenant'
);

-- ── South regional admin sees nothing of North's assignments ──────────────
set local "request.jwt.claim.sub" = '73333333-3333-4333-8333-333333333333';
select is((select count(*)::integer from public.mitra_villages), 0, 'regional admin cannot see mitra assignments of other regions');

-- ── Mitra ──────────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '74444444-4444-4444-8444-444444444444';
select is((select count(*)::integer from public.mitra_villages), 1, 'mitra sees their own village assignments');
select is(public.is_mitra_for_village('7a110000-0000-4000-8000-000000000001'), true, 'mitra helper recognizes an assigned village');
select throws_ok(
  $$insert into public.villages (tenant_id, region_id, name)
    values ('7a000000-0000-4000-8000-00000000000a', '7a100000-0000-4000-8000-000000000001', 'Mitra village')$$,
  '42501',
  null,
  'mitra cannot create villages'
);

-- ── Farmer ─────────────────────────────────────────────────────────────────
set local "request.jwt.claim.sub" = '75555555-5555-4555-8555-555555555555';
select is((select count(*)::integer from public.villages), 4, 'farmer can read every village of their tenant to choose one');
select is((select count(*)::integer from public.mitra_villages), 0, 'farmer cannot see mitra assignments');

-- ── Organization admin of tenant B ─────────────────────────────────────────
set local "request.jwt.claim.sub" = '76666666-6666-4666-8666-666666666666';
select is((select count(*)::integer from public.villages), 1, 'another tenant sees none of tenant A''s villages');

-- ── Role change revokes territory rights ──────────────────────────────────
reset role;
update public.organization_members set role = 'mitra' where user_id = '72222222-2222-4222-8222-222222222222';
set local role authenticated;
set local "request.jwt.claim.sub" = '72222222-2222-4222-8222-222222222222';
select is(public.can_manage_region('7a100000-0000-4000-8000-000000000001'), false, 'a former regional admin loses region rights');

select * from finish();
rollback;
