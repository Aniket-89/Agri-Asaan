begin;

create extension if not exists pgtap;

select plan(10);

-- Fixtures (fake data only): one tenant, a mitra for the village, and two
-- farmers with logins.
insert into auth.users (id, aud, role, email, created_at)
values
  ('d4000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'of-mitra@example.test', now()),
  ('d4000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'of-farmer-1@example.test', now()),
  ('d4000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'of-farmer-2@example.test', now());

insert into public.organizations (id, name, slug)
values ('d4a00000-0000-4000-8000-00000000000a', 'OF Tenant', 'of-tenant');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('d4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-00000000000a', 'd4000000-0000-4000-8000-000000000001', 'mitra'),
  ('d4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-00000000000a', 'd4000000-0000-4000-8000-000000000002', 'farmer'),
  ('d4a00000-0000-4000-8000-00000000000a', 'd4a00000-0000-4000-8000-00000000000a', 'd4000000-0000-4000-8000-000000000003', 'farmer');

insert into public.regions (id, tenant_id, name)
values ('d4100000-0000-4000-8000-000000000001', 'd4a00000-0000-4000-8000-00000000000a', 'OF Region');
insert into public.villages (id, tenant_id, region_id, name)
values ('d4200000-0000-4000-8000-000000000001', 'd4a00000-0000-4000-8000-00000000000a', 'd4100000-0000-4000-8000-000000000001', 'OF Village');
insert into public.mitra_villages (tenant_id, village_id, user_id)
values ('d4a00000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001');
insert into public.tenant_crops (id, tenant_id, code, name_en, name_hi)
values ('d4c00000-0000-4000-8000-000000000001', 'd4a00000-0000-4000-8000-00000000000a', 'wheat', 'Wheat', 'गेहूँ');

insert into public.farmers (id, tenant_id, village_id, full_name, phone, consent_recorded_at, profile_id)
values
  ('d4f00000-0000-4000-8000-000000000001', 'd4a00000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-000000000001', 'OF Farmer 1', '9000000801', now(), 'd4000000-0000-4000-8000-000000000002'),
  ('d4f00000-0000-4000-8000-000000000002', 'd4a00000-0000-4000-8000-00000000000a', 'd4200000-0000-4000-8000-000000000001', 'OF Farmer 2', '9000000802', now(), 'd4000000-0000-4000-8000-000000000003');

insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
values ('d4e00000-0000-4000-8000-000000000002', 'd4a00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-000000000002', 'Other plot', 'd4c00000-0000-4000-8000-000000000001', 1, 27.5, 77.6);

set local role authenticated;
set local "request.jwt.claim.sub" = 'd4000000-0000-4000-8000-000000000002';

select lives_ok(
  $$insert into public.fields (id, tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('d4e00000-0000-4000-8000-000000000001', 'd4a00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-000000000001', 'My plot', 'd4c00000-0000-4000-8000-000000000001', 2, 27.5, 77.6)$$,
  'a farmer adds a field to their own record'
);
select throws_ok(
  $$insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('d4a00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-000000000002', 'Not mine', 'd4c00000-0000-4000-8000-000000000001', 2, 27.5, 77.6)$$,
  '42501', null, 'a farmer cannot add a field to another farmer'
);
select lives_ok(
  $$update public.fields set area_acres = 3 where id = 'd4e00000-0000-4000-8000-000000000001'$$,
  'a farmer edits their own field'
);
select is((select area_acres from public.fields where id = 'd4e00000-0000-4000-8000-000000000001'), 3.00::numeric, 'the edit is saved');
update public.fields set area_acres = 9 where id = 'd4e00000-0000-4000-8000-000000000002';
reset role;
select is((select area_acres from public.fields where id = 'd4e00000-0000-4000-8000-000000000002'), 1.00::numeric, 'a farmer cannot edit another farmer''s field');
set local role authenticated;
set local "request.jwt.claim.sub" = 'd4000000-0000-4000-8000-000000000002';
delete from public.fields where id = 'd4e00000-0000-4000-8000-000000000001';
reset role;
select is((select count(*)::integer from public.fields where id = 'd4e00000-0000-4000-8000-000000000001'), 1, 'a farmer cannot delete fields');
set local role authenticated;
set local "request.jwt.claim.sub" = 'd4000000-0000-4000-8000-000000000002';
select lives_ok(
  $$update public.fields set boundary = null where id = 'd4e00000-0000-4000-8000-000000000001'$$,
  'a farmer can write their own field boundary (ADR 0025)'
);

-- The 50-field cap applies to everyone.
reset role;
insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
select 'd4a00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-000000000001', 'Plot ' || n, 'd4c00000-0000-4000-8000-000000000001', 1, 27.5, 77.6
from generate_series(1, 49) as n;
set local role authenticated;
set local "request.jwt.claim.sub" = 'd4000000-0000-4000-8000-000000000002';
select throws_ok(
  $$insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('d4a00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-000000000001', 'One too many', 'd4c00000-0000-4000-8000-000000000001', 1, 27.5, 77.6)$$,
  '23514', 'a farmer can have at most 50 active fields', 'a farmer can have at most 50 active fields'
);

-- An inactive farmer record can no longer add fields itself.
reset role;
update public.farmers set is_active = false where id = 'd4f00000-0000-4000-8000-000000000002';
set local role authenticated;
set local "request.jwt.claim.sub" = 'd4000000-0000-4000-8000-000000000003';
select throws_ok(
  $$insert into public.fields (tenant_id, farmer_id, name, crop_id, area_acres, latitude, longitude)
    values ('d4a00000-0000-4000-8000-00000000000a', 'd4f00000-0000-4000-8000-000000000002', 'Late plot', 'd4c00000-0000-4000-8000-000000000001', 1, 27.5, 77.6)$$,
  '42501', null, 'an inactive farmer cannot add fields'
);

-- Staff access is unchanged.
set local "request.jwt.claim.sub" = 'd4000000-0000-4000-8000-000000000001';
select lives_ok(
  $$update public.fields set name = 'Renamed by mitra' where id = 'd4e00000-0000-4000-8000-000000000002'$$,
  'the village mitra still manages the farmer''s fields'
);

select * from finish();
rollback;
