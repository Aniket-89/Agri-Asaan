begin;

create extension if not exists pgtap;

select plan(24);

-- Fixtures (fake data only). Tenant A: org admin, North and South regional
-- admins, an existing mitra. Tenant B: its own regional admin and village.
insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, last_sign_in_at, created_at)
values
  ('c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'mi-org-admin@example.test', null, now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'mi-regional-north@example.test', null, now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'mi-regional-south@example.test', null, now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'mi-mitra@example.test', null, now(), now(), now()),
  ('c1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'mi-other-regional@example.test', null, now(), now(), now());

insert into public.organizations (id, name, slug)
values
  ('cc000000-0000-4000-8000-00000000000a', 'MI Tenant A', 'mi-tenant-a'),
  ('cc000000-0000-4000-8000-00000000000b', 'MI Tenant B', 'mi-tenant-b');

insert into public.organization_members (tenant_id, organization_id, user_id, role)
values
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000001', 'organization_admin'),
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000002', 'regional_admin'),
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000003', 'regional_admin'),
  ('cc000000-0000-4000-8000-00000000000a', 'cc000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-000000000004', 'mitra'),
  ('cc000000-0000-4000-8000-00000000000b', 'cc000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-000000000005', 'regional_admin');

insert into public.regions (id, tenant_id, name)
values
  ('cc100000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-00000000000a', 'North'),
  ('cc100000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-00000000000a', 'South'),
  ('cc100000-0000-4000-8000-000000000003', 'cc000000-0000-4000-8000-00000000000b', 'B Region');

insert into public.villages (id, tenant_id, region_id, name, is_active)
values
  ('cc200000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-00000000000a', 'cc100000-0000-4000-8000-000000000001', 'North Village', true),
  ('cc200000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-00000000000a', 'cc100000-0000-4000-8000-000000000001', 'Closed Village', false),
  ('cc200000-0000-4000-8000-000000000003', 'cc000000-0000-4000-8000-00000000000a', 'cc100000-0000-4000-8000-000000000002', 'South Village', true),
  ('cc200000-0000-4000-8000-000000000004', 'cc000000-0000-4000-8000-00000000000b', 'cc100000-0000-4000-8000-000000000003', 'B Village', true);

insert into public.regional_admin_regions (tenant_id, region_id, user_id)
values
  ('cc000000-0000-4000-8000-00000000000a', 'cc100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002'),
  ('cc000000-0000-4000-8000-00000000000a', 'cc100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003'),
  ('cc000000-0000-4000-8000-00000000000b', 'cc100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000005');

create temporary table mi_ids (label text primary key, id uuid);
grant select, insert on mi_ids to service_role, authenticated;

set local role authenticated;

-- ── Session-level checks ───────────────────────────────────────────────────
set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000002';
select is(public.can_invite_mitra('cc200000-0000-4000-8000-000000000001'), true, 'a regional admin can invite a mitra into a village of their region');
select is(public.can_invite_mitra('cc200000-0000-4000-8000-000000000003'), false, 'a regional admin cannot invite into another region''s village');
select is(public.can_invite_mitra('cc200000-0000-4000-8000-000000000002'), false, 'a regional admin cannot invite into an inactive village');
select is(public.can_invite_mitra('cc200000-0000-4000-8000-000000000004'), false, 'a regional admin cannot invite into another tenant''s village');
select throws_ok(
  $$select * from public.claim_mitra_invite('c1000000-0000-4000-8000-000000000002', 'x@example.test', 'cc200000-0000-4000-8000-000000000001')$$,
  '42501', null, 'claim_mitra_invite is not executable from a browser session'
);
select throws_ok(
  $$select public.provision_invited_mitra(gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, 'provision_invited_mitra is not executable from a browser session'
);

set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000001';
select is(public.can_invite_mitra('cc200000-0000-4000-8000-000000000001'), false, 'organization admins cannot invite mitras (regional admins only)');
set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000004';
select is(public.can_invite_mitra('cc200000-0000-4000-8000-000000000001'), false, 'mitras cannot invite mitras');

reset role;
set local role anon;
select throws_ok(
  $$select public.can_invite_mitra('cc200000-0000-4000-8000-000000000001')$$,
  '42501', null, 'anonymous visitors cannot call can_invite_mitra'
);

-- ── Claim -> invite -> provision (service key) ─────────────────────────────
reset role;
set local role service_role;

insert into mi_ids
select 'claim1', invite_id from public.claim_mitra_invite('c1000000-0000-4000-8000-000000000002', ' MI-New-1@Example.TEST ', 'cc200000-0000-4000-8000-000000000001');
select is(
  (select status::text || '|' || email from public.mitra_invites where id = (select id from mi_ids where label = 'claim1')),
  'claimed|mi-new-1@example.test', 'a regional admin claims a new email (normalized)'
);

reset role;
insert into auth.users (id, aud, role, email, invited_at, email_confirmed_at, last_sign_in_at, created_at)
values
  ('c1000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'mi-new-1@example.test', now(), null, null, now()),
  ('c1000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'mi-other@example.test', now(), null, null, now());
set local role service_role;

select throws_ok(
  $$select public.provision_invited_mitra((select id from mi_ids where label = 'claim1'), 'c1000000-0000-4000-8000-000000000022')$$,
  '23514', 'account does not match this invite', 'a claim cannot capture an account with a different email'
);
select is(
  public.provision_invited_mitra((select id from mi_ids where label = 'claim1'), 'c1000000-0000-4000-8000-000000000021'),
  'cc000000-0000-4000-8000-00000000000a'::uuid, 'provisioning returns the inviter''s tenant'
);
select is(
  (select role::text from public.organization_members where user_id = 'c1000000-0000-4000-8000-000000000021'),
  'mitra', 'the invited account becomes a mitra'
);
select is(
  (select village_id from public.mitra_villages where user_id = 'c1000000-0000-4000-8000-000000000021'),
  'cc200000-0000-4000-8000-000000000001'::uuid, 'the mitra is assigned to the invited village'
);
select throws_ok(
  $$select public.provision_invited_mitra((select id from mi_ids where label = 'claim1'), 'c1000000-0000-4000-8000-000000000021')$$,
  '23514', 'no open invite claim', 'a claim can be provisioned only once'
);

-- ── Authorization of the claim itself ──────────────────────────────────────
select throws_ok(
  $$select * from public.claim_mitra_invite('c1000000-0000-4000-8000-000000000002', 'mi-x@example.test', 'cc200000-0000-4000-8000-000000000003')$$,
  '42501', null, 'a regional admin cannot claim an invite for another region''s village'
);
select throws_ok(
  $$select * from public.claim_mitra_invite('c1000000-0000-4000-8000-000000000005', 'mi-x@example.test', 'cc200000-0000-4000-8000-000000000001')$$,
  '42501', null, 'another tenant''s regional admin cannot claim an invite for this village'
);

-- ── Pilot and mitra invites share one claim per email ──────────────────────
insert into mi_ids
select 'shared', invite_id from public.claim_mitra_invite('c1000000-0000-4000-8000-000000000002', 'mi-shared@example.test', 'cc200000-0000-4000-8000-000000000001');
select is(
  (select outcome::text from public.claim_pilot_invite('c1000000-0000-4000-8000-000000000003', 'mi-shared@example.test', 'cc100000-0000-4000-8000-000000000002')),
  'email_in_use', 'a pilot invite is refused while a mitra invite holds the email'
);
select lives_ok(
  $$select public.fail_mitra_invite((select id from mi_ids where label = 'shared'), 'invite email could not be sent')$$,
  'a failed mitra invite releases its claim'
);
select is(
  (select outcome::text from public.claim_mitra_invite('c1000000-0000-4000-8000-000000000003', 'mi-new-1@example.test', 'cc200000-0000-4000-8000-000000000003')),
  'email_in_use', 'an email with an existing account cannot be claimed'
);

-- Rate limit counts pilot and mitra attempts together. The South admin has
-- 2 attempts so far; add 18 pilot attempts to reach 20.
reset role;
insert into public.pilot_invites (tenant_id, email, inviter_id, home_region_id, status)
select 'cc000000-0000-4000-8000-00000000000a', 'mi-burst-' || n || '@example.test', 'c1000000-0000-4000-8000-000000000003',
  'cc100000-0000-4000-8000-000000000002', 'failed'
from generate_series(1, 18) as n;
set local role service_role;
select is(
  (select outcome::text from public.claim_mitra_invite('c1000000-0000-4000-8000-000000000003', 'mi-limit@example.test', 'cc200000-0000-4000-8000-000000000003')),
  'rate_limited', 'pilot and mitra invites share the limit of 20 attempts per hour'
);

-- ── Audit trail visibility ─────────────────────────────────────────────────
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::integer from public.mitra_invites where inviter_id is distinct from auth.uid()),
  0, 'a regional admin sees only the mitra invites they sent'
);
set local "request.jwt.claim.sub" = 'c1000000-0000-4000-8000-000000000005';
select is((select count(*)::integer from public.mitra_invites), 0, 'another tenant sees no mitra invite records');
select throws_ok(
  $$insert into public.mitra_invites (tenant_id, email, village_id, status) values ('cc000000-0000-4000-8000-00000000000a', 'forged@example.test', 'cc200000-0000-4000-8000-000000000001', 'provisioned')$$,
  '42501', null, 'mitra invite records cannot be written through the API'
);

select * from finish();
rollback;
